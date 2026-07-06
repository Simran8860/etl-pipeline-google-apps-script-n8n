/**
 * Main entry point for the ETL pipeline.
 * Handles authentication, request processing, pipeline execution,
 * and returns the generated output files.
 */

// ---------------------------------------------------------------------------
// HTTP entry point
// ---------------------------------------------------------------------------

/**
 * Entry point for POST requests.
 *
 * @param {GoogleAppsScript.Events.DoPost} e Request event.
 * @returns {GoogleAppsScript.Content.TextOutput}
 */
function doPost(e) {
  const log = Logger_.create('main.doPost');
  const pipelineStart = Date.now();

  try {
    // ── 1. Authenticate ──────────────────────────────────────────────────
    const authResult = _authenticate(e);
    if (!authResult.ok) {
      log.error('Authentication failed', { reason: authResult.reason });
      return _jsonResponse({ status: 'error', error: authResult.reason }, CONFIG.HTTP.UNAUTHORIZED);
    }
    log.info('Authentication passed');

    // ── 2. Parse request body ────────────────────────────────────────────
    const body = _parseBody(e);
    if (!body.ok) {
      log.error('Request body parse failed', { error: body.error });
      return _jsonResponse({ status: 'error', error: body.error }, CONFIG.HTTP.BAD_REQUEST);
    }
    log.info('Request body parsed');

    // ── 3. Run ETL pipeline ──────────────────────────────────────────────
    const pipelineResult = _runPipeline(body.payload, log);

    // ── 4. Build and serialise outputs ───────────────────────────────────
    const outputs = Exporter_.buildOutputs(pipelineResult);
    const files   = Exporter_.serialiseOutputs(outputs);

    const totalMs = Date.now() - pipelineStart;
    log.info('Pipeline complete', { totalMs });

    return _jsonResponse({
      status:       'success',
      processingMs: totalMs,
      summary:      outputs.summaryReport.totals,
      outputs:      files,
    }, CONFIG.HTTP.OK);

  } catch (err) {
    const msg = 'Unhandled pipeline error: ' + err.message;
    Logger.log('[FATAL] ' + msg + '\n' + err.stack);
    return _jsonResponse({ status: 'error', error: msg }, CONFIG.HTTP.INTERNAL_SERVER_ERROR);
  }
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

/**
 * Validate the API key from the request header or query parameter.
 *
 * @private
 * @param {GoogleAppsScript.Events.DoPost} e
 * @returns {{ ok: boolean, reason: string }}
 */
function _authenticate(e) {
  const expected = PropertiesService.getScriptProperties()
    .getProperty(CONFIG.API.KEY_PROPERTY);

  if (!expected) {
    return { ok: false, reason: 'Server misconfiguration: API key not set in Script Properties.' };
  }

  // Try header first, then query parameter as fallback.
  const provided = (e.parameter || {}).apiKey || '';
  if (!provided) {
    return { ok: false, reason: 'Missing API key in request.' };
  }

  if (provided !== expected) {
    return { ok: false, reason: 'Invalid API key.' };
  }

  return { ok: true, reason: '' };
}

// ---------------------------------------------------------------------------
// Body parsing
// ---------------------------------------------------------------------------

/**
 * Parse and validate the POST body JSON.
 *
 * @private
 * @param {GoogleAppsScript.Events.DoPost} e
 * @returns {{ ok: boolean, payload: Object|null, error: string }}
 */
function _parseBody(e) {
  const raw = (e.postData || {}).contents || '';

  if (!raw) {
    return { ok: false, payload: null, error: 'Request body is empty.' };
  }

  let body;
  try {
    body = JSON.parse(raw);
  } catch (ex) {
    return { ok: false, payload: null, error: 'Request body is not valid JSON: ' + ex.message };
  }

  // Accept crm/partner as either JSON string or already-parsed array.
  const normalise = val => {
    if (Array.isArray(val))        return val;
    if (typeof val === 'string')   return val;  // CSV or JSON string.
    return null;
  };

  const payload = {
    crm:      normalise(body.crm),
    linkedin: normalise(body.linkedin),
    webinar:  normalise(body.webinar),
    partner:  normalise(body.partner),
  };

  return { ok: true, payload, error: '' };
}

// ---------------------------------------------------------------------------
// Pipeline orchestration
// ---------------------------------------------------------------------------

/**
 * Run the complete ETL pipeline across all four sources.
 *
 * @private
 * @param {Object}  payload   - Parsed request payload with four source keys.
 * @param {Object}  rootLog   - Logger instance from doPost.
 * @returns {Object} Pipeline result suitable for Exporter_.buildOutputs().
 */
function _runPipeline(payload, rootLog) {
  const allValid       = [];
  const allInvalid     = [];
  const allLogEntries  = [];
  const allParseErrors = [];
  const allTransErrors = [];
  const bySource       = {};

  const pipelineStart = Date.now();

  /**
   * Process one source end-to-end.
   *
   * @param {string|Array} rawData  - Raw source data (string for CSV, array or string for JSON).
   * @param {string}       source   - CONFIG.SOURCES value.
   * @param {'json'|'csv'} format   - Parse hint.
   */
  function _processSource(rawData, source, format) {
    if (!rawData) {
      rootLog.warn(`Source "${source}" not provided in payload — skipped`);
      return;
    }

    rootLog.info(`Processing source: ${source}`);

    // ── Parse ──────────────────────────────────────────────────────────
    let parseResult;
    if (Array.isArray(rawData)) {
      // Already parsed by the client — wrap in a fake parseJson result.
      parseResult = { records: rawData, errors: [] };
    } else {
      parseResult = Parser_.parseAuto(rawData, format);
    }
    allParseErrors.push(...parseResult.errors);

    // ── Transform ──────────────────────────────────────────────────────
    const { transformed, errors: transErrors } = Transformer_.transformBatch(parseResult.records, source);
    allTransErrors.push(...transErrors);

    // ── Validate ───────────────────────────────────────────────────────
    const { valid, invalid } = Validator_.validateBatch(transformed);
    allValid.push(...valid);
    allInvalid.push(...invalid);

    bySource[source] = {
      parsed:    parseResult.records.length,
      valid:     valid.length,
      invalid:   invalid.length,
    };

    rootLog.info(`Source "${source}" complete`, bySource[source]);
  }

  // Process each source.
  _processSource(payload.crm,      CONFIG.SOURCES.CRM,      'json');
  _processSource(payload.linkedin, CONFIG.SOURCES.LINKEDIN, 'csv');
  _processSource(payload.webinar,  CONFIG.SOURCES.WEBINAR,  'csv');
  _processSource(payload.partner,  CONFIG.SOURCES.PARTNER,  'json');

  // ── Deduplicate valid records ────────────────────────────────────────
  const { unique, duplicates } = DuplicateDetector_.findDuplicates(allValid);

  // Collect all log entries for processing-log output.
  allLogEntries.push(...rootLog.getEntries());

  return {
    validRecords:     unique,
    invalidRecords:   allInvalid,
    duplicateRecords: duplicates,
    logEntries:       allLogEntries,
    stats: {
      totalInput:       Object.values(bySource).reduce((s, v) => s + v.parsed, 0),
      totalValid:       unique.length,
      totalInvalid:     allInvalid.length,
      totalDuplicates:  duplicates.length,
      bySource,
      processingMs:     Date.now() - pipelineStart,
      parseErrors:      allParseErrors,
      transformErrors:  allTransErrors,
    },
  };
}

// ---------------------------------------------------------------------------
// Response helper
// ---------------------------------------------------------------------------

/**
 * Creates a JSON response.
 * The HTTP status is included in the response body because Apps Script
 * does not allow custom status codes with ContentService.
 *
 * @param {Object} body Response payload.
 * @param {number} status HTTP status code.
 * @returns {GoogleAppsScript.Content.TextOutput}
 */
function _jsonResponse(body, status) {
  const payload = Object.assign({ httpStatus: status }, body);
  return ContentService
    .createTextOutput(JSON.stringify(payload, null, 2))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------------------
// doGet — health check
// ---------------------------------------------------------------------------

/**
 * Simple health-check endpoint.
 * GET requests are never used for ETL but GAS requires doGet() for the web
 * app to be publicly accessible.
 *
 * @returns {GoogleAppsScript.Content.TextOutput}
 */
function doGet() {
  return _jsonResponse({ status: 'ok', service: 'Mediseller ETL', version: '1.0.0' }, CONFIG.HTTP.OK);
}

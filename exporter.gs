/**
 * Builds the final ETL outputs and serializes them as JSON.
 * These outputs are returned to the Apps Script web app and can be
 * consumed by the n8n workflow.
 */

/** @namespace Exporter_ */
const Exporter_ = (() => {

  const log_ = Logger_.create('Exporter');

  // ── Summary builder ───────────────────────────────────────────────────────

  /**
   * Build the summary-report object from pipeline statistics.
   *
   * @param {Object} stats
   * @param {number} stats.totalInput       - Total raw records received.
   * @param {number} stats.totalValid       - Records that passed validation.
   * @param {number} stats.totalInvalid     - Records that failed validation.
   * @param {number} stats.totalDuplicates  - Duplicate records removed.
   * @param {Object} stats.bySource         - Per-source breakdown.
   * @param {number} stats.processingMs     - Total pipeline duration ms.
   * @param {string[]} stats.parseErrors    - Non-fatal parse errors.
   * @param {string[]} stats.transformErrors - Non-fatal transform errors.
   * @returns {Object} Summary report object.
   */
  function buildSummaryReport(stats) {
    const report = {
      reportGeneratedAt:  new Date().toISOString(),
      pipeline:           'Mediseller ETL v1.0.0',
      totals: {
        input:      stats.totalInput      || 0,
        valid:      stats.totalValid      || 0,
        invalid:    stats.totalInvalid    || 0,
        duplicates: stats.totalDuplicates || 0,
        net:        (stats.totalValid || 0) - (stats.totalDuplicates || 0),
      },
      bySource:           stats.bySource          || {},
      processingMs:       stats.processingMs       || 0,
      parseErrors:        stats.parseErrors        || [],
      transformErrors:    stats.transformErrors     || [],
    };

    log_.info('Summary report built', report.totals);
    return report;
  }

  // ── Processing-log builder ─────────────────────────────────────────────────

  /**
   * Build the processing-log object.
   *
   * @param {Object[]} logEntries - Raw log entries collected during the run.
   * @returns {Object}
   */
  function buildProcessingLog(logEntries) {
    return {
      generatedAt: new Date().toISOString(),
      entries:     logEntries,
    };
  }

  // ── Primary export builder ────────────────────────────────────────────────

  /**
   * Assemble all five output payloads from the pipeline result.
   *
   * @param {Object} pipelineResult
   * @param {Object[]} pipelineResult.validRecords
   * @param {Object[]} pipelineResult.invalidRecords
   * @param {Object[]} pipelineResult.duplicateRecords
   * @param {Object[]} pipelineResult.logEntries
   * @param {Object}   pipelineResult.stats
   * @returns {{
   *   validRecords:     Object[],
   *   invalidRecords:   Object[],
   *   duplicateRecords: Object[],
   *   processingLog:    Object,
   *   summaryReport:    Object
   * }}
   */
  function buildOutputs(pipelineResult) {
    log_.info('Building output payloads');

    const {
      validRecords     = [],
      invalidRecords   = [],
      duplicateRecords = [],
      logEntries       = [],
      stats            = {},
    } = pipelineResult;

    const outputs = {
      validRecords,
      invalidRecords,
      duplicateRecords,
      processingLog:    buildProcessingLog(logEntries),
      summaryReport:    buildSummaryReport(stats),
    };

    log_.info('All outputs assembled', {
      valid:      validRecords.length,
      invalid:    invalidRecords.length,
      duplicates: duplicateRecords.length,
    });

    return outputs;
  }

  /**
   * Serialise all outputs to a JSON string map suitable for HTTP response.
   *
   * @param {Object} outputs - Result of buildOutputs().
   * @returns {Object<string, string>} Map of filename → JSON string.
   */
  function serialiseOutputs(outputs) {
    return {
      'valid-records.json':     JSON.stringify(outputs.validRecords,     null, 2),
      'invalid-records.json':   JSON.stringify(outputs.invalidRecords,   null, 2),
      'duplicate-records.json': JSON.stringify(outputs.duplicateRecords, null, 2),
      'processing-log.json':    JSON.stringify(outputs.processingLog,    null, 2),
      'summary-report.json':    JSON.stringify(outputs.summaryReport,    null, 2),
    };
  }

  return { buildOutputs, buildSummaryReport, buildProcessingLog, serialiseOutputs };
})();

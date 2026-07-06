/**
 * Parser module for the ETL pipeline.
 * Parses JSON and CSV input into structured records while collecting parsing errors.
 */

/** @namespace Parser_ */
const Parser_ = (() => {

  const log_ = Logger_.create('Parser');

  // ── JSON ──────────────────────────────────────────────────────────────────

  /**
   * Parse a JSON string that must be an array of objects.
   *
   * @param {string} text - Raw JSON string.
   * @returns {{ records: Object[], errors: string[] }}
   */
  function parseJson(text) {
    const errors = [];
    let parsed;

    try {
      parsed = JSON.parse(text);
    } catch (e) {
      const msg = 'JSON parse failure: ' + e.message;
      log_.error(msg);
      errors.push(msg);
      return { records: [], errors };
    }

    if (!Array.isArray(parsed)) {
      const msg = 'JSON root is not an array; received type: ' + typeof parsed;
      log_.error(msg);
      errors.push(msg);
      return { records: [], errors };
    }

    const records = [];
    parsed.forEach((item, idx) => {
      if (item === null || typeof item !== 'object' || Array.isArray(item)) {
        const msg = `JSON[${idx}] is not a plain object — skipped`;
        log_.warn(msg, { item });
        errors.push(msg);
      } else {
        records.push(item);
      }
    });

    log_.info(`JSON parsed: ${records.length} records, ${errors.length} errors`);
    return { records, errors };
  }

  // ── CSV ───────────────────────────────────────────────────────────────────

  /**
   * Split a single CSV line respecting RFC-4180 double-quote escaping.
   *
   * @private
   * @param {string} line - A single CSV line.
   * @returns {string[]} Array of raw (un-trimmed) field values.
   */
  function _splitCsvLine(line) {
    const fields = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];

      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            // Escaped double-quote inside a quoted field.
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          fields.push(current);
          current = '';
        } else {
          current += ch;
        }
      }
    }

    fields.push(current);
    return fields;
  }

  /**
   * Parse a CSV string into an array of plain objects using the first row
   * as the header.  Malformed rows (wrong column count) are collected into
   * the errors array but do not abort the parse.
   *
   * @param {string} text - Raw CSV text.
   * @returns {{ records: Object[], errors: string[] }}
   */
  function parseCsv(text) {
    const errors  = [];
    const records = [];

    if (!text || !text.trim()) {
      const msg = 'CSV input is empty';
      log_.error(msg);
      errors.push(msg);
      return { records, errors };
    }

    // Normalise line endings.
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const nonEmpty = lines.filter(l => l.trim().length > 0);

    if (nonEmpty.length < 2) {
      const msg = 'CSV has no data rows (only header or completely empty)';
      log_.warn(msg);
      errors.push(msg);
      return { records, errors };
    }

    const headers = _splitCsvLine(nonEmpty[0]).map(h => h.trim());

    for (let i = 1; i < nonEmpty.length; i++) {
      const rawLine = nonEmpty[i];
      const fields  = _splitCsvLine(rawLine);

      if (fields.length !== headers.length) {
        const msg = `CSV row ${i + 1} has ${fields.length} fields; expected ${headers.length} — skipped`;
        log_.warn(msg, { line: rawLine });
        errors.push(msg);
        continue;
      }

      const obj = {};
      headers.forEach((header, idx) => {
        obj[header] = fields[idx].trim();
      });
      records.push(obj);
    }

    log_.info(`CSV parsed: ${records.length} records, ${errors.length} errors`);
    return { records, errors };
  }

  // ── Auto-detect ───────────────────────────────────────────────────────────

  /**
   * Auto-detect format from content and parse accordingly.
   * Falls back to CSV if the hint is not recognised.
   *
   * @param {string} text            - Raw source text.
   * @param {'json'|'csv'} [hint]    - Optional format hint.
   * @returns {{ records: Object[], errors: string[] }}
   */
  function parseAuto(text, hint) {
    const trimmed = (text || '').trim();
    const format  = hint || (trimmed.startsWith('[') || trimmed.startsWith('{') ? 'json' : 'csv');

    log_.info(`parseAuto: using format "${format}"`);
    return format === 'json' ? parseJson(trimmed) : parseCsv(trimmed);
  }

  return { parseJson, parseCsv, parseAuto };
})();
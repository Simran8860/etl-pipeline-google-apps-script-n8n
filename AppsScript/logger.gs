/**
 * Logger utility for the ETL pipeline.
 * Creates module-specific loggers and stores structured log entries.
 */

// ---------------------------------------------------------------------------
// Logger_ namespace  (trailing underscore = module-private by convention)
// ---------------------------------------------------------------------------

/** @namespace Logger_ */
const Logger_ = (() => {

  /**
   * Creates a new logger instance scoped to a named module.
   *
   * @param {string} moduleName - Human-readable name of the calling module.
   * @returns {{info: function, warn: function, error: function,
   *            getEntries: function, getSummary: function}}
   */
  function create(moduleName) {
    /** @type {Array<LogEntry>} */
    const entries_ = [];
    const startTime_ = Date.now();

    /**
     * @typedef {Object} LogEntry
     * @property {string} timestamp  - ISO-8601 timestamp.
     * @property {string} level      - INFO | WARNING | ERROR.
     * @property {string} module     - Originating module name.
     * @property {string} message    - Human-readable description.
     * @property {Object} [context]  - Optional structured payload.
     * @property {number} elapsedMs  - Milliseconds since logger creation.
     */

    /**
     * Internal entry builder.
     *
     * @private
     * @param {string} level
     * @param {string} message
     * @param {Object} [context]
     */
    function _log(level, message, context) {
      const entry = {
        timestamp: new Date().toISOString(),
        level:     level,
        module:    moduleName,
        message:   message,
        elapsedMs: Date.now() - startTime_,
      };
      if (context !== undefined && context !== null) {
        entry.context = context;
      }
      entries_.push(entry);

      // Mirror to GAS native Logger so entries appear in the IDE console.
      const line = `[${level}] [${moduleName}] ${message}` +
        (context ? ' | ' + JSON.stringify(context) : '');
      Logger.log(line);
    }

    return {
      /**
       * Log an informational message.
       * @param {string} message
       * @param {Object} [context]
       */
      info(message, context) { _log(CONFIG.LOG_LEVEL.INFO, message, context); },

      /**
       * Log a warning (non-fatal anomaly).
       * @param {string} message
       * @param {Object} [context]
       */
      warn(message, context) { _log(CONFIG.LOG_LEVEL.WARNING, message, context); },

      /**
       * Log an error (fatal or record-level failure).
       * @param {string} message
       * @param {Object} [context]
       */
      error(message, context) { _log(CONFIG.LOG_LEVEL.ERROR, message, context); },

      /**
       * Return all collected log entries.
       * @returns {LogEntry[]}
       */
      getEntries() { return entries_.slice(); },

      /**
       * Return a summary object suitable for the processing-log output.
       * @returns {{module: string, totalEntries: number,
       *            infoCount: number, warnCount: number, errorCount: number,
       *            totalElapsedMs: number}}
       */
      getSummary() {
        return {
          module:         moduleName,
          totalEntries:   entries_.length,
          infoCount:      entries_.filter(e => e.level === CONFIG.LOG_LEVEL.INFO).length,
          warnCount:      entries_.filter(e => e.level === CONFIG.LOG_LEVEL.WARNING).length,
          errorCount:     entries_.filter(e => e.level === CONFIG.LOG_LEVEL.ERROR).length,
          totalElapsedMs: Date.now() - startTime_,
        };
      },
    };
  }

  // Public surface of Logger_ namespace.
  return { create };
})();
/**
 * Configuration constants used across the ETL pipeline.
 * Contains API settings, validation rules, source names and output keys.
 */

// ---------------------------------------------------------------------------
// CONFIG
// ---------------------------------------------------------------------------

/** @const {Object} CONFIG - Immutable runtime configuration object. */
const CONFIG = Object.freeze({

  // ── API Security ──────────────────────────────────────────────────────────
  API: Object.freeze({
    /** Script Property key that holds the expected API key value. */
    KEY_PROPERTY: 'MEDISELLER_API_KEY',
    /** HTTP header name clients must send. */
    HEADER_NAME:  'X-API-Key',
  }),

  // ── Source identifiers (used in metadata.source and duplicate priority) ──
  SOURCES: Object.freeze({
    CRM:      'CRM',
    LINKEDIN: 'LINKEDIN',
    WEBINAR:  'WEBINAR',
    PARTNER:  'PARTNER',
  }),

  /**
   * Duplicate-resolution priority — lower index wins when two records share
   * an email or phone.  CRM data is considered the most authoritative.
   */
  DUPLICATE_PRIORITY: ['CRM', 'LINKEDIN', 'WEBINAR', 'PARTNER'],

  // ── Validation thresholds ─────────────────────────────────────────────────
  VALIDATION: Object.freeze({
    /** Minimum digits in a phone number before it is considered valid. */
    PHONE_MIN_DIGITS: 7,
    /** Phone numbers below this digit-count get a SHORT_PHONE warning. */
    PHONE_SHORT_THRESHOLD: 10,
    /** Regex used to validate e-mail addresses. */
    EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  }),

  // ── Canonical output field names ──────────────────────────────────────────
  CANONICAL: Object.freeze({
    LEAD:     Object.freeze(['name', 'email', 'phone', 'job_title', 'country', 'city']),
    COMPANY:  Object.freeze(['name', 'industry', 'website', 'size']),
    METADATA: Object.freeze(['source', 'created_at', 'processed_at', 'tags', 'consent']),
  }),

  // ── HTTP status codes ─────────────────────────────────────────────────────
  HTTP: Object.freeze({
    OK:                    200,
    BAD_REQUEST:           400,
    UNAUTHORIZED:          401,
    UNPROCESSABLE_ENTITY:  422,
    INTERNAL_SERVER_ERROR: 500,
  }),

  // ── Log levels ────────────────────────────────────────────────────────────
  LOG_LEVEL: Object.freeze({
    INFO:    'INFO',
    WARNING: 'WARNING',
    ERROR:   'ERROR',
  }),

  // ── Output file names stored as Script Properties keys ───────────────────
  OUTPUT_KEYS: Object.freeze({
    VALID:      'output_valid_records',
    INVALID:    'output_invalid_records',
    DUPLICATES: 'output_duplicate_records',
    LOG:        'output_processing_log',
    SUMMARY:    'output_summary_report',
  }),
});
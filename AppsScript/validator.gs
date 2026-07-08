/**
 * Validates canonical records before they enter the final output.
 * Checks required fields, email format, phone numbers, and classifies
 * records as valid or invalid.
 *
 * Validation flow:
 * - Required fields
 * - Email format
 * - Phone validation
 * - Batch validation
 */

/** @namespace Validator_ */
const Validator_ = (() => {

  const log_ = Logger_.create('Validator');

  // ── Individual validators ─────────────────────────────────────────────────

  /**
   * Validate an e-mail address.
   */
  function validateEmail(email) {
    if (!email) {
      return { valid: false, error: 'Email is missing' };
    }
    if (!CONFIG.VALIDATION.EMAIL_REGEX.test(email)) {
      return { valid: false, error: `Invalid email format: "${email}"` };
    }
    return { valid: true, error: null };
  }

  /**
   * Validate a phone number.
   */
  function validatePhone(phone) {
    if (!phone) {
      // Phone is not required — absence is a warning, not a hard error.
      return { valid: true, error: null, warning: 'Phone number is missing' };
    }

    const digits = phone.replace(/\D/g, '');

    if (digits.length < CONFIG.VALIDATION.PHONE_MIN_DIGITS) {
      return {
        valid:   false,
        error:   `Phone too short (${digits.length} digits, minimum ${CONFIG.VALIDATION.PHONE_MIN_DIGITS}): "${phone}"`,
        warning: null,
      };
    }

    if (digits.length < CONFIG.VALIDATION.PHONE_SHORT_THRESHOLD) {
      return {
        valid:   true,
        error:   null,
        warning: `Phone may be incomplete (${digits.length} digits): "${phone}"`,
      };
    }

    return { valid: true, error: null, warning: null };
  }

  /**
   * Validate that all required canonical fields are present and non-empty.
   */
  function validateRequiredFields(record) {
    const errors = [];

    if (!record || typeof record !== 'object') {
      errors.push('Record is null or not an object');
      return { valid: false, errors };
    }

    const lead    = record.lead    || {};
    const company = record.company || {};
    const meta    = record.metadata || {};

    // lead.name is required.
    if (!lead.name || !String(lead.name).trim()) {
      errors.push('Required field missing: lead.name');
    }

    // lead.email is required (also checked by validateEmail separately).
    if (!lead.email || !String(lead.email).trim()) {
      errors.push('Required field missing: lead.email');
    }

    // company.name is required.
    if (!company.name || !String(company.name).trim()) {
      errors.push('Required field missing: company.name');
    }

    // metadata.source must be a known source.
    if (!meta.source || !Object.values(CONFIG.SOURCES).includes(meta.source)) {
      errors.push(`Invalid or missing metadata.source: "${meta.source}"`);
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Run the full validation suite on a single canonical record.
   * Collects all errors and warnings without short-circuiting.
   */
  function validateRecord(record) {
    const allErrors   = [];
    const allWarnings = [];

    // 1. Required-fields check.
    const reqResult = validateRequiredFields(record);
    allErrors.push(...reqResult.errors);

    // 2. Email validation.
    const emailResult = validateEmail((record.lead || {}).email);
    if (!emailResult.valid) allErrors.push(emailResult.error);

    // 3. Phone validation.
    const phoneResult = validatePhone((record.lead || {}).phone);
    if (!phoneResult.valid && phoneResult.error)      allErrors.push(phoneResult.error);
    if (phoneResult.warning)                           allWarnings.push(phoneResult.warning);

    const valid = allErrors.length === 0;

    if (!valid) {
      log_.warn('Record failed validation', { errors: allErrors, email: (record.lead || {}).email });
    } else if (allWarnings.length > 0) {
      log_.warn('Record has warnings', { warnings: allWarnings, email: (record.lead || {}).email });
    }

    return { valid, errors: allErrors, warnings: allWarnings };
  }

  /**
   * Validate a batch of canonical records.
   * Attaches _validation metadata to each record.
   */
  function validateBatch(records) {
    const valid   = [];
    const invalid = [];

    records.forEach(record => {
      const result = validateRecord(record);

      // Attach validation result without mutating the canonical fields.
      const annotated = Object.assign({}, record, {
        _validation: {
          valid:    result.valid,
          errors:   result.errors,
          warnings: result.warnings,
        },
      });

      if (result.valid) {
        valid.push(annotated);
      } else {
        invalid.push(annotated);
      }
    });

    log_.info(`validateBatch: ${valid.length} valid, ${invalid.length} invalid`);
    return { valid, invalid };
  }

  return { validateEmail, validatePhone, validateRequiredFields, validateRecord, validateBatch };
})();

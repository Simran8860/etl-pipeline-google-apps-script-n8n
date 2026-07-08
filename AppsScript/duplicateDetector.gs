/** * Handles duplicate detection for lead records. * Records are checked using email first and then phone number. * If duplicates are found, the record from the higher priority source is kept. */
/** @namespace DuplicateDetector_ */

const DuplicateDetector_ = (() => {

  const log_ = Logger_.create('DuplicateDetector');

  // ── Key generation ────────────────────────────────────────────────────────

  /**
   * Generate normalised lookup keys for a canonical record.
   * Empty / null values produce '' which must NOT be used as a bucket key.
   *
   * @param {Object} record - Canonical record (post-transform, post-validate).
   * @returns {{ emailKey: string, phoneKey: string }}
   */
  function generateDuplicateKey(record) {
    const email = ((record.lead || {}).email  || '').trim().toLowerCase();
    const phone = ((record.lead || {}).phone  || '').replace(/\D/g, '');
    return { emailKey: email, phoneKey: phone };
  }

  // ── Priority helper ───────────────────────────────────────────────────────

  /**
   * Return the numeric priority of a source (lower = more authoritative).
   *
   * @private
   * @param {Object} record
   * @returns {number} 0-based index into CONFIG.DUPLICATE_PRIORITY, or 999.
   */
  function _sourcePriority(record) {
    const source = (record.metadata || {}).source || '';
    const idx    = CONFIG.DUPLICATE_PRIORITY.indexOf(source);
    return idx === -1 ? 999 : idx;
  }

  // ── Core algorithm ────────────────────────────────────────────────────────

  /**
   * Separate a validated batch into unique records and duplicates.
   *
   * Algorithm:
   *   1. Sort records so higher-priority sources come first.
   *   2. Iterate; for each record check email index, then phone index.
   *   3. If a match is found, the incoming record is the duplicate.
   *   4. Attach _duplicate metadata with reason, matchedEmail/matchedPhone,
   *      and the winning source.
   *
   * @param {Object[]} records - Array of validated canonical records.
   * @returns {{ unique: Object[], duplicates: Object[] }}
   */
  function findDuplicates(records) {
    // Sort: lower priority index (more authoritative) first so they land in
    // the unique bucket and later arrivals are flagged as duplicates.
    const sorted = records.slice().sort((a, b) => _sourcePriority(a) - _sourcePriority(b));

    /** @type {Map<string, Object>} email → winning record */
    const emailIndex = new Map();
    /** @type {Map<string, Object>} phone → winning record */
    const phoneIndex = new Map();

    const unique     = [];
    const duplicates = [];

    sorted.forEach(record => {
      const { emailKey, phoneKey } = generateDuplicateKey(record);

      // ── Check email first ──────────────────────────────────────────────
      if (emailKey && emailIndex.has(emailKey)) {
        const winner = emailIndex.get(emailKey);
        const reason = `Duplicate email "${emailKey}" — already seen from source [${(winner.metadata || {}).source}]`;
        log_.warn(reason);
        duplicates.push(_annotate(record, reason, 'email', emailKey, winner));
        return;
      }

      // ── Check phone second ─────────────────────────────────────────────
      if (phoneKey && phoneIndex.has(phoneKey)) {
        const winner = phoneIndex.get(phoneKey);
        const reason = `Duplicate phone "${phoneKey}" — already seen from source [${(winner.metadata || {}).source}]`;
        log_.warn(reason);
        duplicates.push(_annotate(record, reason, 'phone', phoneKey, winner));
        return;
      }

      // ── No match — unique record ───────────────────────────────────────
      if (emailKey) emailIndex.set(emailKey, record);
      if (phoneKey) phoneIndex.set(phoneKey, record);
      unique.push(record);
    });

    log_.info(`findDuplicates: ${unique.length} unique, ${duplicates.length} duplicates`);
    return { unique, duplicates };
  }

  /**
   * Attach duplicate metadata to a rejected record.
   *
   * @private
   * @param {Object} record     - The record being flagged.
   * @param {string} reason     - Human-readable duplicate reason.
   * @param {string} matchType  - 'email' | 'phone'.
   * @param {string} matchValue - The key that matched.
   * @param {Object} winner     - The record that was retained.
   * @returns {Object}
   */
  function _annotate(record, reason, matchType, matchValue, winner) {
    return Object.assign({}, record, {
      _duplicate: {
        reason:          reason,
        matchType:       matchType,
        matchValue:      matchValue,
        winningSource:   (winner.metadata  || {}).source,
        winningEmail:    (winner.lead      || {}).email,
        detectedAt:      new Date().toISOString(),
      },
    });
  }

  return { generateDuplicateKey, findDuplicates };
})();
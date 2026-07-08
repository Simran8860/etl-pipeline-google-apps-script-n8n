/**
 * Maps records from different data sources into a common canonical format.
 * 
 * Canonical model:
 *   {
 *     lead:    { name, email, phone, job_title, country, city },
 *     company: { name, industry, website, size },
 *     metadata:{ source, created_at, processed_at, tags, consent }
 *   }
 *
 * Source field reference (derived from uploaded datasets — do NOT alter):
 *   CRM             : firstName, lastName, email, phoneNumber, company, role, nation
 *   LinkedIn        : full_name, email_address, mobile, company_name, title, country, website
 *   Webinar         : name, email, phone, organization, designation, location_country, industry
 *   Partner         : personName, mail, mobileNo, companyName, companySize
 *
 */

/** @namespace Transformer_ */
const Transformer_ = (() => {

  const log_ = Logger_.create('Transformer');

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Normalise a phone string: strip everything except digits and leading '+'.
   *
   * @private
   * @param {string} raw
   * @returns {string}
   */
  function _normalisePhone(raw) {
    if (!raw) return '';
    const s = String(raw).trim();
    const sign = s.startsWith('+') ? '+' : '';
    return sign + s.replace(/\D/g, '');
  }

  /**
   * Normalise an email address: lower-case and trim.
   *
   * @private
   * @param {string} raw
   * @returns {string}
   */
  function _normaliseEmail(raw) {
    return raw ? String(raw).trim().toLowerCase() : '';
  }

  /**
   * Build the metadata block common to every transformed record.
   *
   * @private
   * @param {string} source - One of CONFIG.SOURCES values.
   * @param {string[]} [tags]
   * @returns {Object}
   */
  function _buildMetadata(source, tags) {
    return {
      source:       source,
      created_at:   new Date().toISOString(),
      processed_at: new Date().toISOString(),
      tags:         tags || [],
      consent:      false,   // No consent signal in any source dataset.
    };
  }

  /**
   * Safely read a string field, returning '' when null/undefined.
   *
   * @private
   * @param {*} value
   * @returns {string}
   */
  function _str(value) {
    return value !== null && value !== undefined ? String(value).trim() : '';
  }

  // ── Per-source transformers ───────────────────────────────────────────────

  /**
   * Transform a single raw CRM record.
   * Source fields: firstName, lastName, email, phoneNumber, company, role, nation
   *
   * @param {Object} raw - One element from crm_export.json.
   * @returns {Object} Canonical record.
   */
  function transformCRM(raw) {
    log_.info('transformCRM', { email: raw.email });

    const fullName = [_str(raw.firstName), _str(raw.lastName)]
      .filter(Boolean).join(' ');

    return {
      lead: {
        name:      fullName,
        email:     _normaliseEmail(raw.email),
        phone:     _normalisePhone(raw.phoneNumber),
        job_title: _str(raw.role),
        country:   _str(raw.nation),
        city:      '',                    // CRM does not supply city.
      },
      company: {
        name:     _str(raw.company),
        industry: '',                     // CRM does not supply industry.
        website:  '',                     // CRM does not supply website.
        size:     '',                     // CRM does not supply size.
      },
      metadata: _buildMetadata(CONFIG.SOURCES.CRM, ['crm-import']),
    };
  }

  /**
   * Transform a single raw LinkedIn lead record.
   * Source fields: full_name, email_address, mobile, company_name, title, country, website
   *
   * @param {Object} raw - One row from linkedin_leads.csv.
   * @returns {Object} Canonical record.
   */
  function transformLinkedIn(raw) {
    log_.info('transformLinkedIn', { email: raw.email_address });

    return {
      lead: {
        name:      _str(raw.full_name),
        email:     _normaliseEmail(raw.email_address),
        phone:     _normalisePhone(raw.mobile),
        job_title: _str(raw.title),
        country:   _str(raw.country),
        city:      '',                    // LinkedIn export does not supply city.
      },
      company: {
        name:     _str(raw.company_name),
        industry: '',                     // LinkedIn CSV does not supply industry.
        website:  _str(raw.website),
        size:     '',                     // LinkedIn CSV does not supply size.
      },
      metadata: _buildMetadata(CONFIG.SOURCES.LINKEDIN, ['linkedin-export']),
    };
  }

  /**
   * Transform a single raw Webinar signup record.
   * Source fields: name, email, phone, organization, designation, location_country, industry
   *
   * @param {Object} raw - One row from webinar_signups.csv.
   * @returns {Object} Canonical record.
   */
  function transformWebinar(raw) {
    log_.info('transformWebinar', { email: raw.email });

    return {
      lead: {
        name:      _str(raw.name),
        email:     _normaliseEmail(raw.email),
        phone:     _normalisePhone(raw.phone),
        job_title: _str(raw.designation),
        country:   _str(raw.location_country),
        city:      '',                    // Webinar CSV does not supply city.
      },
      company: {
        name:     _str(raw.organization),
        industry: _str(raw.industry),
        website:  '',                     // Webinar CSV does not supply website.
        size:     '',                     // Webinar CSV does not supply size.
      },
      metadata: _buildMetadata(CONFIG.SOURCES.WEBINAR, ['webinar-signup']),
    };
  }

  /**
   * Transform a single raw Partner referral record.
   * Source fields: personName, mail, mobileNo, companyName, companySize
   *
   * @param {Object} raw - One element from partner_referrals.json.
   * @returns {Object} Canonical record.
   */
  function transformPartner(raw) {
    log_.info('transformPartner', { email: raw.mail });

    return {
      lead: {
        name:      _str(raw.personName),
        email:     _normaliseEmail(raw.mail),
        phone:     _normalisePhone(raw.mobileNo),
        job_title: '',                    // Partner referrals do not supply job title.
        country:   '',                    // Partner referrals do not supply country.
        city:      '',
      },
      company: {
        name:     _str(raw.companyName),
        industry: '',                     // Partner referrals do not supply industry.
        website:  '',
        size:     _str(raw.companySize),
      },
      metadata: _buildMetadata(CONFIG.SOURCES.PARTNER, ['partner-referral']),
    };
  }

  /**
   * Dispatch a raw record to the correct transformer based on source string.
   *
   * @param {Object} raw    - Raw record from any source.
   * @param {string} source - One of CONFIG.SOURCES values.
   * @returns {Object} Canonical record.
   * @throws {Error} When an unknown source is supplied.
   */
  function transform(raw, source) {
    switch (source) {
      case CONFIG.SOURCES.CRM:      return transformCRM(raw);
      case CONFIG.SOURCES.LINKEDIN: return transformLinkedIn(raw);
      case CONFIG.SOURCES.WEBINAR:  return transformWebinar(raw);
      case CONFIG.SOURCES.PARTNER:  return transformPartner(raw);
      default:
        throw new Error('Unknown source: ' + source);
    }
  }

  /**
   * Transform an entire batch of raw records from one source.
   *
   * @param {Object[]} records - Array of raw records.
   * @param {string}   source  - Source identifier.
   * @returns {{ transformed: Object[], errors: string[] }}
   */
  function transformBatch(records, source) {
    const transformed = [];
    const errors      = [];

    records.forEach((raw, idx) => {
      try {
        transformed.push(transform(raw, source));
      } catch (e) {
        const msg = `Transform error at ${source}[${idx}]: ${e.message}`;
        log_.error(msg, { raw });
        errors.push(msg);
      }
    });

    log_.info(`transformBatch[${source}]: ${transformed.length} ok, ${errors.length} errors`);
    return { transformed, errors };
  }

  return { transformCRM, transformLinkedIn, transformWebinar, transformPartner, transform, transformBatch };
})();
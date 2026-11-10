/* nominate.js — simple nomination form handler */

(function () {
  'use strict';

  // BTA-095: canonical category list. Must be kept in sync with
  // industry-leader.js's NOMINATION_CATEGORIES (the names/order here are a
  // deliberate, minimal copy rather than a shared module, to avoid a
  // broader refactor of how these two standalone pages load scripts).
  // 'New Business of the Year' is the one category api/entry-proxy.js's
  // handleSubmitNomination treats differently (businessName/businessOwner
  // instead of nomineeName/nomineeCompany) -- see handleCategoryChange().
  const NOMINATION_CATEGORIES = [
    'Above & Beyond',
    'Apprentice of The Year',
    'Lifetime Achievement',
    'Community Impact Award',
    'Female Tradesperson of the Year',
    'Male Tradesperson of the Year',
    'Young Tradesperson of the Year',
    'New Business of the Year',
  ];

  const NEW_BUSINESS_CATEGORY = 'New Business of the Year';

  function getEl(id) {
    return document.getElementById(id);
  }

  function setError(inputId, errId, msg) {
    const el = getEl(inputId);
    const fb = getEl(errId);
    if (el) el.classList.add('is-invalid');
    if (fb) {
      fb.textContent = msg;
      fb.style.display = 'block';
    }
  }

  function clearAllErrors() {
    [
      'nomineeCategory',
      'nomineeName',
      'nomineeCompany',
      'businessName',
      'businessOwner',
      'nomineePhone',
      'nomineeWorkDesc',
      'nominationReason',
      'nominatorName',
      'nominatorEmail',
    ].forEach((id) => {
      const el = getEl(id);
      if (el) el.classList.remove('is-invalid');
    });
    document.querySelectorAll('.invalid-feedback').forEach((el) => {
      el.style.display = 'none';
    });
    const hint = getEl('declarationHint');
    if (hint) hint.style.display = 'none';
  }

  function isNewBusinessSelected() {
    return (getEl('nomineeCategory')?.value || '') === NEW_BUSINESS_CATEGORY;
  }

  // BTA-095: populate the category <select> from the canonical list above.
  function populateCategories() {
    const select = getEl('nomineeCategory');
    if (!select) return;
    NOMINATION_CATEGORIES.forEach((name) => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      select.appendChild(opt);
    });
  }

  // BTA-095: toggle the person-fields (nomineeName/nomineeCompany) vs
  // business-fields (businessName/businessOwner) group based on the
  // selected category, matching handleSubmitNomination's own branching
  // (api/entry-proxy.js's isNewBusiness check). Clears -- rather than just
  // hides -- the fields in the branch being hidden, so a value typed before
  // switching categories is never submitted as though it belonged to the
  // other branch.
  function handleCategoryChange() {
    const isBusiness = isNewBusinessSelected();
    const personFields = getEl('personFields');
    const businessFields = getEl('businessFields');

    if (personFields) personFields.style.display = isBusiness ? 'none' : '';
    if (businessFields) businessFields.style.display = isBusiness ? '' : 'none';

    if (isBusiness) {
      ['nomineeName', 'nomineeCompany'].forEach((id) => {
        const el = getEl(id);
        if (el) el.value = '';
      });
    } else {
      ['businessName', 'businessOwner'].forEach((id) => {
        const el = getEl(id);
        if (el) el.value = '';
      });
    }
  }

  function showToast(msg) {
    const toast = getEl('nomToast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 4000);
  }

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function validate() {
    clearAllErrors();
    let valid = true;

    const category = (getEl('nomineeCategory')?.value || '').trim();
    if (!category) {
      setError('nomineeCategory', 'nomineeCategoryErr', 'Please select an award category');
      valid = false;
    }

    if (isNewBusinessSelected()) {
      const businessName = (getEl('businessName')?.value || '').trim();
      if (!businessName) {
        setError('businessName', 'businessNameErr', 'Please enter the business name');
        valid = false;
      } else if (businessName.length < 2) {
        setError('businessName', 'businessNameErr', 'Business name must be at least 2 characters');
        valid = false;
      }

      const businessOwner = (getEl('businessOwner')?.value || '').trim();
      if (!businessOwner) {
        setError('businessOwner', 'businessOwnerErr', "Please enter the business owner's name");
        valid = false;
      } else if (businessOwner.length < 2) {
        setError('businessOwner', 'businessOwnerErr', 'Name must be at least 2 characters');
        valid = false;
      }
    } else {
      const name = (getEl('nomineeName')?.value || '').trim();
      if (!name) {
        setError('nomineeName', 'nomineeNameErr', "Please enter the nominee's name");
        valid = false;
      } else if (name.length < 2) {
        setError('nomineeName', 'nomineeNameErr', 'Name must be at least 2 characters');
        valid = false;
      }

      const company = (getEl('nomineeCompany')?.value || '').trim();
      if (!company) {
        setError('nomineeCompany', 'nomineeCompanyErr', "Please enter the nominee's company");
        valid = false;
      } else if (company.length < 2) {
        setError('nomineeCompany', 'nomineeCompanyErr', 'Company name must be at least 2 characters');
        valid = false;
      }
    }

    const phone = (getEl('nomineePhone')?.value || '').trim();
    if (!phone) {
      setError('nomineePhone', 'nomineePhoneErr', 'Please enter a business phone number');
      valid = false;
    }

    const workDesc = (getEl('nomineeWorkDesc')?.value || '').trim();
    if (!workDesc) {
      setError('nomineeWorkDesc', 'nomineeWorkDescErr', 'Please describe the work they did');
      valid = false;
    } else if (workDesc.length < 20) {
      setError('nomineeWorkDesc', 'nomineeWorkDescErr', 'Please provide more detail (at least 20 characters)');
      valid = false;
    }

    const reason = (getEl('nominationReason')?.value || '').trim();
    if (!reason) {
      setError('nominationReason', 'nominationReasonErr', 'Please tell us why they deserve to enter');
      valid = false;
    } else if (reason.length < 20) {
      setError('nominationReason', 'nominationReasonErr', 'Please provide more detail (at least 20 characters)');
      valid = false;
    }

    const nomName = (getEl('nominatorName')?.value || '').trim();
    if (!nomName) {
      setError('nominatorName', 'nominatorNameErr', 'Please enter your full name');
      valid = false;
    }

    const nomEmail = (getEl('nominatorEmail')?.value || '').trim();
    if (!nomEmail) {
      setError('nominatorEmail', 'nominatorEmailErr', 'Please enter your email address');
      valid = false;
    } else if (!validateEmail(nomEmail)) {
      setError('nominatorEmail', 'nominatorEmailErr', 'Please enter a valid email address');
      valid = false;
    }

    const declared = getEl('declarationCheckbox')?.checked;
    if (!declared) {
      const hint = getEl('declarationHint');
      if (hint) hint.style.display = 'block';
      valid = false;
    }

    return valid;
  }

  function setupCharCounters() {
    [
      { textareaId: 'nomineeWorkDesc', counterId: 'workDescCount', max: 1000 },
      { textareaId: 'nominationReason', counterId: 'reasonCount', max: 2000 },
    ].forEach(({ textareaId, counterId, max }) => {
      const el = getEl(textareaId);
      const counter = getEl(counterId);
      if (!el || !counter) return;
      el.addEventListener('input', () => {
        const len = el.value.length;
        counter.textContent = `${len.toLocaleString()} / ${max.toLocaleString()}`;
        counter.classList.toggle('warn', len > max * 0.9);
      });
    });
  }

  // BTA-095: api/entry-proxy.js's handleSubmitNomination does not have a
  // dedicated column for the nominee's phone number in either branch, nor
  // for a "company website"/"work description" pair in the person branch
  // (only the New Business branch reads businessWebsite/businessDescription).
  // Rather than silently discarding whatever doesn't have a structured
  // destination, this composes it into the handler's existing, already-
  // persisted free-text `supportingInfo` field, which is appended to the
  // entry's stored supporting_information block alongside the nominator's
  // own company/relationship context. The nominator's own area
  // (`nominatorArea`) is included here too, not sent as `county_city` --
  // county_city/region in the handler scope the NOMINEE's organisation
  // lookup, so sending the nominator's own location there would silently
  // mis-scope that lookup. nominate.html has no nominee-location picker at
  // all (unlike industry-leader.html), so nominee-side area scoping remains
  // unsupported here -- a pre-existing limitation, not introduced by this
  // fix, and not addressed here since adding one would be a larger UI
  // change than this repair's approved scope.
  function buildSupportingInfo(isBusiness) {
    const parts = [];
    const website = (getEl('nomineeWebsite')?.value || '').trim();
    const phone = (getEl('nomineePhone')?.value || '').trim();
    const area = (getEl('nominatorArea')?.value || '').trim();

    if (!isBusiness && website) parts.push('Company website: ' + website);
    if (phone) parts.push((isBusiness ? 'Business' : 'Company') + ' phone: ' + phone);
    if (area) parts.push("Nominator's own area (not necessarily the nominee's): " + area);

    return parts.join('\n') || '';
  }

  function buildPayload() {
    const isBusiness = isNewBusinessSelected();
    const payload = {
      action: 'submit_nomination',
      awardCategory: (getEl('nomineeCategory')?.value || '').trim(),
      nominationReason: (getEl('nominationReason')?.value || '').trim(),
      nominatorName: (getEl('nominatorName')?.value || '').trim(),
      nominatorEmail: (getEl('nominatorEmail')?.value || '').trim(),
      nominatorPhone: (getEl('nominatorPhone')?.value || '').trim(),
      supportingInfo: buildSupportingInfo(isBusiness),
    };

    if (isBusiness) {
      payload.businessName = (getEl('businessName')?.value || '').trim();
      payload.businessOwner = (getEl('businessOwner')?.value || '').trim();
      payload.businessWebsite = (getEl('nomineeWebsite')?.value || '').trim();
      payload.businessDescription = (getEl('nomineeWorkDesc')?.value || '').trim();
    } else {
      payload.nomineeName = (getEl('nomineeName')?.value || '').trim();
      payload.nomineeCompany = (getEl('nomineeCompany')?.value || '').trim();
    }

    return payload;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) {
      const firstInvalid = document.querySelector('.is-invalid');
      if (firstInvalid) firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const btn = getEl('submitNomBtn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Submitting…';
    }

    try {
      const res = await fetch('/api/entry-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Submission failed');

      getEl('nomFormBody').style.display = 'none';
      getEl('successState').style.display = 'block';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('Nomination error:', err);
      showToast(err.message || 'Something went wrong. Please try again.');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = 'Submit Nomination <i class="bi bi-arrow-right ms-2"></i>';
      }
    }
  }

  // BTA-072: apply CMS-editable confirmation copy. nominate.html has no
  // multi-step headings, so only the success-state title/message are
  // CMS-editable here. Falls back to the existing hardcoded text when
  // unset or malformed.
  async function applyFormContent() {
    try {
      const res = await fetch('/api/entry-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_public_data' }),
      });
      const data = await res.json();
      const content = data?.site_settings?.form_content?.nominate;
      if (!content || typeof content !== 'object') return;

      const successEl = getEl('successState');
      if (successEl) {
        if (content.confirmationTitle) {
          const h2 = successEl.querySelector('h2');
          if (h2) h2.textContent = content.confirmationTitle;
        }
        if (content.confirmationMessage) {
          const p = successEl.querySelector('p');
          if (p) p.textContent = content.confirmationMessage;
        }
      }

      // BTA-073: this page has no <footer> and isn't covered by
      // public-site-settings.js's page_seo/og:title sync, so its own
      // title/description/social-preview metadata is applied here,
      // reusing the exact same admin-configured values as the confirmation copy.
      if (content.pageTitle) {
        document.title = content.pageTitle;
        setMetaContent('property', 'og:title', content.pageTitle);
      }
      if (content.metaDescription) {
        setMetaContent('name', 'description', content.metaDescription);
        setMetaContent('property', 'og:description', content.metaDescription);
      }
    } catch (_e) {
      // Network/parse failure -- keep the existing hardcoded text.
    }
  }

  function setMetaContent(attr, value, content) {
    const selector = 'meta[' + attr + '="' + value + '"]';
    const existing = document.querySelector(selector);
    if (existing) {
      existing.setAttribute('content', content);
    } else {
      const meta = document.createElement('meta');
      meta.setAttribute(attr, value);
      meta.setAttribute('content', content);
      document.head.appendChild(meta);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    populateCategories();
    const categorySelect = getEl('nomineeCategory');
    if (categorySelect) categorySelect.addEventListener('change', handleCategoryChange);
    setupCharCounters();
    const form = getEl('nominationForm');
    if (form) form.addEventListener('submit', handleSubmit);
    applyFormContent();
  });
})();

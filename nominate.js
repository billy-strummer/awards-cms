/* nominate.js — simple nomination form handler */

(function () {
  'use strict';

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
    ['nomineeName', 'nomineePhone', 'nomineeWorkDesc', 'nominationReason', 'nominatorName', 'nominatorEmail'].forEach(
      (id) => {
        const el = getEl(id);
        if (el) el.classList.remove('is-invalid');
      }
    );
    document.querySelectorAll('.invalid-feedback').forEach((el) => {
      el.style.display = 'none';
    });
    const hint = getEl('declarationHint');
    if (hint) hint.style.display = 'none';
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

    const name = (getEl('nomineeName')?.value || '').trim();
    if (!name) {
      setError('nomineeName', 'nomineeNameErr', 'Please enter the name of the company or trade professional');
      valid = false;
    } else if (name.length < 2) {
      setError('nomineeName', 'nomineeNameErr', 'Name must be at least 2 characters');
      valid = false;
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

  function buildPayload() {
    return {
      action: 'submit_nomination',
      website: (getEl('hp_website')?.value || '').trim(),
      nomineeName: (getEl('nomineeName')?.value || '').trim(),
      nomineeWebsite: (getEl('nomineeWebsite')?.value || '').trim(),
      nomineePhone: (getEl('nomineePhone')?.value || '').trim(),
      nomineeWorkDesc: (getEl('nomineeWorkDesc')?.value || '').trim(),
      nominationReason: (getEl('nominationReason')?.value || '').trim(),
      nominatorName: (getEl('nominatorName')?.value || '').trim(),
      nominatorEmail: (getEl('nominatorEmail')?.value || '').trim(),
      nominatorPhone: (getEl('nominatorPhone')?.value || '').trim(),
    };
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

  document.addEventListener('DOMContentLoaded', () => {
    setupCharCounters();
    const form = getEl('nominationForm');
    if (form) form.addEventListener('submit', handleSubmit);
  });
})();

/* ==================================================== */
/* COMPREHENSIVE ENTRY SUBMISSION FORM                  */
/* Uses exact sectors, categories & regions from CMS    */
/* ==================================================== */
(function () {
  'use strict';

  // API proxy for entry submission (no direct DB access)
  async function entryApi(payload) {
    const res = await fetch('/api/entry-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Submission failed');
    return data;
  }

  // =====================================================
  // AWARD CATEGORIES (mirrors award-categories-config.js)
  // =====================================================

  const STANDARD_CATEGORIES = {
    'BUILDING & CONSTRUCTION': [
      'Brickwork & Masonry Company',
      'Drainage Company',
      'Extension Company',
      'General Building Company',
      'Groundworks & Foundations Company',
      'Guttering Company',
      'Loft Conversion Company',
      'Maintenance Services',
      'New Build Company',
      'Roofing Company',
      'Structural Engineers',
      'Structural Steelworks',
    ],
    'MECHANICAL, ELECTRICAL & PLUMBING': [
      'Air-Conditioning & Ventilation Company',
      'Electrical Company',
      'Heating Company',
      'Plumbing Company',
      'Underfloor Heating Company',
    ],
    'CARPENTRY & JOINERY': [
      'Cabinet Maker',
      'Carpentry Company',
      'Joinery Company',
      'Staircase Specialist',
      'Timber Windows Installer',
    ],
    'FIT-OUT & FINISHING': [
      'Bathroom Installer',
      'Carpet Fitters',
      'Curtains & Blinds Installer',
      'Drylining Company',
      'Flooring Installer',
      'Home Office Installer',
      'Interior Refurbishment Company',
      'Kitchen Installer',
      'Painting & Decorating Company',
      'Plastering Company',
      'Screeding Company',
      'Tiling Installer',
    ],
    'OUTDOOR & LANDSCAPING': [
      'Decking Company',
      'Driveway & Paving Company',
      'Fencing Installer',
      'Gardening Services',
      'Garden Outbuilding Company',
      'Landscaping & Garden Design Company',
      'Outdoor Lighting & Electrical Company',
      'Tree Surgery Services',
    ],
    'ENERGY, TECH & SUSTAINABILITY': [
      'EV Charger Installer',
      'Insulation & Energy Efficiency Company',
      'PV Installer',
      'Renewable Energy Specialist',
      'Security System Installer',
      'Smart Home & Automation Company',
    ],
    'SPECIALIST TRADES': [
      'Asbestos Removal Specialist',
      'Locksmith',
      'Pest Control Company',
      'Rendering Company',
      'Scaffolding Company',
      'Shop Fitting Company',
      'Swimming Pool & Hot Tub Company',
      'Window & Door Installer',
    ],
    'INDUSTRY LEADERSHIP': [
      'Employer of the Year',
      'Business Leader of the Year',
      'Innovation Award',
      'Apprenticeship Employer of the Year',
      'Community Impact Award',
      'Net Zero & Sustainability Award',
      'Rising Star Award',
    ],
  };

  const SMALL_CATEGORIES = {
    'BUILDING & CONSTRUCTION': [
      'Brickwork & Masonry Company',
      'Drainage Company',
      'Extension Company',
      'General Building Company',
      'Groundworks & Foundations Company',
      'Guttering Company',
      'Loft Conversion Company',
      'Maintenance Services',
      'New Build Company',
      'Roofing Company',
    ],
    'MECHANICAL, ELECTRICAL & PLUMBING': [
      'Air-Conditioning & Ventilation Company',
      'Electrical Company',
      'Plumbing & Heating Company',
    ],
    'CARPENTRY & JOINERY': ['Carpentry & Joinery Company', 'Timber Windows Installer'],
    'FIT-OUT & FINISHING': [
      'Bathroom Installer',
      'Carpet Fitters',
      'Flooring Installer',
      'Interior Refurbishment Company',
      'Kitchen Installer',
      'Painting & Decorating Company',
      'Plastering Company',
      'Tiling Installer',
    ],
    'OUTDOOR & LANDSCAPING': [
      'Driveway & Paving Company',
      'Fencing Installer',
      'Gardening Services',
      'Landscaping & Garden Design Company',
      'Tree Surgery Services',
    ],
    'ENERGY, TECH & SUSTAINABILITY': [
      'EV Charger Installer',
      'Insulation & Energy Efficiency Company',
      'PV Installer',
      'Renewable Energy Specialist',
      'Security System Installer',
    ],
    'SPECIALIST TRADES': [
      'Locksmith',
      'Pest Control Company',
      'Rendering Company',
      'Scaffolding Company',
      'Window & Door Installer',
    ],
    'INDUSTRY LEADERSHIP': [
      'Employer of the Year',
      'Business Leader of the Year',
      'Innovation Award',
      'Community Impact Award',
    ],
  };

  const SMALL_COUNTIES = ['Ceredigion', 'Herefordshire', 'Isle of Wight', 'Rutland'];

  // =====================================================
  // Lightweight toast for public pages
  // =====================================================
  function showPublicToast(msg, type = 'warning') {
    let container = document.getElementById('publicToastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'publicToastContainer';
      container.setAttribute('role', 'alert');
      container.setAttribute('aria-live', 'polite');
      container.style.cssText =
        'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:99999;max-width:400px;width:calc(100% - 40px);';
      document.body.appendChild(container);
    }
    const colors = { warning: '#ffc107', error: '#dc3545', success: '#28a745', info: '#17a2b8' };
    const textColors = { warning: '#000', error: '#fff', success: '#fff', info: '#fff' };
    const toast = document.createElement('div');
    toast.style.cssText = `background:${colors[type] || colors.warning};color:${textColors[type] || '#000'};padding:12px 20px;margin-bottom:8px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.15);font-size:14px;opacity:0;transition:opacity .3s;font-family:'Inter',sans-serif;text-align:center;`;
    toast.textContent = msg;
    container.appendChild(toast);
    requestAnimationFrame(() => (toast.style.opacity = '1'));
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // =====================================================
  // MAIN APPLICATION
  // =====================================================

  // Expose entryFormApp globally for onclick handlers in HTML.
  // NOTE: This is a public-facing page that runs outside the main CMS app and does
  // not load ModuleRegistry. Direct window.* assignment is intentional here.
  window.entryFormApp = {
    currentStep: 0,
    totalSteps: 8,
    formData: {},
    selectedAwardCategory: null,
    selectedSector: null,

    // Step labels for progress bar
    stepLabels: ['Region', 'Sector', 'Category', 'Company', 'About', 'Support', 'Contact', 'Review'],

    // --------------------------------------------------
    // Initialize
    // --------------------------------------------------
    async initialize() {
      this.buildProgressBar();
      this.populateRegions();
      this.populateSectors();
      this.setupCharCounters();
      this.setupTermsCheckbox();
      this.updateProgressIndicator(0);
      this._checkDraftRestore();
      this._applyUrlParams();

      // Wire step 0 self-nominate button
      document.getElementById('selfNominateBtn')?.addEventListener('click', () => {
        this.goToStep(1);
      });
    },

    // Pre-populate form from URL params (deep links from home.html chips/category cards)
    _applyUrlParams() {
      const params = new URLSearchParams(window.location.search);
      const country = params.get('country');
      const region = params.get('region');
      const city = params.get('city');
      const sector = params.get('sector');
      const category = params.get('category');

      // Country → region → city cascade (synchronous, uses REGION_DATA)
      if (country) {
        this.handleCountrySelect(country);
        if (region) {
          const regionEl = document.getElementById('region_group');
          if (regionEl) {
            regionEl.value = region;
            this.handleRegionGroupChange();
            if (city) {
              const cityEl = document.getElementById('county_city');
              if (cityEl) cityEl.value = city;
            }
          }
        }
      }

      // Sector + category — config.js is a module (deferred), so read after window load
      if (sector || category) {
        const applySelects = () => {
          if (sector) {
            const sectorEl = document.getElementById('sector');
            if (sectorEl) sectorEl.value = sector;
          }
          if (category) {
            const awardCatEl = document.getElementById('awardCategory');
            if (awardCatEl) awardCatEl.value = category;
          }
        };
        if (document.readyState === 'complete') {
          applySelects();
        } else {
          window.addEventListener('load', applySelects, { once: true });
        }
      }
    },

    _checkDraftRestore() {
      if (typeof localStorage === 'undefined') return;
      const draft = localStorage.getItem('bta_entry_draft');
      if (!draft) return;
      const banner = document.createElement('div');
      banner.id = 'draftRestoreBanner';
      banner.className = 'alert alert-info d-flex align-items-center gap-3 mb-3';
      banner.innerHTML = `
        <i class="bi bi-cloud-arrow-down-fill fs-5"></i>
        <span class="flex-grow-1">We found a saved draft from your last visit.</span>
        <button class="btn btn-sm btn-primary" id="restoreDraftBtn">Restore</button>
        <button class="btn btn-sm btn-outline-secondary" id="discardDraftBtn">Start fresh</button>
      `;
      document.getElementById('step1')?.prepend(banner);
      document.getElementById('restoreDraftBtn')?.addEventListener('click', () => {
        try {
          this.formData = JSON.parse(draft);
        } catch (_) {
          /* ignore */
        }
        banner.remove();
        if (window.utils?.showToast) {
          utils.showToast('Draft restored from autosave', 'success');
        } else {
          const notice = document.createElement('div');
          notice.className = 'alert alert-success alert-dismissible';
          notice.textContent = 'Draft restored from autosave.';
          document.querySelector('.entry-wizard')?.prepend(notice);
        }
      });
      document.getElementById('discardDraftBtn')?.addEventListener('click', () => {
        localStorage.removeItem('bta_entry_draft');
        banner.remove();
      });
    },

    _saveDraft() {
      try {
        if (typeof localStorage !== 'undefined') localStorage.setItem('bta_entry_draft', JSON.stringify(this.formData));
      } catch (_) {
        /* ignore */
      }
    },

    // --------------------------------------------------
    // Build progress bar dots from stepLabels
    // --------------------------------------------------
    buildProgressBar() {
      const container = document.getElementById('progressSteps');
      // Keep the track element
      const track = document.getElementById('progressTrack');
      container.innerHTML = '';
      container.appendChild(track);

      this.stepLabels.forEach((label, i) => {
        const wrap = document.createElement('div');
        wrap.className = 'progress-step-wrap';
        wrap.innerHTML = `
        <div class="progress-dot" data-step="${i + 1}"></div>
        <div class="step-label" data-step="${i + 1}">${label}</div>
      `;
        container.appendChild(wrap);
      });
    },

    // --------------------------------------------------
    // Populate sectors dropdown from config.js SECTORS
    // --------------------------------------------------
    populateSectors() {
      const sectorSelect = document.getElementById('sector');
      if (!window.SECTORS || window.SECTORS.length === 0) {
        console.warn('No sectors found in config');
        return;
      }
      const options = window.SECTORS.map(
        (sector) => `<option value="${this.escapeHtml(sector)}">${this.escapeHtml(this.toTitleCase(sector))}</option>`
      ).join('');
      sectorSelect.innerHTML = '<option value="">Choose your sector...</option>' + options;
    },

    // --------------------------------------------------
    // Set up country flag card handlers (step 1 — first of three levels)
    // --------------------------------------------------
    populateRegions() {
      document.querySelectorAll('#country_picker .country-pick-btn').forEach((btn) => {
        btn.addEventListener('click', () => this.handleCountrySelect(btn.dataset.country));
      });
      // Wire region select change once (select exists in DOM from load)
      const regionGroupSelect = document.getElementById('region_group');
      if (regionGroupSelect) {
        regionGroupSelect.addEventListener('change', () => this.handleRegionGroupChange());
      }
      // Wire county_city change to show borough picker when London is selected
      const countyCitySelect = document.getElementById('county_city');
      if (countyCitySelect) {
        countyCitySelect.addEventListener('change', () => this.handleCountyCityChange());
      }
    },

    // Country card clicked → populate county/city select directly with optgroups
    handleCountrySelect(country) {
      document.querySelectorAll('#country_picker .country-pick-btn').forEach((btn) => {
        const active = btn.dataset.country === country;
        btn.classList.toggle('selected', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      });

      const countryInput = document.getElementById('selected_country');
      if (countryInput) countryInput.value = country;

      // Clear any country-level error
      const picker = document.getElementById('country_picker');
      if (picker) {
        const fb = picker.nextElementSibling;
        if (fb && fb.classList.contains('invalid-feedback')) fb.style.display = 'none';
      }

      const countySelect = document.getElementById('county_city');
      const countyWrapper = document.getElementById('county_city_wrapper');
      const regionWrapper = document.getElementById('region_wrapper');

      // Always hide the region group picker (we go direct to county/city)
      if (regionWrapper) regionWrapper.style.display = 'none';

      if (!countySelect || !countyWrapper) return;

      const regions = (window.REGION_DATA || {})[country] || {};
      countySelect.innerHTML = '<option value="">Select your county or city</option>';

      Object.keys(regions).forEach((groupName) => {
        const optgroup = document.createElement('optgroup');
        optgroup.label = groupName;
        (regions[groupName] || []).forEach((val) => {
          const el = document.createElement('option');
          el.value = val;
          el.textContent = val;
          optgroup.appendChild(el);
        });
        countySelect.appendChild(optgroup);
      });

      countyWrapper.style.display = 'block';
      this._hideBoroughPicker?.();
      setTimeout(() => countySelect.focus(), 50);
    },

    // Region selected → show county/city/borough select
    handleRegionGroupChange() {
      const country = document.getElementById('selected_country')?.value;
      const groupName = document.getElementById('region_group')?.value;
      const wrapper = document.getElementById('county_city_wrapper');
      const countySelect = document.getElementById('county_city');
      if (!wrapper || !countySelect) return;

      countySelect.value = '';
      countySelect.innerHTML = '<option value="">Select your county, city or borough</option>';
      this._hideBoroughPicker();

      if (!groupName) {
        wrapper.style.display = 'none';
        return;
      }

      const regions = (window.REGION_DATA || {})[country] || {};
      const options = regions[groupName] || [];

      options.forEach((opt) => {
        const el = document.createElement('option');
        el.value = opt;
        el.textContent = opt;
        countySelect.appendChild(el);
      });

      wrapper.style.display = 'block';
      setTimeout(() => countySelect.focus(), 50);
    },

    // City/county selected → show London Borough picker if London chosen
    handleCountyCityChange() {
      const countySelect = document.getElementById('county_city');
      if (countySelect?.value === 'London') {
        this._showBoroughPicker();
      } else {
        this._hideBoroughPicker();
      }
    },

    _showBoroughPicker() {
      const wrapper = document.getElementById('borough_wrapper');
      const boroughSelect = document.getElementById('london_borough');
      if (!wrapper || !boroughSelect) return;
      boroughSelect.innerHTML = '<option value="">Select your London borough</option>';
      const boroughs = window.LONDON_BOROUGHS || [];
      boroughs.forEach((b) => {
        const el = document.createElement('option');
        el.value = b;
        el.textContent = b;
        boroughSelect.appendChild(el);
      });
      wrapper.style.display = 'block';
      setTimeout(() => boroughSelect.focus(), 50);
    },

    _hideBoroughPicker() {
      const wrapper = document.getElementById('borough_wrapper');
      const boroughSelect = document.getElementById('london_borough');
      if (wrapper) wrapper.style.display = 'none';
      if (boroughSelect) {
        boroughSelect.value = '';
        boroughSelect.innerHTML = '<option value="">Select your London borough</option>';
      }
    },

    // --------------------------------------------------
    // Setup character counters on textareas
    // --------------------------------------------------
    setupCharCounters() {
      const counters = [
        { field: 'entryDescription', display: 'descCharCount', max: 1000 },
        { field: 'whyShouldWin', display: 'whyCharCount', max: 2000 },
        { field: 'supportingInfo', display: 'supportCharCount', max: 1500 },
        { field: 'nomineeWorkDesc', display: 'workDescCharCount', max: 1000 },
      ];

      counters.forEach(({ field, display, max }) => {
        const el = document.getElementById(field);
        const counter = document.getElementById(display);
        if (el && counter) {
          el.addEventListener('input', () => {
            const len = el.value.length;
            const remaining = max - len;
            const isWarn = len > max * 0.9;
            counter.classList.toggle('warn', isWarn);
            if (isWarn) {
              counter.textContent = `${remaining >= 0 ? remaining : 0} characters remaining (max ${max.toLocaleString()})`;
            } else {
              counter.textContent = `${len.toLocaleString()} / ${max.toLocaleString()}`;
            }
          });
        }
      });
    },

    // --------------------------------------------------
    // Setup terms checkbox to enable/disable submit
    // --------------------------------------------------
    setupTermsCheckbox() {
      const checkbox = document.getElementById('termsCheckbox');
      const submitBtn = document.getElementById('submitBtn');
      if (checkbox && submitBtn) {
        checkbox.addEventListener('change', () => {
          const isDisabled = !checkbox.checked;
          submitBtn.disabled = isDisabled;
          submitBtn.setAttribute('aria-disabled', String(isDisabled));
        });
      }
    },

    // --------------------------------------------------
    // Get categories for a given region
    // --------------------------------------------------
    getCategoriesForRegion(region) {
      const isSmall = SMALL_COUNTIES.some((c) => c.toLowerCase() === region.toLowerCase());
      return isSmall ? SMALL_CATEGORIES : STANDARD_CATEGORIES;
    },

    // --------------------------------------------------
    // Build award category list for selected sector + region
    // --------------------------------------------------
    async buildCategoryList() {
      const awardsList = document.getElementById('awardsList');
      const countyCity = this.formData.county_city || '';
      const sector = this.formData.sector || '';

      if (!countyCity || !sector) {
        awardsList.innerHTML = '<div class="alert alert-warning">Please complete the previous steps first.</div>';
        return;
      }

      const isSmall = SMALL_COUNTIES.some((c) => c.toLowerCase() === countyCity.toLowerCase());
      const baseCategories = this.getCategoriesForRegion(countyCity);

      // Clone the base category map so we don't mutate the hardcoded constant
      const mergedCategories = {};
      Object.keys(baseCategories).forEach((k) => {
        mergedCategories[k] = [...baseCategories[k]];
      });

      // Fetch and merge custom sectors & categories
      try {
        const publicDataRes = await fetch('/api/entry-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_public_data' }),
        }).then((r) => r.json());
        const customSectors = publicDataRes?.custom_sectors || [];
        const customCats = publicDataRes?.custom_categories || [];
        // Merge custom sectors into the category map
        customSectors.forEach((s) => {
          if (!mergedCategories[s.name]) mergedCategories[s.name] = [];
        });
        // Merge custom categories
        customCats.forEach((c) => {
          if (isSmall && !c.available_for_small) return; // respect small-area filter
          if (!mergedCategories[c.sector_name]) mergedCategories[c.sector_name] = [];
          if (!mergedCategories[c.sector_name].includes(c.name)) mergedCategories[c.sector_name].push(c.name);
        });
      } catch (_) {
        /* silently fall back to hardcoded only */
      }

      const sectorCategories = mergedCategories[sector] || [];

      if (sectorCategories.length === 0) {
        awardsList.innerHTML = `
        <div class="alert alert-warning">
          <i class="bi bi-exclamation-triangle me-2"></i>
          No award categories found for <strong>${this.escapeHtml(this.toTitleCase(sector))}</strong> in <strong>${this.escapeHtml(countyCity)}</strong>.
        </div>`;
        return;
      }

      const subtitle = document.getElementById('step3Subtitle');
      if (subtitle) {
        subtitle.textContent = `${sectorCategories.length} categories available for ${this.toTitleCase(sector)} in ${countyCity}`;
      }

      awardsList.innerHTML = sectorCategories
        .map(
          (cat, idx) => `
      <div class="award-option" data-category-index="${idx}" role="button" tabindex="0">
        <div class="award-check">
          <i class="bi bi-check" style="display:none; font-size:14px; font-weight:900;"></i>
        </div>
        <span class="award-name">${this.escapeHtml(cat)}</span>
      </div>
    `
        )
        .join('');

      // Attach click and keyboard handlers via addEventListener
      awardsList.querySelectorAll('.award-option').forEach((opt) => {
        opt.addEventListener('click', () => {
          const idx = parseInt(opt.dataset.categoryIndex);
          this.selectCategory(sectorCategories[idx], opt);
        });
        opt.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') opt.click();
        });
      });

      // Reset selection
      this.selectedAwardCategory = null;
      document.getElementById('step3NextBtn').style.display = 'none';
    },

    // --------------------------------------------------
    // Select an award category
    // --------------------------------------------------
    selectCategory(categoryName, element) {
      document.querySelectorAll('.award-option').forEach((opt) => {
        opt.classList.remove('selected');
        const icon = opt.querySelector('.bi-check');
        if (icon) icon.style.display = 'none';
      });

      element.classList.add('selected');
      const icon = element.querySelector('.bi-check');
      if (icon) icon.style.display = 'block';

      this.selectedAwardCategory = categoryName;
      document.getElementById('step3NextBtn').style.display = 'block';
    },

    // --------------------------------------------------
    // Navigation
    // --------------------------------------------------
    async nextStep(currentStepNum) {
      if (!this.validateStep(currentStepNum)) return;
      this.saveStepData(currentStepNum);
      this._saveDraft();

      // Build category list after sector is selected (step 2)
      if (currentStepNum === 2) {
        await this.buildCategoryList();
      }

      // Build review before showing step 8
      if (currentStepNum === 7) {
        this.showReview();
      }

      this.goToStep(currentStepNum + 1);
    },

    prevStep(currentStepNum) {
      this.goToStep(currentStepNum - 1);
    },

    goToStep(stepNum) {
      document.querySelectorAll('.form-step').forEach((s) => s.classList.remove('active'));
      const target = document.getElementById(`step${stepNum}`);
      if (target) {
        target.classList.add('active');
        // Move focus to step heading for keyboard/screen-reader users
        const heading = target.querySelector('h2, h3, [tabindex]');
        if (heading) {
          if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
          heading.focus({ preventScroll: true });
        }
      }
      this.updateProgressIndicator(stepNum);
      this.currentStep = stepNum;
      // Hide progress bar on step 0 (entry type chooser)
      const progressWrapper = document.getElementById('progressWrapper');
      if (progressWrapper) {
        progressWrapper.style.display = stepNum === 0 ? 'none' : '';
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    // --------------------------------------------------
    // Update progress bar
    // --------------------------------------------------
    updateProgressIndicator(stepNum) {
      const dots = document.querySelectorAll('.progress-dot');
      const labels = document.querySelectorAll('.step-label');
      const track = document.getElementById('progressTrack');

      dots.forEach((dot, i) => {
        dot.classList.remove('active', 'completed');
        dot.removeAttribute('aria-current');
        if (i < stepNum - 1) dot.classList.add('completed');
        else if (i === stepNum - 1) {
          dot.classList.add('active');
          dot.setAttribute('aria-current', 'step');
        }
      });

      labels.forEach((label, i) => {
        label.classList.remove('active', 'completed');
        if (i < stepNum - 1) label.classList.add('completed');
        else if (i === stepNum - 1) label.classList.add('active');
      });

      // Track width
      if (track && this.totalSteps > 1) {
        const pct = ((stepNum - 1) / (this.totalSteps - 1)) * 100;
        track.style.width = pct + '%';
      }

      // Hide progress on step 0 (chooser) and on success
      const wrapper = document.getElementById('progressWrapper');
      if (wrapper) {
        wrapper.style.display = stepNum === 0 || stepNum > this.totalSteps ? 'none' : '';
      }
    },

    // --------------------------------------------------
    // Validation helpers
    // --------------------------------------------------
    _markInvalid(input, message) {
      input.classList.add('is-invalid');
      let fb = input.nextElementSibling;
      if (!fb || !fb.classList.contains('invalid-feedback')) {
        fb = document.createElement('div');
        fb.className = 'invalid-feedback';
        input.parentNode.insertBefore(fb, input.nextSibling);
      }
      fb.textContent = message;
      input.addEventListener('input', () => input.classList.remove('is-invalid'), { once: true });
      if (typeof input.scrollIntoView === 'function') {
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    },

    // --------------------------------------------------
    // Validation
    // --------------------------------------------------
    validateStep(stepNum) {
      switch (stepNum) {
        case 1: {
          const country = document.getElementById('selected_country')?.value;
          if (!country) {
            const picker = document.getElementById('country_picker');
            if (picker) {
              let fb = picker.nextElementSibling;
              if (!fb || !fb.classList.contains('invalid-feedback')) {
                fb = document.createElement('div');
                fb.className = 'invalid-feedback';
                picker.parentNode.insertBefore(fb, picker.nextSibling);
              }
              fb.style.display = 'block';
              fb.textContent = 'Please select your country';
              picker.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return false;
          }
          const countyCity = document.getElementById('county_city');
          if (!countyCity?.value) {
            this._markInvalid(countyCity, 'Please select your county or city');
            return false;
          }
          if (countyCity?.value === 'London') {
            const boroughEl = document.getElementById('london_borough');
            if (!boroughEl?.value) {
              this._markInvalid(boroughEl, 'Please select your London borough');
              return false;
            }
          }
          return true;
        }
        case 2: {
          const sector = document.getElementById('sector');
          if (!sector.value) {
            this._markInvalid(sector, 'Please select a sector');
            return false;
          }
          return true;
        }
        case 3: {
          if (!this.selectedAwardCategory) {
            showPublicToast('Please select an award category');
            return false;
          }
          return true;
        }
        case 4: {
          const nameEl = document.getElementById('companyName');
          const name = nameEl.value.trim();
          if (!name) {
            this._markInvalid(nameEl, 'Please enter your company name');
            return false;
          }
          if (name.length < 2) {
            this._markInvalid(nameEl, 'Company name must be at least 2 characters');
            return false;
          }
          const yearsEl = document.getElementById('yearsInField');
          if (!yearsEl.value) {
            this._markInvalid(yearsEl, 'Please select years in business');
            return false;
          }
          return true;
        }
        case 5: {
          const descEl = document.getElementById('entryDescription');
          const desc = descEl.value.trim();
          if (!desc) {
            this._markInvalid(descEl, 'Please provide a description of your business');
            return false;
          }
          if (desc.length < 20) {
            this._markInvalid(descEl, 'Please provide a more detailed description (at least 20 characters)');
            return false;
          }
          return true;
        }
        case 6: {
          const whyEl = document.getElementById('whyShouldWin');
          const why = whyEl ? whyEl.value.trim() : '';
          if (!why) {
            this._markInvalid(whyEl, 'Please tell us why you should win this award');
            return false;
          }
          if (why.length < 20) {
            this._markInvalid(whyEl, 'Please provide more detail on why you should win (at least 20 characters)');
            return false;
          }
          return true;
        }
        case 7: {
          const contactNameEl = document.getElementById('contactName');
          const contactEmailEl = document.getElementById('contactEmail');
          if (!contactNameEl.value.trim()) {
            this._markInvalid(contactNameEl, 'Please enter your name');
            return false;
          }
          if (!contactEmailEl.value.trim()) {
            this._markInvalid(contactEmailEl, 'Please enter your email address');
            return false;
          }
          if (!this.validateEmail(contactEmailEl.value.trim())) {
            this._markInvalid(contactEmailEl, 'Please enter a valid email address');
            return false;
          }
          const phoneEl = document.getElementById('contactPhone');
          if (!phoneEl?.value.trim()) {
            this._markInvalid(phoneEl, 'Please enter your phone number');
            return false;
          }
          return true;
        }
        default:
          return true;
      }
    },

    validateEmail(email) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },

    // --------------------------------------------------
    // Save step data
    // --------------------------------------------------
    saveStepData(stepNum) {
      switch (stepNum) {
        case 1:
          this.formData.selected_country = document.getElementById('selected_country')?.value || '';
          this.formData.region_group = '';
          this.formData.county_city = document.getElementById('county_city')?.value || '';
          this.formData.london_borough = '';
          break;
        case 2:
          this.formData.sector = document.getElementById('sector').value;
          break;
        case 3:
          this.formData.awardCategory = this.selectedAwardCategory;
          break;
        case 4:
          this.formData.companyName = document.getElementById('companyName').value.trim();
          this.formData.companyWebsite = document.getElementById('companyWebsite').value.trim();
          this.formData.yearsInField = document.getElementById('yearsInField').value;
          this.formData.employeeCount = document.getElementById('employeeCount').value;
          break;
        case 5:
          this.formData.entryDescription = document.getElementById('entryDescription').value.trim();
          break;
        case 6:
          this.formData.whyShouldWin = document.getElementById('whyShouldWin')?.value.trim() || '';
          this.formData.supportingInfo = document.getElementById('supportingInfo').value.trim();
          this.formData.tradeBodies = document.getElementById('tradeBodies').value.trim();
          this.formData.accreditations = document.getElementById('accreditations').value.trim();
          break;
        case 7:
          this.formData.contactName = document.getElementById('contactName').value.trim();
          this.formData.contactPosition = document.getElementById('contactPosition').value.trim();
          this.formData.contactEmail = document.getElementById('contactEmail').value.trim();
          this.formData.contactPhone = document.getElementById('contactPhone').value.trim();
          break;
      }
    },

    // --------------------------------------------------
    // Show review
    // --------------------------------------------------
    showReview() {
      const d = this.formData;
      const reviewContent = document.getElementById('reviewContent');

      const row = (label, value) =>
        value
          ? `<div class="review-row"><span class="review-label">${label}</span><span class="review-value">${this.escapeHtml(value)}</span></div>`
          : '';

      const textBlock = (text) =>
        text
          ? `<div class="review-text-block">${this.escapeHtml(text)}</div>`
          : '<div class="review-text-block" style="color:#999; font-style:italic;">Not provided</div>';

      reviewContent.innerHTML = `
      <div class="review-group">
        <div class="review-group-title">
          Award Details
          <span class="review-edit-btn float-end" data-action="entryFormApp.goToStep" data-args="[1]">Edit</span>
        </div>
        ${row('Location', [this.toTitleCase((d.selected_country || '').replace(/-/g, ' ')), d.region_group, d.county_city, d.london_borough].filter(Boolean).join(' › '))}
        ${row('Sector', this.toTitleCase(d.sector || ''))}
        ${row('Category', d.awardCategory)}
      </div>

      <div class="review-group">
        <div class="review-group-title">
          Company Information
          <span class="review-edit-btn float-end" data-action="entryFormApp.goToStep" data-args="[4]">Edit</span>
        </div>
        ${row('Company Name', d.companyName)}
        ${row('Website', d.companyWebsite)}
        ${row('Years in Business', d.yearsInField)}
        ${row('Employees', d.employeeCount)}
      </div>

      <div class="review-group">
        <div class="review-group-title">
          About Your Entry
          <span class="review-edit-btn float-end" data-action="entryFormApp.goToStep" data-args="[5]">Edit</span>
        </div>
        <div class="review-row"><span class="review-label">Description</span></div>
        ${textBlock(d.entryDescription)}
        <div class="review-row mt-2"><span class="review-label">Why You Should Win</span></div>
        ${textBlock(d.whyShouldWin)}
      </div>

      ${
        d.supportingInfo || d.tradeBodies || d.accreditations
          ? `
      <div class="review-group">
        <div class="review-group-title">
          Supporting Information
          <span class="review-edit-btn float-end" data-action="entryFormApp.goToStep" data-args="[6]">Edit</span>
        </div>
        ${d.supportingInfo ? `<div class="review-row"><span class="review-label">Additional Info</span></div>${textBlock(d.supportingInfo)}` : ''}
        ${row('Trade Bodies', d.tradeBodies)}
        ${row('Accreditations', d.accreditations)}
      </div>
      `
          : ''
      }

      <div class="review-group">
        <div class="review-group-title">
          Contact Details
          <span class="review-edit-btn float-end" data-action="entryFormApp.goToStep" data-args="[7]">Edit</span>
        </div>
        ${row('Name', d.contactName)}
        ${row('Position', d.contactPosition)}
        ${row('Email', d.contactEmail)}
        ${row('Phone', d.contactPhone)}
      </div>
    `;

      // Reset terms checkbox
      const checkbox = document.getElementById('termsCheckbox');
      const submitBtn = document.getElementById('submitBtn');
      if (checkbox) checkbox.checked = false;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.setAttribute('aria-disabled', 'true');
      }
    },

    // --------------------------------------------------
    // Submit entry to Supabase
    // --------------------------------------------------
    async submitEntry() {
      const submitBtn = document.getElementById('submitBtn');
      const originalText = submitBtn.innerHTML;

      try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Submitting...';

        // Submit via server-side proxy (no direct DB access)
        const result = await entryApi({
          action: 'submit_entry',
          companyName: this.formData.companyName,
          selected_country: this.formData.selected_country,
          region_group: this.formData.region_group,
          county_city: this.formData.county_city,
          london_borough: this.formData.london_borough || '',
          sector: this.formData.sector,
          contactEmail: this.formData.contactEmail,
          contactName: this.formData.contactName,
          contactPhone: this.formData.contactPhone,
          companyWebsite: this.formData.companyWebsite,
          awardCategory: this.formData.awardCategory,
          entryDescription: this.formData.entryDescription,
          whyShouldWin: this.formData.whyShouldWin,
          supportingInfo: this.formData.supportingInfo,
          tradeBodies: this.formData.tradeBodies,
          accreditations: this.formData.accreditations,
          employeeCount: this.formData.employeeCount,
          contactPosition: this.formData.contactPosition,
        });

        const entryNumber = result.entry.entry_number;
        const entryId = result.entry.id;
        const entryFee = Number(result.entry_fee) || 0;

        // Clear any saved draft on successful submission
        try {
          if (typeof localStorage !== 'undefined') localStorage.removeItem('bta_entry_draft');
        } catch (_) {
          /* ignore */
        }

        // If there is an entry fee, redirect to Stripe Checkout
        if (entryFee > 0 && entryId) {
          submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Redirecting to payment...';
          const checkoutRes = await fetch('/api/stripe-payment?action=public-checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entry_id: entryId, amount: entryFee }),
          });
          const checkoutData = await checkoutRes.json();
          if (checkoutData.url) {
            window.location.href = checkoutData.url;
            return;
          }
          // If checkout fails, fall through to success page (fee collected manually)
        }

        // Show success
        document.getElementById('entryReference').textContent = entryNumber;
        const successCompany = document.getElementById('success-company');
        const successCategory = document.getElementById('success-category');
        if (successCompany) successCompany.textContent = this.formData.companyName || '';
        if (successCategory) successCategory.textContent = this.formData.awardCategory || '';
        document.querySelectorAll('.form-step').forEach((s) => s.classList.remove('active'));
        document.getElementById('stepSuccess').classList.add('active');

        // Hide progress bar
        const wrapper = document.getElementById('progressWrapper');
        if (wrapper) wrapper.style.display = 'none';

        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (error) {
        console.error('Submission error:', error);
        showPublicToast('Error submitting entry: ' + error.message, 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    },

    // Entry number generation is now handled server-side via /api/entry-proxy

    // --------------------------------------------------
    // Utilities
    // --------------------------------------------------
    toTitleCase(str) {
      if (!str) return '';
      return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
    },

    escapeHtml(text) {
      if (!text) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    },
  };

  // Alias for convenience
  const entryFormApp = window.entryFormApp;

  // Initialize on page load
  document.addEventListener('DOMContentLoaded', function () {
    entryFormApp.initialize();
  });

  // Lightweight event delegation for data-action buttons (public pages
  // don't load the admin actionRegistry from utils.js)
  document.addEventListener('click', function (e) {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    if (el.dataset.preventDefault === 'true') e.preventDefault();
    const actionName = el.dataset.action;
    const parts = actionName.split('.');
    let ctx = /** @type {any} */ (window);
    let fn = /** @type {any} */ (window);
    for (let i = 0; i < parts.length; i++) {
      ctx = fn;
      fn = fn[parts[i]];
      if (!fn) return;
    }
    if (typeof fn !== 'function') return;
    let args = [];
    if (el.dataset.args) {
      try {
        args = JSON.parse(el.dataset.args);
      } catch (_e) {
        return;
      }
    }
    fn.apply(ctx, args);
  });
})(); // end IIFE

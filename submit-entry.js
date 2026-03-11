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
    'INTERIOR FIT-OUT & FINISHING': [
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
    'INTERIOR FIT-OUT & FINISHING': [
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
      'Security Systems Installer',
    ],
    'SPECIALIST TRADES': [
      'Locksmith',
      'Pest Control Company',
      'Rendering Company',
      'Scaffolding Company',
      'Window & Door Installer',
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
    toast.style.cssText = `background:${colors[type] || colors.warning};color:${textColors[type] || '#000'};padding:12px 20px;margin-bottom:8px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.15);font-size:14px;opacity:0;transition:opacity .3s;font-family:'Montserrat',sans-serif;text-align:center;`;
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
    currentStep: 1,
    totalSteps: 8,
    formData: {},
    selectedAwardCategory: null,
    selectedSector: null,
    regionChoicesInstance: null,

    // Step labels for progress bar
    stepLabels: ['Region', 'Sector', 'Category', 'Company', 'About', 'Extra', 'Contact', 'Review'],

    // --------------------------------------------------
    // Initialize
    // --------------------------------------------------
    async initialize() {
      this.buildProgressBar();
      this.populateRegions();
      this.populateSectors();
      this.setupCharCounters();
      this.setupTermsCheckbox();
      this.updateProgressIndicator(1);
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
    // Populate county/city dropdown from config.js COUNTIES_CITIES
    // --------------------------------------------------
    populateRegions() {
      const regionSelect = document.getElementById('county_city');
      if (!window.COUNTIES_CITIES && !window.REGIONS) {
        console.warn('No counties/cities found in config');
        return;
      }

      // Known cities list for grouping
      const cities = [
        'Birmingham',
        'Bournemouth',
        'Bradford',
        'Brighton & Hove',
        'Bristol',
        'Cardiff',
        'Coventry',
        'Edinburgh',
        'Glasgow',
        'Leeds',
        'Leicester',
        'Liverpool',
        'London, North',
        'London, South',
        'London, East',
        'London, West',
        'Manchester',
        'Middlesborough',
        'Newcastle',
        'Nottingham',
        'Sheffield',
        'Southampton',
        'Swansea',
      ];

      const allCountiesCities = window.COUNTIES_CITIES || window.REGIONS || [];
      const counties = allCountiesCities.filter((r) => !cities.includes(r));
      const cityList = allCountiesCities.filter((r) => cities.includes(r));

      let html = '<option value="" placeholder>Select your county or city</option>';

      if (counties.length > 0) {
        html += '<optgroup label="Counties">';
        counties.forEach((county) => {
          html += `<option value="${this.escapeHtml(county)}">${this.escapeHtml(county)}</option>`;
        });
        html += '</optgroup>';
      }

      if (cityList.length > 0) {
        html += '<optgroup label="Cities">';
        cityList.forEach((city) => {
          html += `<option value="${this.escapeHtml(city)}">${this.escapeHtml(city)}</option>`;
        });
        html += '</optgroup>';
      }

      regionSelect.innerHTML = html;

      // Initialize Choices.js
      if (typeof Choices !== 'undefined') {
        this.regionChoicesInstance = new Choices('#county_city', {
          searchEnabled: true,
          searchFloor: 1,
          searchPlaceholderValue: 'Type to search...',
          placeholder: true,
          placeholderValue: 'Select your county or city',
          itemSelectText: '',
          shouldSort: false,
          searchResultLimit: 100,
          allowHTML: true,
        });
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
      ];

      counters.forEach(({ field, display, max }) => {
        const el = document.getElementById(field);
        const counter = document.getElementById(display);
        if (el && counter) {
          el.addEventListener('input', () => {
            const len = el.value.length;
            counter.textContent = `${len.toLocaleString()} / ${max.toLocaleString()}`;
            counter.classList.toggle('warn', len > max * 0.9);
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
          submitBtn.disabled = !checkbox.checked;
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
    buildCategoryList() {
      const awardsList = document.getElementById('awardsList');
      const countyCity = this.formData.county_city || '';
      const sector = this.formData.sector || '';

      if (!countyCity || !sector) {
        awardsList.innerHTML = '<div class="alert alert-warning">Please complete the previous steps first.</div>';
        return;
      }

      const categories = this.getCategoriesForRegion(countyCity);
      const sectorCategories = categories[sector] || [];

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

      // Build category list after sector is selected (step 2)
      if (currentStepNum === 2) {
        this.buildCategoryList();
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
      }
      this.updateProgressIndicator(stepNum);
      this.currentStep = stepNum;
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

      // Hide progress on success
      const wrapper = document.getElementById('progressWrapper');
      if (wrapper) {
        wrapper.style.display = stepNum > this.totalSteps ? 'none' : '';
      }
    },

    // --------------------------------------------------
    // Validation
    // --------------------------------------------------
    validateStep(stepNum) {
      switch (stepNum) {
        case 1: {
          const countyCity = document.getElementById('county_city').value;
          if (!countyCity) {
            showPublicToast('Please select your county or city');
            return false;
          }
          return true;
        }
        case 2: {
          const sector = document.getElementById('sector').value;
          if (!sector) {
            showPublicToast('Please select a sector');
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
          const name = document.getElementById('companyName').value.trim();
          if (!name) {
            showPublicToast('Please enter your company name');
            return false;
          }
          if (name.length < 2) {
            showPublicToast('Company name must be at least 2 characters');
            return false;
          }
          const years = document.getElementById('yearsInField').value;
          if (!years) {
            showPublicToast('Please select years in business');
            return false;
          }
          return true;
        }
        case 5: {
          const desc = document.getElementById('entryDescription').value.trim();
          if (!desc) {
            showPublicToast('Please provide a description of your business');
            return false;
          }
          if (desc.length < 20) {
            showPublicToast('Please provide a more detailed description (at least 20 characters)');
            return false;
          }
          const why = document.getElementById('whyShouldWin').value.trim();
          if (!why) {
            showPublicToast('Please tell us why you should win this award');
            return false;
          }
          if (why.length < 20) {
            showPublicToast('Please provide more detail on why you should win (at least 20 characters)');
            return false;
          }
          return true;
        }
        case 6: {
          // All fields optional - always valid
          return true;
        }
        case 7: {
          const contactName = document.getElementById('contactName').value.trim();
          const contactEmail = document.getElementById('contactEmail').value.trim();
          const contactPhone = document.getElementById('contactPhone').value.trim();
          if (!contactName) {
            showPublicToast('Please enter your name');
            return false;
          }
          if (!contactEmail) {
            showPublicToast('Please enter your email address');
            return false;
          }
          if (!this.validateEmail(contactEmail)) {
            showPublicToast('Please enter a valid email address');
            return false;
          }
          if (!contactPhone) {
            showPublicToast('Please enter your phone number');
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
          this.formData.county_city = document.getElementById('county_city').value;
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
          this.formData.whyShouldWin = document.getElementById('whyShouldWin').value.trim();
          break;
        case 6:
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
        ${row('County / City', d.county_city)}
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
      if (submitBtn) submitBtn.disabled = true;
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
          county_city: this.formData.county_city,
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

        // Show success
        document.getElementById('entryReference').textContent = entryNumber;
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
    var el = e.target.closest('[data-action]');
    if (!el) return;
    if (el.dataset.preventDefault === 'true') e.preventDefault();
    var actionName = el.dataset.action;
    var parts = actionName.split('.');
    var ctx = window;
    var fn = window;
    for (var i = 0; i < parts.length; i++) {
      ctx = fn;
      fn = fn[parts[i]];
      if (!fn) return;
    }
    if (typeof fn !== 'function') return;
    var args = [];
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

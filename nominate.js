/* ==================================================== */
/* INDUSTRY LEADERSHIP NOMINATION FORM                  */
/* Allows the public to nominate individuals for        */
/* leadership & special recognition awards              */
/* ==================================================== */
(function () {
  'use strict';

  // API proxy for nomination submission (no direct DB access)
  async function nominationApi(payload) {
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
  // NOMINATION CATEGORIES
  // These are INTENTIONALLY different from config.js STANDARD_CATEGORIES.
  // STANDARD_CATEGORIES covers trade company/business award categories.
  // NOMINATION_CATEGORIES covers peer-nominated individual leadership &
  // special recognition awards — they are a separate award programme.
  // =====================================================

  const NOMINATION_CATEGORIES = [
    {
      name: 'Above & Beyond',
      description: 'Recognising outstanding leadership within the trade industry',
      icon: 'bi-star-fill',
    },
    {
      name: 'Apprentice of The Year',
      description: 'Celebrating exceptional apprentices making their mark',
      icon: 'bi-mortarboard-fill',
    },
    {
      name: 'Lifetime Achievement',
      description: 'Honouring a career of dedication and excellence in the trades',
      icon: 'bi-award-fill',
    },
    {
      name: 'Community Impact Award',
      description: 'For those making a real difference in their local community',
      icon: 'bi-people-fill',
    },
    {
      name: 'Female Tradesperson of the Year',
      description: 'Celebrating outstanding women in the trade industry',
      icon: 'bi-person-fill',
    },
    {
      name: 'Male Tradesperson of the Year',
      description: 'Celebrating outstanding men in the trade industry',
      icon: 'bi-person-fill',
    },
    {
      name: 'Young Tradesperson of the Year',
      description: 'For exceptional tradespeople under 25 years old',
      icon: 'bi-lightning-fill',
    },
    {
      name: 'New Business of the Year',
      description: 'Recognising the best new trade businesses',
      icon: 'bi-building',
    },
  ];

  // =====================================================
  // Lightweight toast for public pages
  // =====================================================
  function showPublicToast(msg, type) {
    type = type || 'warning';
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
    toast.style.cssText =
      'background:' +
      (colors[type] || colors.warning) +
      ';color:' +
      (textColors[type] || '#000') +
      ";padding:12px 20px;margin-bottom:8px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.15);font-size:14px;opacity:0;transition:opacity .3s;font-family:'Montserrat',sans-serif;text-align:center;";
    toast.textContent = msg;
    container.appendChild(toast);
    requestAnimationFrame(function () {
      toast.style.opacity = '1';
    });
    setTimeout(function () {
      toast.style.opacity = '0';
      setTimeout(function () {
        toast.remove();
      }, 300);
    }, 4000);
  }

  // =====================================================
  // MAIN APPLICATION
  // =====================================================

  window.nominateApp = {
    currentStep: 1,
    totalSteps: 6,
    formData: {},
    selectedCategory: null,

    // Step labels for progress bar
    stepLabels: ['Award', 'Region', 'Nominee', 'Why', 'You', 'Review'],

    // --------------------------------------------------
    // Initialize
    // --------------------------------------------------
    initialize: function () {
      this.buildProgressBar();
      this.buildCategoryList();
      this.populateRegions();
      this.setupCharCounters();
      this.setupTermsCheckbox();
      this.updateProgressIndicator(1);
    },

    // --------------------------------------------------
    // Build progress bar dots from stepLabels
    // --------------------------------------------------
    buildProgressBar: function () {
      const container = document.getElementById('progressSteps');
      const track = document.getElementById('progressTrack');
      container.innerHTML = '';
      container.appendChild(track);

      this.stepLabels.forEach(function (label, i) {
        const wrap = document.createElement('div');
        wrap.className = 'progress-step-wrap';
        wrap.innerHTML =
          '<div class="progress-dot" data-step="' +
          (i + 1) +
          '"></div>' +
          '<div class="step-label" data-step="' +
          (i + 1) +
          '">' +
          label +
          '</div>';
        container.appendChild(wrap);
      });
    },

    // --------------------------------------------------
    // Build the nomination category list
    // --------------------------------------------------
    buildCategoryList: function () {
      const self = this;
      const container = document.getElementById('categoryList');

      container.innerHTML = NOMINATION_CATEGORIES.map(function (cat, idx) {
        return (
          '<div class="award-option" data-category-index="' +
          idx +
          '" role="button" tabindex="0">' +
          '<div class="award-check">' +
          '<i class="bi bi-check" style="display:none; font-size:14px; font-weight:900;"></i>' +
          '</div>' +
          '<div>' +
          '<span class="award-name"><i class="' +
          cat.icon +
          ' me-2" style="color:var(--gold-dark)"></i>' +
          self.escapeHtml(cat.name) +
          '</span>' +
          '<div class="award-desc">' +
          self.escapeHtml(cat.description) +
          '</div>' +
          '</div>' +
          '</div>'
        );
      }).join('');

      container.querySelectorAll('.award-option').forEach(function (opt) {
        opt.addEventListener('click', function () {
          const idx = parseInt(opt.dataset.categoryIndex);
          self.selectCategory(NOMINATION_CATEGORIES[idx].name, opt);
        });
        opt.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') opt.click();
        });
      });
    },

    // --------------------------------------------------
    // Select a nomination category
    // --------------------------------------------------
    selectCategory: function (categoryName, element) {
      document.querySelectorAll('#categoryList .award-option').forEach(function (opt) {
        opt.classList.remove('selected');
        const icon = opt.querySelector('.bi-check');
        if (icon) icon.style.display = 'none';
      });

      element.classList.add('selected');
      const icon = element.querySelector('.bi-check');
      if (icon) icon.style.display = 'block';

      this.selectedCategory = categoryName;
      document.getElementById('step1NextBtn').style.display = 'block';

      // Toggle person/business fields based on category
      this.updateNomineeFields(categoryName);

      // Show under-18 parental consent notice for Apprentice/Young Tradesperson categories
      const ageNotice = document.getElementById('apprenticeAgeNotice');
      if (ageNotice) {
        const requiresAgeNotice =
          categoryName === 'Apprentice of The Year' || categoryName === 'Young Tradesperson of the Year';
        ageNotice.style.display = requiresAgeNotice ? 'block' : 'none';
      }
    },

    // --------------------------------------------------
    // Toggle nominee fields based on category
    // --------------------------------------------------
    updateNomineeFields: function (categoryName) {
      const isNewBusiness = categoryName === 'New Business of the Year';
      const personFields = document.getElementById('personFields');
      const businessFields = document.getElementById('businessFields');
      const step3Title = document.getElementById('step3Title');
      const step3Subtitle = document.getElementById('step3Subtitle');

      if (isNewBusiness) {
        personFields.style.display = 'none';
        businessFields.style.display = 'block';
        step3Title.textContent = 'About the business';
        step3Subtitle.textContent = 'Tell us about the new business you are nominating';
      } else {
        personFields.style.display = 'block';
        businessFields.style.display = 'none';
        step3Title.textContent = 'About the nominee';
        step3Subtitle.textContent = 'Tell us about the person you are nominating';
      }

      // Adapt "years in trade" label and options based on category
      const yearsLabel = document.getElementById('yearsLabel');
      const yearsSelect = document.getElementById('nomineeYearsInTrade');
      if (yearsLabel && yearsSelect) {
        const config = this.getYearsFieldConfig(categoryName);
        yearsLabel.innerHTML = config.label + ' <small class="text-muted">(optional)</small>';
        yearsSelect.innerHTML =
          '<option value="">Select...</option>' +
          config.options
            .map(function (opt) {
              return '<option value="' + opt + '">' + opt + '</option>';
            })
            .join('');
      }
    },

    // --------------------------------------------------
    // Get contextual label & options for years field
    // --------------------------------------------------
    getYearsFieldConfig: function (categoryName) {
      switch (categoryName) {
        case 'Apprentice of The Year':
          return {
            label: 'Time in apprenticeship',
            options: ['Under 6 months', '6-12 months', '1-2 years', '2-3 years', '3+ years'],
          };
        case 'Young Tradesperson of the Year':
          return {
            label: 'Years in the trade',
            options: ['Under 1 year', '1-2 years', '2-3 years', '3-5 years', '5+ years'],
          };
        case 'Lifetime Achievement':
          return {
            label: 'Years in the industry',
            options: ['10-19 years', '20-29 years', '30-39 years', '40+ years'],
          };
        default:
          return {
            label: 'Years in the trade',
            options: ['Under 1 year', '1-3 years', '4-9 years', '10-19 years', '20+ years'],
          };
      }
    },

    // --------------------------------------------------
    // Set up country flag card handlers (first of three levels)
    // --------------------------------------------------
    populateRegions: function () {
      const self = this;
      document.querySelectorAll('#country_picker .country-pick-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          self.handleCountrySelect(btn.dataset.country);
        });
      });
      const regionGroupSelect = document.getElementById('region_group');
      if (regionGroupSelect) {
        regionGroupSelect.addEventListener('change', function () {
          self.handleRegionGroupChange();
        });
      }
    },

    // Country card clicked → show region select for that country
    handleCountrySelect: function (country) {
      document.querySelectorAll('#country_picker .country-pick-btn').forEach(function (btn) {
        const active = btn.dataset.country === country;
        btn.classList.toggle('selected', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      });

      const countryInput = document.getElementById('selected_country');
      if (countryInput) countryInput.value = country;

      const picker = document.getElementById('country_picker');
      if (picker) {
        const fb = picker.nextElementSibling;
        if (fb && fb.classList.contains('invalid-feedback')) fb.style.display = 'none';
      }

      const regionSelect = document.getElementById('region_group');
      const regionWrapper = document.getElementById('region_wrapper');
      const countyWrapper = document.getElementById('county_city_wrapper');
      const countySelect = document.getElementById('county_city');
      if (!regionSelect || !regionWrapper) return;

      const regions = (window.REGION_DATA || {})[country] || {};
      regionSelect.innerHTML = '<option value="">Select region</option>';
      Object.keys(regions).forEach(function (r) {
        const opt = document.createElement('option');
        opt.value = r;
        opt.textContent = r;
        regionSelect.appendChild(opt);
      });
      regionSelect.value = '';
      regionWrapper.style.display = 'block';

      if (countyWrapper) countyWrapper.style.display = 'none';
      if (countySelect) {
        countySelect.value = '';
        countySelect.innerHTML = '<option value="">Select county, city or borough</option>';
      }

      setTimeout(function () {
        regionSelect.focus();
      }, 50);
    },

    // Region selected → show county/city/borough select
    handleRegionGroupChange: function () {
      const country = document.getElementById('selected_country') && document.getElementById('selected_country').value;
      const groupName = document.getElementById('region_group') && document.getElementById('region_group').value;
      const wrapper = document.getElementById('county_city_wrapper');
      const countySelect = document.getElementById('county_city');
      if (!wrapper || !countySelect) return;

      countySelect.value = '';
      countySelect.innerHTML = '<option value="">Select county, city or borough</option>';

      if (!groupName) {
        wrapper.style.display = 'none';
        return;
      }

      const regions = (window.REGION_DATA || {})[country] || {};
      const options = regions[groupName] || [];

      options.forEach(function (opt) {
        const el = document.createElement('option');
        el.value = opt;
        el.textContent = opt;
        countySelect.appendChild(el);
      });

      wrapper.style.display = 'block';
      setTimeout(function () {
        countySelect.focus();
      }, 50);
    },

    // --------------------------------------------------
    // Setup character counters
    // --------------------------------------------------
    setupCharCounters: function () {
      const counters = [
        { field: 'nominationReason', display: 'reasonCharCount', max: 2000 },
        { field: 'supportingInfo', display: 'supportCharCount', max: 1500 },
        { field: 'businessDescription', display: 'bizDescCharCount', max: 500 },
      ];

      counters.forEach(function (c) {
        const el = document.getElementById(c.field);
        const counter = document.getElementById(c.display);
        if (el && counter) {
          el.addEventListener('input', function () {
            const len = el.value.length;
            counter.textContent = len.toLocaleString() + ' / ' + c.max.toLocaleString();
            counter.classList.toggle('warn', len > c.max * 0.9);
          });
        }
      });
    },

    // --------------------------------------------------
    // Inline field error helper (marks field + scrolls to it)
    // --------------------------------------------------
    _markInvalid: function (input, message) {
      if (!input) return;
      input.classList.add('is-invalid');
      let fb = input.nextElementSibling;
      if (!fb || !fb.classList.contains('invalid-feedback')) {
        fb = document.createElement('div');
        fb.className = 'invalid-feedback';
        input.parentNode.insertBefore(fb, input.nextSibling);
      }
      fb.textContent = message;
      input.addEventListener(
        'input',
        function () {
          input.classList.remove('is-invalid');
        },
        { once: true }
      );
      if (typeof input.scrollIntoView === 'function') {
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    },

    // --------------------------------------------------
    // Setup terms checkbox
    // --------------------------------------------------
    setupTermsCheckbox: function () {
      const checkbox = document.getElementById('termsCheckbox');
      const submitBtn = document.getElementById('submitBtn');
      if (checkbox && submitBtn) {
        checkbox.addEventListener('change', function () {
          const checked = checkbox.checked;
          submitBtn.disabled = !checked;
          submitBtn.setAttribute('aria-disabled', checked ? 'false' : 'true');
        });
      }
    },

    // --------------------------------------------------
    // Navigation
    // --------------------------------------------------
    nextStep: function (currentStepNum) {
      if (!this.validateStep(currentStepNum)) return;
      this.saveStepData(currentStepNum);

      if (currentStepNum === 5) {
        this.showReview();
      }

      this.goToStep(currentStepNum + 1);
    },

    prevStep: function (currentStepNum) {
      this.goToStep(currentStepNum - 1);
    },

    goToStep: function (stepNum) {
      document.querySelectorAll('.form-step').forEach(function (s) {
        s.classList.remove('active');
      });
      const target = document.getElementById('step' + stepNum);
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
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    // --------------------------------------------------
    // Update progress bar
    // --------------------------------------------------
    updateProgressIndicator: function (stepNum) {
      const dots = document.querySelectorAll('.progress-dot');
      const labels = document.querySelectorAll('.step-label');
      const track = document.getElementById('progressTrack');

      dots.forEach(function (dot, i) {
        dot.classList.remove('active', 'completed');
        dot.removeAttribute('aria-current');
        if (i < stepNum - 1) dot.classList.add('completed');
        else if (i === stepNum - 1) {
          dot.classList.add('active');
          dot.setAttribute('aria-current', 'step');
        }
      });

      labels.forEach(function (label, i) {
        label.classList.remove('active', 'completed');
        if (i < stepNum - 1) label.classList.add('completed');
        else if (i === stepNum - 1) label.classList.add('active');
      });

      if (track && this.totalSteps > 1) {
        const pct = ((stepNum - 1) / (this.totalSteps - 1)) * 100;
        track.style.width = pct + '%';
      }

      const wrapper = document.getElementById('progressWrapper');
      if (wrapper) {
        wrapper.style.display = stepNum > this.totalSteps ? 'none' : '';
      }
    },

    // --------------------------------------------------
    // Validation
    // --------------------------------------------------
    validateStep: function (stepNum) {
      switch (stepNum) {
        case 1: {
          if (!this.selectedCategory) {
            showPublicToast('Please select a nomination category');
            return false;
          }
          return true;
        }
        case 2: {
          const countryVal =
            document.getElementById('selected_country') && document.getElementById('selected_country').value;
          if (!countryVal) {
            const picker = document.getElementById('country_picker');
            if (picker) {
              let fb = picker.nextElementSibling;
              if (!fb || !fb.classList.contains('invalid-feedback')) {
                fb = document.createElement('div');
                fb.className = 'invalid-feedback';
                picker.parentNode.insertBefore(fb, picker.nextSibling);
              }
              fb.style.display = 'block';
              fb.textContent = "Please select the nominee's country";
              picker.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return false;
          }
          const regionGroupEl = document.getElementById('region_group');
          const countyEl = document.getElementById('county_city');
          if (!regionGroupEl || !regionGroupEl.value) {
            this._markInvalid(regionGroupEl, 'Please select a region');
            return false;
          }
          if (!countyEl || !countyEl.value) {
            this._markInvalid(countyEl, "Please select the nominee's county or city");
            return false;
          }
          return true;
        }
        case 3: {
          const isNewBusiness = this.selectedCategory === 'New Business of the Year';
          if (isNewBusiness) {
            const bizNameEl = document.getElementById('businessName');
            if (!bizNameEl || !bizNameEl.value.trim()) {
              this._markInvalid(bizNameEl, 'Please enter the business name');
              return false;
            }
            if (bizNameEl.value.trim().length < 2) {
              this._markInvalid(bizNameEl, 'Business name must be at least 2 characters');
              return false;
            }
            const bizOwnerEl = document.getElementById('businessOwner');
            if (!bizOwnerEl || !bizOwnerEl.value.trim()) {
              this._markInvalid(bizOwnerEl, 'Please enter the owner / founder name');
              return false;
            }
            const bizDescEl = document.getElementById('businessDescription');
            if (!bizDescEl || !bizDescEl.value.trim()) {
              this._markInvalid(bizDescEl, 'Please describe what the business does');
              return false;
            }
            if (bizDescEl.value.trim().length < 10) {
              this._markInvalid(bizDescEl, 'Please provide a more detailed description (at least 10 characters)');
              return false;
            }
            const bizYearsEl = document.getElementById('businessYearsTrading');
            if (!bizYearsEl || !bizYearsEl.value) {
              this._markInvalid(bizYearsEl, 'Please select years trading');
              return false;
            }
          } else {
            const nameEl = document.getElementById('nomineeName');
            if (!nameEl || !nameEl.value.trim()) {
              this._markInvalid(nameEl, "Please enter the nominee's name");
              return false;
            }
            if (nameEl.value.trim().length < 2) {
              this._markInvalid(nameEl, 'Name must be at least 2 characters');
              return false;
            }
            const roleEl = document.getElementById('nomineeRole');
            if (!roleEl || !roleEl.value.trim()) {
              this._markInvalid(roleEl, "Please enter the nominee's role or job title");
              return false;
            }
            const companyEl = document.getElementById('nomineeCompany');
            if (!companyEl || !companyEl.value.trim()) {
              this._markInvalid(companyEl, "Please enter the nominee's company or employer");
              return false;
            }
          }
          return true;
        }
        case 4: {
          const reasonEl = document.getElementById('nominationReason');
          if (!reasonEl || !reasonEl.value.trim()) {
            this._markInvalid(reasonEl, 'Please tell us why they deserve this award');
            return false;
          }
          if (reasonEl.value.trim().length < 20) {
            this._markInvalid(reasonEl, 'Please provide more detail (at least 20 characters)');
            return false;
          }
          return true;
        }
        case 5: {
          const nomNameEl = document.getElementById('nominatorName');
          const nomEmailEl = document.getElementById('nominatorEmail');
          const nomPhoneEl = document.getElementById('nominatorPhone');
          const nomRelEl = document.getElementById('nominatorRelationship');
          if (!nomNameEl || !nomNameEl.value.trim()) {
            this._markInvalid(nomNameEl, 'Please enter your name');
            return false;
          }
          if (!nomRelEl || !nomRelEl.value) {
            this._markInvalid(nomRelEl, 'Please select your relationship to the nominee');
            return false;
          }
          if (!nomEmailEl || !nomEmailEl.value.trim()) {
            this._markInvalid(nomEmailEl, 'Please enter your email address');
            return false;
          }
          if (!this.validateEmail(nomEmailEl.value.trim())) {
            this._markInvalid(nomEmailEl, 'Please enter a valid email address');
            return false;
          }
          if (!nomPhoneEl || !nomPhoneEl.value.trim()) {
            this._markInvalid(nomPhoneEl, 'Please enter your phone number');
            return false;
          }
          return true;
        }
        default:
          return true;
      }
    },

    validateEmail: function (email) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },

    // --------------------------------------------------
    // Save step data
    // --------------------------------------------------
    saveStepData: function (stepNum) {
      switch (stepNum) {
        case 1:
          this.formData.awardCategory = this.selectedCategory;
          break;
        case 2:
          this.formData.selected_country = (document.getElementById('selected_country') || {}).value || '';
          this.formData.region_group = (document.getElementById('region_group') || {}).value || '';
          this.formData.county_city = (document.getElementById('county_city') || {}).value || '';
          break;
        case 3:
          if (this.selectedCategory === 'New Business of the Year') {
            this.formData.businessName = document.getElementById('businessName').value.trim();
            this.formData.businessOwner = document.getElementById('businessOwner').value.trim();
            this.formData.businessDescription = document.getElementById('businessDescription').value.trim();
            this.formData.businessWebsite = document.getElementById('businessWebsite').value.trim();
            this.formData.businessYearsTrading = document.getElementById('businessYearsTrading').value;
            this.formData.businessEmployees = document.getElementById('businessEmployees').value;
          } else {
            this.formData.nomineeName = document.getElementById('nomineeName').value.trim();
            this.formData.nomineeRole = document.getElementById('nomineeRole').value.trim();
            this.formData.nomineeCompany = document.getElementById('nomineeCompany').value.trim();
            this.formData.nomineeYearsInTrade = document.getElementById('nomineeYearsInTrade').value;
          }
          break;
        case 4:
          this.formData.nominationReason = document.getElementById('nominationReason').value.trim();
          this.formData.supportingInfo = document.getElementById('supportingInfo').value.trim();
          break;
        case 5:
          this.formData.nominatorName = document.getElementById('nominatorName').value.trim();
          this.formData.nominatorCompany = document.getElementById('nominatorCompany').value.trim();
          this.formData.nominatorRelationship = document.getElementById('nominatorRelationship').value;
          this.formData.nominatorEmail = document.getElementById('nominatorEmail').value.trim();
          this.formData.nominatorPhone = document.getElementById('nominatorPhone').value.trim();
          break;
      }
    },

    // --------------------------------------------------
    // Show review
    // --------------------------------------------------
    showReview: function () {
      const d = this.formData;
      const reviewContent = document.getElementById('reviewContent');
      const self = this;
      const isNewBusiness = d.awardCategory === 'New Business of the Year';

      const row = function (label, value) {
        return value
          ? '<div class="review-row"><span class="review-label">' +
              label +
              '</span><span class="review-value">' +
              self.escapeHtml(value) +
              '</span></div>'
          : '';
      };

      const textBlock = function (text) {
        return text
          ? '<div class="review-text-block">' + self.escapeHtml(text) + '</div>'
          : '<div class="review-text-block" style="color:#999; font-style:italic;">Not provided</div>';
      };

      let nomineeSection;
      if (isNewBusiness) {
        nomineeSection =
          '<div class="review-group">' +
          '<div class="review-group-title">Business Details <span class="review-edit-btn float-end" data-action="nominateApp.goToStep" data-args="[3]">Edit</span></div>' +
          row('Business Name', d.businessName) +
          row('Owner / Founder', d.businessOwner) +
          '<div class="review-row"><span class="review-label">Description</span></div>' +
          textBlock(d.businessDescription) +
          row('Website', d.businessWebsite) +
          row('Years Trading', d.businessYearsTrading) +
          row('Employees', d.businessEmployees) +
          '</div>';
      } else {
        nomineeSection =
          '<div class="review-group">' +
          '<div class="review-group-title">Nominee Details <span class="review-edit-btn float-end" data-action="nominateApp.goToStep" data-args="[3]">Edit</span></div>' +
          row('Name', d.nomineeName) +
          row('Role', d.nomineeRole) +
          row('Company', d.nomineeCompany) +
          row('Years in Trade', d.nomineeYearsInTrade) +
          '</div>';
      }

      reviewContent.innerHTML =
        '<div class="review-group">' +
        '<div class="review-group-title">Nomination <span class="review-edit-btn float-end" data-action="nominateApp.goToStep" data-args="[1]">Edit</span></div>' +
        row('Award Category', d.awardCategory) +
        row(
          'Location',
          [
            d.selected_country
              ? d.selected_country.replace(/-/g, ' ').replace(/\b\w/g, function (c) {
                  return c.toUpperCase();
                })
              : '',
            d.region_group,
            d.county_city,
          ]
            .filter(Boolean)
            .join(' › ')
        ) +
        '</div>' +
        nomineeSection +
        '<div class="review-group">' +
        '<div class="review-group-title">Nomination Reason <span class="review-edit-btn float-end" data-action="nominateApp.goToStep" data-args="[4]">Edit</span></div>' +
        textBlock(d.nominationReason) +
        (d.supportingInfo
          ? '<div class="review-row mt-2"><span class="review-label">Supporting Info</span></div>' +
            textBlock(d.supportingInfo)
          : '') +
        '</div>' +
        '<div class="review-group">' +
        '<div class="review-group-title">Your Details <span class="review-edit-btn float-end" data-action="nominateApp.goToStep" data-args="[5]">Edit</span></div>' +
        row('Name', d.nominatorName) +
        row('Company', d.nominatorCompany) +
        row('Relationship', d.nominatorRelationship) +
        row('Email', d.nominatorEmail) +
        row('Phone', d.nominatorPhone) +
        '</div>';

      // Reset terms
      const checkbox = document.getElementById('termsCheckbox');
      const submitBtn = document.getElementById('submitBtn');
      if (checkbox) checkbox.checked = false;
      if (submitBtn) submitBtn.disabled = true;
    },

    // --------------------------------------------------
    // Submit nomination
    // --------------------------------------------------
    submitNomination: function () {
      const submitBtn = document.getElementById('submitBtn');
      const originalText = submitBtn.innerHTML;

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Submitting...';

      const d = this.formData;
      const isNewBusiness = d.awardCategory === 'New Business of the Year';

      const payload = {
        action: 'submit_nomination',
        awardCategory: d.awardCategory,
        county_city: d.county_city,
        nominationReason: d.nominationReason,
        supportingInfo: d.supportingInfo,
        nominatorName: d.nominatorName,
        nominatorCompany: d.nominatorCompany,
        nominatorRelationship: d.nominatorRelationship,
        nominatorEmail: d.nominatorEmail,
        nominatorPhone: d.nominatorPhone,
      };

      if (isNewBusiness) {
        payload.businessName = d.businessName;
        payload.businessOwner = d.businessOwner;
        payload.businessDescription = d.businessDescription;
        payload.businessWebsite = d.businessWebsite;
        payload.businessYearsTrading = d.businessYearsTrading;
        payload.businessEmployees = d.businessEmployees;
      } else {
        payload.nomineeName = d.nomineeName;
        payload.nomineeRole = d.nomineeRole;
        payload.nomineeCompany = d.nomineeCompany;
        payload.nomineeYearsInTrade = d.nomineeYearsInTrade;
      }

      nominationApi(payload)
        .then(function (result) {
          const entryNumber = result.entry.entry_number;
          document.getElementById('nominationReference').textContent = entryNumber;

          // Show nominee name and category on success page
          const successNominee = document.getElementById('success-nominee');
          const successCategory = document.getElementById('success-category');
          if (successNominee) {
            successNominee.textContent = d.nomineeName || d.businessName || '';
          }
          if (successCategory) {
            successCategory.textContent = d.awardCategory || '';
          }

          document.querySelectorAll('.form-step').forEach(function (s) {
            s.classList.remove('active');
          });
          document.getElementById('stepSuccess').classList.add('active');

          const wrapper = document.getElementById('progressWrapper');
          if (wrapper) wrapper.style.display = 'none';

          window.scrollTo({ top: 0, behavior: 'smooth' });
        })
        .catch(function (error) {
          console.error('Submission error:', error);
          showPublicToast('Error submitting nomination: ' + error.message, 'error');
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
        });
    },

    // --------------------------------------------------
    // Utilities
    // --------------------------------------------------
    escapeHtml: function (text) {
      if (!text) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    },
  };

  const nominateApp = window.nominateApp;

  // Initialize on page load
  document.addEventListener('DOMContentLoaded', function () {
    nominateApp.initialize();
  });

  // Lightweight event delegation for data-action buttons
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
})();

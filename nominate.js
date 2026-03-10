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
    var container = document.getElementById('publicToastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'publicToastContainer';
      container.setAttribute('role', 'alert');
      container.setAttribute('aria-live', 'polite');
      container.style.cssText =
        'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:99999;max-width:400px;width:calc(100% - 40px);';
      document.body.appendChild(container);
    }
    var colors = { warning: '#ffc107', error: '#dc3545', success: '#28a745', info: '#17a2b8' };
    var textColors = { warning: '#000', error: '#fff', success: '#fff', info: '#fff' };
    var toast = document.createElement('div');
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
    regionChoicesInstance: null,

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
      var container = document.getElementById('progressSteps');
      var track = document.getElementById('progressTrack');
      container.innerHTML = '';
      container.appendChild(track);

      this.stepLabels.forEach(function (label, i) {
        var wrap = document.createElement('div');
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
      var self = this;
      var container = document.getElementById('categoryList');

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
          var idx = parseInt(opt.dataset.categoryIndex);
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
        var icon = opt.querySelector('.bi-check');
        if (icon) icon.style.display = 'none';
      });

      element.classList.add('selected');
      var icon = element.querySelector('.bi-check');
      if (icon) icon.style.display = 'block';

      this.selectedCategory = categoryName;
      document.getElementById('step1NextBtn').style.display = 'block';

      // Toggle person/business fields based on category
      this.updateNomineeFields(categoryName);
    },

    // --------------------------------------------------
    // Toggle nominee fields based on category
    // --------------------------------------------------
    updateNomineeFields: function (categoryName) {
      var isNewBusiness = categoryName === 'New Business of the Year';
      var personFields = document.getElementById('personFields');
      var businessFields = document.getElementById('businessFields');
      var step3Title = document.getElementById('step3Title');
      var step3Subtitle = document.getElementById('step3Subtitle');

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
      var yearsLabel = document.getElementById('yearsLabel');
      var yearsSelect = document.getElementById('nomineeYearsInTrade');
      if (yearsLabel && yearsSelect) {
        var config = this.getYearsFieldConfig(categoryName);
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
    // Populate regions dropdown from config.js REGIONS
    // --------------------------------------------------
    populateRegions: function () {
      var self = this;
      var regionSelect = document.getElementById('region');
      if (!window.REGIONS || window.REGIONS.length === 0) {
        console.warn('No regions found in config');
        return;
      }

      var cities = [
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
        'London North',
        'London South',
        'London East',
        'London West',
        'Manchester',
        'Middlesbrough',
        'Newcastle',
        'Nottingham',
        'Sheffield',
        'Southampton',
        'Swansea',
      ];

      var counties = window.REGIONS.filter(function (r) {
        return cities.indexOf(r) === -1;
      });
      var cityList = window.REGIONS.filter(function (r) {
        return cities.indexOf(r) !== -1;
      });

      var html = '<option value="" placeholder>Select county or city</option>';

      if (counties.length > 0) {
        html += '<optgroup label="Counties">';
        counties.forEach(function (county) {
          html += '<option value="' + self.escapeHtml(county) + '">' + self.escapeHtml(county) + '</option>';
        });
        html += '</optgroup>';
      }

      if (cityList.length > 0) {
        html += '<optgroup label="Cities">';
        cityList.forEach(function (city) {
          html += '<option value="' + self.escapeHtml(city) + '">' + self.escapeHtml(city) + '</option>';
        });
        html += '</optgroup>';
      }

      regionSelect.innerHTML = html;

      if (typeof Choices !== 'undefined') {
        this.regionChoicesInstance = new Choices('#region', {
          searchEnabled: true,
          searchFloor: 1,
          searchPlaceholderValue: 'Type to search...',
          placeholder: true,
          placeholderValue: 'Select county or city',
          itemSelectText: '',
          shouldSort: false,
          searchResultLimit: 100,
          allowHTML: true,
        });
      }
    },

    // --------------------------------------------------
    // Setup character counters
    // --------------------------------------------------
    setupCharCounters: function () {
      var counters = [
        { field: 'nominationReason', display: 'reasonCharCount', max: 2000 },
        { field: 'supportingInfo', display: 'supportCharCount', max: 1500 },
        { field: 'businessDescription', display: 'bizDescCharCount', max: 500 },
      ];

      counters.forEach(function (c) {
        var el = document.getElementById(c.field);
        var counter = document.getElementById(c.display);
        if (el && counter) {
          el.addEventListener('input', function () {
            var len = el.value.length;
            counter.textContent = len.toLocaleString() + ' / ' + c.max.toLocaleString();
            counter.classList.toggle('warn', len > c.max * 0.9);
          });
        }
      });
    },

    // --------------------------------------------------
    // Setup terms checkbox
    // --------------------------------------------------
    setupTermsCheckbox: function () {
      var checkbox = document.getElementById('termsCheckbox');
      var submitBtn = document.getElementById('submitBtn');
      if (checkbox && submitBtn) {
        checkbox.addEventListener('change', function () {
          submitBtn.disabled = !checkbox.checked;
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
      var target = document.getElementById('step' + stepNum);
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
    updateProgressIndicator: function (stepNum) {
      var dots = document.querySelectorAll('.progress-dot');
      var labels = document.querySelectorAll('.step-label');
      var track = document.getElementById('progressTrack');

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
        var pct = ((stepNum - 1) / (this.totalSteps - 1)) * 100;
        track.style.width = pct + '%';
      }

      var wrapper = document.getElementById('progressWrapper');
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
          var region = document.getElementById('region').value;
          if (!region) {
            showPublicToast("Please select the nominee's county or city");
            return false;
          }
          return true;
        }
        case 3: {
          var isNewBusiness = this.selectedCategory === 'New Business of the Year';
          if (isNewBusiness) {
            var bizName = document.getElementById('businessName').value.trim();
            if (!bizName) {
              showPublicToast('Please enter the business name');
              return false;
            }
            if (bizName.length < 2) {
              showPublicToast('Business name must be at least 2 characters');
              return false;
            }
            var bizOwner = document.getElementById('businessOwner').value.trim();
            if (!bizOwner) {
              showPublicToast('Please enter the owner / founder name');
              return false;
            }
            var bizDesc = document.getElementById('businessDescription').value.trim();
            if (!bizDesc) {
              showPublicToast('Please describe what the business does');
              return false;
            }
            if (bizDesc.length < 10) {
              showPublicToast('Please provide a more detailed description (at least 10 characters)');
              return false;
            }
            var bizYears = document.getElementById('businessYearsTrading').value;
            if (!bizYears) {
              showPublicToast('Please select years trading');
              return false;
            }
          } else {
            var name = document.getElementById('nomineeName').value.trim();
            if (!name) {
              showPublicToast("Please enter the nominee's name");
              return false;
            }
            if (name.length < 2) {
              showPublicToast('Name must be at least 2 characters');
              return false;
            }
            var role = document.getElementById('nomineeRole').value.trim();
            if (!role) {
              showPublicToast("Please enter the nominee's role or job title");
              return false;
            }
            var company = document.getElementById('nomineeCompany').value.trim();
            if (!company) {
              showPublicToast("Please enter the nominee's company or employer");
              return false;
            }
          }
          return true;
        }
        case 4: {
          var reason = document.getElementById('nominationReason').value.trim();
          if (!reason) {
            showPublicToast('Please tell us why they deserve this award');
            return false;
          }
          if (reason.length < 20) {
            showPublicToast('Please provide more detail (at least 20 characters)');
            return false;
          }
          return true;
        }
        case 5: {
          var nomName = document.getElementById('nominatorName').value.trim();
          var nomEmail = document.getElementById('nominatorEmail').value.trim();
          var nomPhone = document.getElementById('nominatorPhone').value.trim();
          var nomRelationship = document.getElementById('nominatorRelationship').value;
          if (!nomName) {
            showPublicToast('Please enter your name');
            return false;
          }
          if (!nomRelationship) {
            showPublicToast('Please select your relationship to the nominee');
            return false;
          }
          if (!nomEmail) {
            showPublicToast('Please enter your email address');
            return false;
          }
          if (!this.validateEmail(nomEmail)) {
            showPublicToast('Please enter a valid email address');
            return false;
          }
          if (!nomPhone) {
            showPublicToast('Please enter your phone number');
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
          this.formData.region = document.getElementById('region').value;
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
      var d = this.formData;
      var reviewContent = document.getElementById('reviewContent');
      var self = this;
      var isNewBusiness = d.awardCategory === 'New Business of the Year';

      var row = function (label, value) {
        return value
          ? '<div class="review-row"><span class="review-label">' +
              label +
              '</span><span class="review-value">' +
              self.escapeHtml(value) +
              '</span></div>'
          : '';
      };

      var textBlock = function (text) {
        return text
          ? '<div class="review-text-block">' + self.escapeHtml(text) + '</div>'
          : '<div class="review-text-block" style="color:#999; font-style:italic;">Not provided</div>';
      };

      var nomineeSection;
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
        row('Region', d.region) +
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
      var checkbox = document.getElementById('termsCheckbox');
      var submitBtn = document.getElementById('submitBtn');
      if (checkbox) checkbox.checked = false;
      if (submitBtn) submitBtn.disabled = true;
    },

    // --------------------------------------------------
    // Submit nomination
    // --------------------------------------------------
    submitNomination: function () {
      var self = this;
      var submitBtn = document.getElementById('submitBtn');
      var originalText = submitBtn.innerHTML;

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Submitting...';

      var d = this.formData;
      var isNewBusiness = d.awardCategory === 'New Business of the Year';

      var payload = {
        action: 'submit_nomination',
        awardCategory: d.awardCategory,
        region: d.region,
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
          var entryNumber = result.entry.entry_number;
          document.getElementById('nominationReference').textContent = entryNumber;
          document.querySelectorAll('.form-step').forEach(function (s) {
            s.classList.remove('active');
          });
          document.getElementById('stepSuccess').classList.add('active');

          var wrapper = document.getElementById('progressWrapper');
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
      var div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    },
  };

  var nominateApp = window.nominateApp;

  // Initialize on page load
  document.addEventListener('DOMContentLoaded', function () {
    nominateApp.initialize();
  });

  // Lightweight event delegation for data-action buttons
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
})();

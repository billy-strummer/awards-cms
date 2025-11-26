/* ==================================================== */
/* STREAMLINED ENTRY SUBMISSION FORM */
/* ==================================================== */

// Initialize Supabase using shared config
const supabase = window.supabase.createClient(
  window.SUPABASE_CONFIG.url,
  window.SUPABASE_CONFIG.anonKey
);

const entryFormApp = {
  currentStep: 1,
  totalSteps: 7,
  formData: {},
  selectedAwardId: null,

  /**
   * Initialize form
   */
  async initialize() {
    console.log('Initializing entry form...');

    // Populate sectors from config
    this.populateSectors();

    // Populate regions from config
    this.populateRegions();
  },

  /**
   * Populate sectors dropdown from config
   */
  populateSectors() {
    const sectorSelect = document.getElementById('sector');
    if (!window.SECTORS || window.SECTORS.length === 0) {
      console.warn('No sectors found in config');
      return;
    }

    const options = window.SECTORS.map(sector =>
      `<option value="${this.escapeHtml(sector)}">${this.escapeHtml(sector)}</option>`
    ).join('');

    sectorSelect.innerHTML = '<option value="">Choose your sector...</option>' + options;
  },

  /**
   * Populate regions dropdown from config
   */
  populateRegions() {
    const regionSelect = document.getElementById('region');
    if (!window.REGIONS || window.REGIONS.length === 0) {
      console.warn('No regions found in config');
      return;
    }

    const options = window.REGIONS.map(region =>
      `<option value="${this.escapeHtml(region)}">${this.escapeHtml(region)}</option>`
    ).join('');

    regionSelect.innerHTML = '<option value="">Choose your region...</option>' + options;
  },

  /**
   * Go to next step
   */
  async nextStep(currentStepNum) {
    // Validate current step
    if (!this.validateStep(currentStepNum)) {
      return;
    }

    // Save current step data
    this.saveStepData(currentStepNum);

    // Load next step content if needed
    if (currentStepNum === 2) {
      await this.loadAwards();
    }

    if (currentStepNum === 6) {
      this.showReview();
    }

    // Move to next step
    const nextStep = currentStepNum + 1;
    this.goToStep(nextStep);
  },

  /**
   * Go to previous step
   */
  prevStep(currentStepNum) {
    const prevStep = currentStepNum - 1;
    this.goToStep(prevStep);
  },

  /**
   * Navigate to specific step
   */
  goToStep(stepNum) {
    // Hide all steps
    document.querySelectorAll('.form-step').forEach(step => {
      step.classList.remove('active');
    });

    // Show target step
    document.getElementById(`step${stepNum}`).classList.add('active');

    // Update progress indicator
    this.updateProgressIndicator(stepNum);

    // Update current step
    this.currentStep = stepNum;

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  /**
   * Update progress indicator
   */
  updateProgressIndicator(stepNum) {
    const dots = document.querySelectorAll('.progress-dot');
    dots.forEach((dot, index) => {
      dot.classList.remove('active', 'completed');
      if (index < stepNum - 1) {
        dot.classList.add('completed');
      } else if (index === stepNum - 1) {
        dot.classList.add('active');
      }
    });
  },

  /**
   * Validate current step
   */
  validateStep(stepNum) {
    switch (stepNum) {
      case 1: // Sector
        const sector = document.getElementById('sector').value;
        if (!sector) {
          alert('Please select a sector');
          return false;
        }
        return true;

      case 2: // Region
        const region = document.getElementById('region').value;
        if (!region) {
          alert('Please select a region');
          return false;
        }
        return true;

      case 3: // Award Category
        if (!this.selectedAwardId) {
          alert('Please select an award category');
          return false;
        }
        return true;

      case 4: // Company Name
        const companyName = document.getElementById('companyName').value.trim();
        if (!companyName) {
          alert('Please enter your company name');
          return false;
        }
        return true;

      case 5: // Years in Field
        const yearsInField = document.getElementById('yearsInField').value;
        if (!yearsInField) {
          alert('Please select years in field');
          return false;
        }
        return true;

      case 6: // Contact Info
        const contactName = document.getElementById('contactName').value.trim();
        const contactEmail = document.getElementById('contactEmail').value.trim();
        if (!contactName) {
          alert('Please enter your name');
          return false;
        }
        if (!contactEmail) {
          alert('Please enter your email address');
          return false;
        }
        if (!this.validateEmail(contactEmail)) {
          alert('Please enter a valid email address');
          return false;
        }
        return true;

      default:
        return true;
    }
  },

  /**
   * Validate email format
   */
  validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  },

  /**
   * Save step data to formData object
   */
  saveStepData(stepNum) {
    switch (stepNum) {
      case 1:
        this.formData.sector = document.getElementById('sector').value;
        break;
      case 2:
        this.formData.region = document.getElementById('region').value;
        break;
      case 3:
        this.formData.awardId = this.selectedAwardId;
        break;
      case 4:
        this.formData.companyName = document.getElementById('companyName').value.trim();
        break;
      case 5:
        this.formData.yearsInField = document.getElementById('yearsInField').value;
        break;
      case 6:
        this.formData.contactName = document.getElementById('contactName').value.trim();
        this.formData.contactPosition = document.getElementById('contactPosition').value.trim();
        this.formData.contactEmail = document.getElementById('contactEmail').value.trim();
        this.formData.contactPhone = document.getElementById('contactPhone').value.trim();
        break;
    }
  },

  /**
   * Load awards based on selected sector and region
   */
  async loadAwards() {
    const awardsList = document.getElementById('awardsList');
    awardsList.innerHTML = `
      <div class="text-center py-4">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <p class="mt-2 text-muted">Loading award categories...</p>
      </div>
    `;

    try {
      // Fetch active awards from database
      const { data: awards, error } = await supabase
        .from('awards')
        .select('id, award_name, category, description, entry_fee, sector, year')
        .eq('is_active', true)
        .order('award_name');

      if (error) throw error;

      if (!awards || awards.length === 0) {
        awardsList.innerHTML = `
          <div class="alert alert-warning">
            <i class="bi bi-exclamation-triangle me-2"></i>
            No awards available at this time. Please check back later.
          </div>
        `;
        return;
      }

      // Filter awards by selected sector if awards have sector field
      let filteredAwards = awards;
      if (this.formData.sector) {
        // Check if any awards have the sector field populated
        const awardsWithSector = awards.filter(a => a.sector);
        if (awardsWithSector.length > 0) {
          // Filter by sector if the field exists
          filteredAwards = awards.filter(a =>
            !a.sector || a.sector === this.formData.sector
          );
        }
      }

      if (filteredAwards.length === 0) {
        awardsList.innerHTML = `
          <div class="alert alert-info">
            <i class="bi bi-info-circle me-2"></i>
            No awards found for the selected sector. Showing all available awards.
          </div>
        `;
        filteredAwards = awards;
      }

      // Render awards as selectable options
      awardsList.innerHTML = filteredAwards.map(award => `
        <div class="award-option" onclick="entryFormApp.selectAward('${award.id}', this)">
          <h5 class="mb-1">${this.escapeHtml(award.award_name || award.category || 'Award')}</h5>
          ${award.description ? `<p class="text-muted small mb-1">${this.escapeHtml(award.description)}</p>` : ''}
          <div class="d-flex justify-content-between align-items-center">
            ${award.entry_fee ? `<span><strong>Entry Fee:</strong> £${award.entry_fee}</span>` : '<span></span>'}
            ${award.year ? `<small class="text-muted">${award.year}</small>` : ''}
          </div>
        </div>
      `).join('');

    } catch (error) {
      console.error('Error loading awards:', error);
      awardsList.innerHTML = `
        <div class="alert alert-danger">
          <i class="bi bi-exclamation-circle me-2"></i>
          Error loading awards: ${error.message}
        </div>
      `;
    }
  },

  /**
   * Select an award
   */
  selectAward(awardId, element) {
    // Remove selection from all awards
    document.querySelectorAll('.award-option').forEach(opt => {
      opt.classList.remove('selected');
    });

    // Select this award
    element.classList.add('selected');
    this.selectedAwardId = awardId;

    // Show next button
    document.getElementById('step3NextBtn').style.display = 'block';
  },

  /**
   * Show review before submission
   */
  showReview() {
    const reviewContent = document.getElementById('reviewContent');

    // Find selected award name
    let awardName = 'N/A';
    const selectedAward = document.querySelector('.award-option.selected h5');
    if (selectedAward) {
      awardName = selectedAward.textContent;
    }

    reviewContent.innerHTML = `
      <div class="mb-3">
        <strong>Sector:</strong> ${this.escapeHtml(this.formData.sector || 'N/A')}
      </div>
      <div class="mb-3">
        <strong>Region:</strong> ${this.escapeHtml(this.formData.region || 'N/A')}
      </div>
      <div class="mb-3">
        <strong>Award Category:</strong> ${this.escapeHtml(awardName)}
      </div>
      <div class="mb-3">
        <strong>Company Name:</strong> ${this.escapeHtml(this.formData.companyName || 'N/A')}
      </div>
      <div class="mb-3">
        <strong>Years in Field:</strong> ${this.escapeHtml(this.formData.yearsInField || 'N/A')}
      </div>
      <hr>
      <div class="mb-3">
        <strong>Contact Name:</strong> ${this.escapeHtml(this.formData.contactName || 'N/A')}
      </div>
      <div class="mb-3">
        <strong>Position:</strong> ${this.escapeHtml(this.formData.contactPosition || 'N/A')}
      </div>
      <div class="mb-3">
        <strong>Email:</strong> ${this.escapeHtml(this.formData.contactEmail || 'N/A')}
      </div>
      <div class="mb-3">
        <strong>Phone:</strong> ${this.escapeHtml(this.formData.contactPhone || 'N/A')}
      </div>
    `;
  },

  /**
   * Submit the entry
   */
  async submitEntry() {
    try {
      // Show loading
      const submitBtn = document.querySelector('.btn-submit');
      const originalText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Submitting...';

      // Check if company exists or create new one
      let organisationId = null;

      const { data: existingOrgs, error: searchError } = await supabase
        .from('organisations')
        .select('id')
        .ilike('company_name', this.formData.companyName)
        .limit(1);

      if (searchError) throw searchError;

      if (existingOrgs && existingOrgs.length > 0) {
        organisationId = existingOrgs[0].id;
      } else {
        // Create new organisation
        const { data: newOrg, error: orgError } = await supabase
          .from('organisations')
          .insert({
            company_name: this.formData.companyName,
            region: this.formData.region,
            sector: this.formData.sector,
            email: this.formData.contactEmail,
            contact_name: this.formData.contactName,
            contact_phone: this.formData.contactPhone || null,
            status: 'active',
            years_in_field: this.formData.yearsInField
          })
          .select()
          .single();

        if (orgError) throw orgError;
        organisationId = newOrg.id;
      }

      // Generate entry number
      const entryNumber = await this.generateEntryNumber();

      // Create entry
      const { data: entry, error: entryError } = await supabase
        .from('entries')
        .insert({
          entry_number: entryNumber,
          organisation_id: organisationId,
          award_id: this.formData.awardId,
          entry_title: `${this.formData.companyName} - ${this.formData.sector}`,
          contact_name: this.formData.contactName,
          contact_email: this.formData.contactEmail,
          contact_phone: this.formData.contactPhone || null,
          contact_position: this.formData.contactPosition || null,
          status: 'submitted',
          payment_status: 'pending',
          submission_date: new Date().toISOString(),
          allow_public_voting: false
        })
        .select()
        .single();

      if (entryError) throw entryError;

      // Show success
      document.getElementById('entryReference').textContent = entryNumber;
      this.goToStep(8); // Success step (stepSuccess)

      // Hide success step and show it
      document.getElementById('stepSuccess').classList.add('active');

    } catch (error) {
      console.error('Error submitting entry:', error);
      alert('Error submitting entry: ' + error.message);

      // Re-enable button
      const submitBtn = document.querySelector('.btn-submit');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="bi bi-check-circle me-2"></i>Submit Entry';
    }
  },

  /**
   * Generate entry number
   */
  async generateEntryNumber() {
    try {
      const currentYear = new Date().getFullYear();
      const { data, error } = await supabase
        .from('entries')
        .select('entry_number')
        .like('entry_number', `${currentYear}-%`)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      let nextNumber = 1;
      if (data && data.length > 0) {
        const lastNumber = parseInt(data[0].entry_number.split('-')[1]);
        nextNumber = lastNumber + 1;
      }

      return `${currentYear}-${String(nextNumber).padStart(4, '0')}`;
    } catch (error) {
      console.error('Error generating entry number:', error);
      return `${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
    }
  },

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  entryFormApp.initialize();
});

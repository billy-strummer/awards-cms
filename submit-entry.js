/* ====================================================

 */
/* PUBLIC ENTRY SUBMISSION FORM */
/* ==================================================== */

// Initialize Supabase
const SUPABASE_URL = 'YOUR_SUPABASE_URL'; // TODO: Replace with actual URL
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'; // TODO: Replace with actual key
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Initialize Stripe
const STRIPE_PUBLIC_KEY = 'YOUR_STRIPE_PUBLIC_KEY'; // TODO: Replace with actual key
const stripe = Stripe(STRIPE_PUBLIC_KEY);

const submissionForm = {
  currentStep: 1,
  uploadedFiles: {
    documents: [],
    images: [],
    videos: []
  },
  entryData: {},

  /**
   * Initialize form
   */
  async initialize() {
    await this.loadCompanies();
    await this.loadAwards();
    this.setupEventListeners();
    this.setupFileUploads();
  },

  /**
   * Load companies for dropdown
   */
  async loadCompanies() {
    try {
      const { data: companies, error } = await supabase
        .from('organisations')
        .select('id, company_name')
        .eq('status', 'active')
        .order('company_name');

      if (error) throw error;

      const select = document.getElementById('companySelect');
      const existingOptions = select.innerHTML;

      select.innerHTML = '<option value="">Select your company...</option>' +
        companies.map(c => `<option value="${c.id}">${c.company_name}</option>`).join('') +
        '<option value="new">+ Add New Company</option>';

    } catch (error) {
      console.error('Error loading companies:', error);
    }
  },

  /**
   * Load awards for dropdown
   */
  async loadAwards() {
    try {
      const { data: awards, error } = await supabase
        .from('awards')
        .select('id, award_name, category, entry_fee')
        .eq('is_active', true)
        .order('award_name');

      if (error) throw error;

      const select = document.getElementById('awardSelect');
      select.innerHTML = '<option value="">Select award category...</option>' +
        awards.map(a => `
          <option value="${a.id}" data-fee="${a.entry_fee || 195}">
            ${a.award_name} ${a.entry_fee ? '(£' + a.entry_fee + ')' : ''}
          </option>
        `).join('');

    } catch (error) {
      console.error('Error loading awards:', error);
    }
  },

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Company select change
    document.getElementById('companySelect').addEventListener('change', (e) => {
      const newCompanyFields = document.getElementById('newCompanyFields');
      newCompanyFields.style.display = e.target.value === 'new' ? 'block' : 'none';
    });

    // Award select change - update fee
    document.getElementById('awardSelect').addEventListener('change', (e) => {
      const selectedOption = e.target.options[e.target.selectedIndex];
      const fee = selectedOption.dataset.fee || 195;
      this.updateFees(parseFloat(fee));
    });

    // File inputs
    document.getElementById('documentsInput').addEventListener('change', (e) => {
      this.handleFileSelect(e.target.files, 'documents');
    });

    document.getElementById('imagesInput').addEventListener('change', (e) => {
      this.handleFileSelect(e.target.files, 'images');
    });
  },

  /**
   * Setup drag and drop for file uploads
   */
  setupFileUploads() {
    ['documentsUploadZone', 'imagesUploadZone'].forEach(zoneId => {
      const zone = document.getElementById(zoneId);

      zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('dragover');
      });

      zone.addEventListener('dragleave', () => {
        zone.classList.remove('dragover');
      });

      zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('dragover');

        const fileType = zoneId.includes('documents') ? 'documents' : 'images';
        this.handleFileSelect(e.dataTransfer.files, fileType);
      });
    });
  },

  /**
   * Handle file selection
   */
  handleFileSelect(files, type) {
    Array.from(files).forEach(file => {
      // Validate file
      if (!this.validateFile(file, type)) return;

      this.uploadedFiles[type].push(file);
      this.displayFile(file, type);
    });
  },

  /**
   * Validate file
   */
  validateFile(file, type) {
    const maxSizes = {
      documents: 10 * 1024 * 1024, // 10MB
      images: 5 * 1024 * 1024 // 5MB
    };

    if (file.size > maxSizes[type]) {
      alert(`File ${file.name} is too large. Maximum size: ${maxSizes[type] / 1024 / 1024}MB`);
      return false;
    }

    return true;
  },

  /**
   * Display uploaded file
   */
  displayFile(file, type) {
    const listId = type === 'documents' ? 'documentsList' : 'imagesList';
    const list = document.getElementById(listId);

    const fileDiv = document.createElement('div');
    fileDiv.className = 'uploaded-file';
    fileDiv.innerHTML = `
      <div>
        <i class="bi bi-${type === 'documents' ? 'file-earmark-pdf' : 'image'} me-2"></i>
        <strong>${file.name}</strong>
        <small class="text-muted ms-2">(${(file.size / 1024).toFixed(1)} KB)</small>
      </div>
      <button type="button" class="btn btn-sm btn-outline-danger" onclick="submissionForm.removeFile('${file.name}', '${type}')">
        <i class="bi bi-x"></i>
      </button>
    `;

    list.appendChild(fileDiv);
  },

  /**
   * Remove file
   */
  removeFile(fileName, type) {
    this.uploadedFiles[type] = this.uploadedFiles[type].filter(f => f.name !== fileName);

    // Remove from display
    const listId = type === 'documents' ? 'documentsList' : 'imagesList';
    const list = document.getElementById(listId);
    Array.from(list.children).forEach(child => {
      if (child.textContent.includes(fileName)) {
        child.remove();
      }
    });
  },

  /**
   * Add video link
   */
  addVideoLink() {
    const container = document.getElementById('videoLinksContainer');
    const linkCount = container.querySelectorAll('input').length + 1;

    const div = document.createElement('div');
    div.className = 'input-group mb-2';
    div.innerHTML = `
      <input type="url" class="form-control" placeholder="https://youtube.com/watch?v=..."
             id="videoLink${linkCount}">
      <button class="btn btn-outline-danger" type="button" onclick="this.parentElement.remove()">
        <i class="bi bi-x"></i>
      </button>
    `;

    container.appendChild(div);
  },

  /**
   * Update fees
   */
  updateFees(entryFee) {
    const processingFee = entryFee * 0.029 + 0.30; // Stripe fee: 2.9% + 30p
    const total = entryFee + processingFee;

    document.getElementById('feeAmount').textContent = `£${entryFee.toFixed(2)}`;
    document.getElementById('processingFee').textContent = `£${processingFee.toFixed(2)}`;
    document.getElementById('totalFee').textContent = `£${total.toFixed(2)}`;
  },

  /**
   * Navigate to next step
   */
  nextStep() {
    if (!this.validateCurrentStep()) {
      return;
    }

    this.currentStep++;
    this.showStep(this.currentStep);

    if (this.currentStep === 3) {
      this.generateReview();
    }
  },

  /**
   * Navigate to previous step
   */
  prevStep() {
    this.currentStep--;
    this.showStep(this.currentStep);
  },

  /**
   * Show specific step
   */
  showStep(step) {
    // Hide all steps
    document.querySelectorAll('.form-step').forEach(s => s.style.display = 'none');

    // Show current step
    document.getElementById(`step${step}`).style.display = 'block';

    // Update progress
    document.querySelectorAll('.progress-step').forEach((ps, index) => {
      ps.classList.remove('active', 'completed');
      if (index < step - 1) {
        ps.classList.add('completed');
      } else if (index === step - 1) {
        ps.classList.add('active');
      }
    });

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  /**
   * Validate current step
   */
  validateCurrentStep() {
    if (this.currentStep === 1) {
      // Validate required fields
      const requiredFields = [
        'companySelect',
        'awardSelect',
        'entryTitle',
        'whyShouldWin',
        'contactName',
        'contactEmail'
      ];

      for (const fieldId of requiredFields) {
        const field = document.getElementById(fieldId);
        if (!field.value || field.value === '') {
          alert('Please fill in all required fields');
          field.focus();
          return false;
        }
      }

      // If new company, validate new company fields
      if (document.getElementById('companySelect').value === 'new') {
        if (!document.getElementById('newCompanyName').value) {
          alert('Please enter company name');
          document.getElementById('newCompanyName').focus();
          return false;
        }
      }
    }

    return true;
  },

  /**
   * Generate review content
   */
  generateReview() {
    const companySelect = document.getElementById('companySelect');
    const companyName = companySelect.value === 'new'
      ? document.getElementById('newCompanyName').value
      : companySelect.options[companySelect.selectedIndex].text;

    const awardSelect = document.getElementById('awardSelect');
    const awardName = awardSelect.options[awardSelect.selectedIndex].text;

    const reviewContent = document.getElementById('reviewContent');
    reviewContent.innerHTML = `
      <div class="card mb-3">
        <div class="card-header bg-light">
          <h5 class="mb-0">Entry Information</h5>
        </div>
        <div class="card-body">
          <div class="row mb-2">
            <div class="col-4 text-muted">Company:</div>
            <div class="col-8"><strong>${companyName}</strong></div>
          </div>
          <div class="row mb-2">
            <div class="col-4 text-muted">Award:</div>
            <div class="col-8"><strong>${awardName}</strong></div>
          </div>
          <div class="row mb-2">
            <div class="col-4 text-muted">Entry Title:</div>
            <div class="col-8">${document.getElementById('entryTitle').value}</div>
          </div>
          <div class="row mb-2">
            <div class="col-4 text-muted">Contact:</div>
            <div class="col-8">
              ${document.getElementById('contactName').value}<br>
              <small>${document.getElementById('contactEmail').value}</small>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header bg-light">
          <h5 class="mb-0">Uploaded Files</h5>
        </div>
        <div class="card-body">
          <div class="row">
            <div class="col-md-6">
              <strong>Documents:</strong> ${this.uploadedFiles.documents.length} files<br>
              <strong>Images:</strong> ${this.uploadedFiles.images.length} files
            </div>
            <div class="col-md-6">
              <strong>Video Links:</strong> ${this.getVideoLinks().length} links
            </div>
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Get video links
   */
  getVideoLinks() {
    const inputs = document.querySelectorAll('#videoLinksContainer input');
    return Array.from(inputs)
      .map(input => input.value)
      .filter(val => val && val.trim() !== '');
  },

  /**
   * Submit entry
   */
  async submitEntry() {
    try {
      this.showStep(4); // Show processing

      // Step 1: Create or get company ID
      let companyId;
      const companySelect = document.getElementById('companySelect');

      if (companySelect.value === 'new') {
        // Create new company
        const { data: newCompany, error: companyError } = await supabase
          .from('organisations')
          .insert([{
            company_name: document.getElementById('newCompanyName').value,
            website: document.getElementById('newCompanyWebsite').value,
            description: document.getElementById('newCompanyDescription').value,
            status: 'active'
          }])
          .select()
          .single();

        if (companyError) throw companyError;
        companyId = newCompany.id;
      } else {
        companyId = companySelect.value;
      }

      // Step 2: Upload files to Supabase Storage
      // TODO: Implement actual file upload
      const uploadedDocUrls = []; // Placeholder
      const uploadedImageUrls = []; // Placeholder

      // Step 3: Create entry
      const entryData = {
        organisation_id: companyId,
        award_id: document.getElementById('awardSelect').value,
        entry_title: document.getElementById('entryTitle').value,
        entry_description: document.getElementById('entryDescription').value,
        why_should_win: document.getElementById('whyShouldWin').value,
        supporting_information: document.getElementById('supportingInfo').value,
        contact_name: document.getElementById('contactName').value,
        contact_email: document.getElementById('contactEmail').value,
        contact_phone: document.getElementById('contactPhone').value,
        contact_position: document.getElementById('contactPosition').value,
        status: 'draft', // Will be 'submitted' after payment
        supporting_documents: JSON.stringify(uploadedDocUrls),
        images: JSON.stringify(uploadedImageUrls),
        videos: JSON.stringify(this.getVideoLinks()),
        entry_fee: parseFloat(document.getElementById('feeAmount').textContent.replace('£', '')),
        payment_status: 'pending'
      };

      const { data: entry, error: entryError } = await supabase
        .from('entries')
        .insert([entryData])
        .select()
        .single();

      if (entryError) throw entryError;

      // Step 4: Create Stripe checkout session
      await this.processPayment(entry);

    } catch (error) {
      console.error('Error submitting entry:', error);
      alert('Error submitting entry: ' + error.message);
      this.showStep(3); // Go back to review
    }
  },

  /**
   * Process payment with Stripe
   */
  async processPayment(entry) {
    try {
      const totalAmount = parseFloat(document.getElementById('totalFee').textContent.replace('£', ''));

      // TODO: Create Stripe checkout session via your backend API
      // This requires a server-side endpoint to create the session

      // For now, show success message
      alert(`Entry ${entry.entry_number} created successfully! Payment integration coming soon.`);
      window.location.href = '/submit-entry-success.html?entry=' + entry.entry_number;

      /* Example Stripe integration:
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entryId: entry.id,
          amount: totalAmount * 100, // Stripe uses cents
          description: `Entry ${entry.entry_number} - ${entry.entry_title}`
        })
      });

      const session = await response.json();

      // Redirect to Stripe Checkout
      const result = await stripe.redirectToCheckout({
        sessionId: session.id
      });

      if (result.error) {
        throw new Error(result.error.message);
      }
      */

    } catch (error) {
      console.error('Payment error:', error);
      throw error;
    }
  }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  submissionForm.initialize();
});

/* ==================================================== */
/* UPLOAD DOCUMENTS - File Upload Handler */
/* ==================================================== */

// Initialize Supabase client for this public page
const supabase = window.supabase.createClient(
  SUPABASE_CONFIG.url,
  SUPABASE_CONFIG.anonKey
);

function showPublicToast(msg, type = 'warning') {
  let container = document.getElementById('publicToastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'publicToastContainer';
    container.style.cssText = 'position:fixed;top:20px;right:20px;z-index:99999;max-width:400px;';
    document.body.appendChild(container);
  }
  const colors = { warning: '#ffc107', error: '#dc3545', success: '#28a745', info: '#17a2b8' };
  const toast = document.createElement('div');
  toast.style.cssText = `background:${colors[type] || colors.warning};color:${type === 'warning' ? '#000' : '#fff'};padding:12px 20px;margin-bottom:8px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.15);font-size:14px;opacity:0;transition:opacity .3s;`;
  toast.textContent = msg;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.style.opacity = '1');
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 4000);
}

const uploadApp = {
  entryId: null,
  entryData: null,
  files: [],
  uploadedFiles: [],

  /**
   * Initialize upload page
   */
  async initialize() {
    // Get entry ID from URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    this.entryId = urlParams.get('entry');

    if (!this.entryId) {
      this.showError('Invalid upload link. Please use the link from your confirmation email.');
      return;
    }

    // Setup upload zone immediately so it works while entry details load
    this.setupUploadZone();

    // Load entry details (don't block the upload zone)
    await this.loadEntryDetails();
  },

  /**
   * Load entry details
   */
  async loadEntryDetails() {
    try {
      // First fetch the entry without joins (avoids issues if anon role
      // lacks SELECT on related tables like award_years)
      const { data: entry, error } = await supabase
        .from('entries')
        .select('*')
        .eq('entry_number', this.entryId)
        .single();

      if (error) throw error;

      if (!entry) {
        this.showError('Entry not found. Please check your upload link.');
        return;
      }

      this.entryData = entry;

      // Optionally enrich with organisation and award names
      let companyName = 'N/A';
      let awardName = 'N/A';

      if (entry.organisation_id) {
        try {
          const { data: org } = await supabase
            .from('organisations')
            .select('company_name')
            .eq('id', entry.organisation_id)
            .single();
          if (org) companyName = org.company_name;
        } catch (e) {
          console.warn('Could not load organisation:', e);
        }
      }

      if (entry.award_id) {
        try {
          const { data: award } = await supabase
            .from('award_years')
            .select('award_name')
            .eq('id', entry.award_id)
            .single();
          if (award) awardName = award.award_name;
        } catch (e) {
          console.warn('Could not load award:', e);
        }
      }

      // Display entry information
      document.getElementById('entryDetails').innerHTML = `
        <table class="table table-sm table-borderless mb-0">
          <tr>
            <td class="text-muted" style="width: 120px;">Entry Number:</td>
            <td><strong>${entry.entry_number}</strong></td>
          </tr>
          <tr>
            <td class="text-muted">Company:</td>
            <td><strong>${companyName}</strong></td>
          </tr>
          <tr>
            <td class="text-muted">Award:</td>
            <td>${awardName}</td>
          </tr>
          <tr>
            <td class="text-muted">Contact:</td>
            <td>${entry.contact_name || 'N/A'} ${entry.contact_email ? '(' + entry.contact_email + ')' : ''}</td>
          </tr>
        </table>
      `;

      // Load existing files
      await this.loadExistingFiles();

    } catch (error) {
      console.error('Error loading entry:', error);
      this.showError('Failed to load entry details. ' + (error.message || 'Please check your upload link and try again.'));
    }
  },

  /**
   * Load existing uploaded files
   */
  async loadExistingFiles() {
    try {
      const { data: files, error } = await supabase
        .from('entry_files')
        .select('*')
        .eq('entry_id', this.entryData.id)
        .order('upload_date', { ascending: false });

      if (error) throw error;

      if (files && files.length > 0) {
        const existingFilesHtml = `
          <div class="alert alert-success mb-4">
            <strong><i class="bi bi-check-circle me-2"></i>Previously Uploaded Files (${files.length}):</strong>
            <ul class="mb-0 mt-2">
              ${files.map(file => `
                <li>${file.file_name} <small class="text-muted">(${(file.file_size / 1024).toFixed(1)} KB)</small></li>
              `).join('')}
            </ul>
          </div>
        `;
        document.querySelector('.upload-zone').insertAdjacentHTML('beforebegin', existingFilesHtml);
      }

    } catch (error) {
      console.error('Error loading existing files:', error);
    }
  },

  /**
   * Setup drag & drop upload zone
   */
  setupUploadZone() {
    const uploadZone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('fileInput');
    const uploadButton = document.getElementById('uploadButton');
    const browseBtn = document.getElementById('browseButton');

    // Click anywhere in the zone to browse files
    uploadZone.addEventListener('click', (e) => {
      // Prevent re-triggering if the click came from the file input itself
      if (e.target === fileInput) return;
      fileInput.click();
    });

    // Explicit browse button (better for mobile)
    if (browseBtn) {
      browseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
      });
    }

    // File selection
    fileInput.addEventListener('change', (e) => {
      this.handleFiles(e.target.files);
      // Reset so the same file can be re-selected
      fileInput.value = '';
    });

    // Drag & drop (desktop only, harmless on mobile)
    uploadZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadZone.classList.add('dragover');
    });

    uploadZone.addEventListener('dragleave', () => {
      uploadZone.classList.remove('dragover');
    });

    uploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadZone.classList.remove('dragover');
      this.handleFiles(e.dataTransfer.files);
    });

    // Upload button
    uploadButton.addEventListener('click', () => {
      this.uploadAllFiles();
    });
  },

  /**
   * Handle selected files
   */
  handleFiles(fileList) {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/png',
      'image/gif'
    ];

    Array.from(fileList).forEach(file => {
      // Validate file size
      if (file.size > maxSize) {
        showPublicToast(`File "${file.name}" is too large. Maximum size is 10MB.`);
        return;
      }

      // Validate file type
      if (!allowedTypes.includes(file.type)) {
        showPublicToast(`File "${file.name}" is not an allowed file type.`);
        return;
      }

      // Check for duplicates
      if (this.files.some(f => f.name === file.name && f.size === file.size)) {
        return;
      }

      // Add to files array
      this.files.push(file);
    });

    this.renderFileList();
    document.getElementById('uploadButton').disabled = this.files.length === 0;
  },

  /**
   * Render file list
   */
  renderFileList() {
    const fileList = document.getElementById('fileList');

    if (this.files.length === 0) {
      fileList.innerHTML = '';
      return;
    }

    fileList.innerHTML = this.files.map((file, index) => `
      <div class="file-item" id="file-${index}">
        <div>
          <i class="bi bi-file-earmark me-2"></i>
          <strong>${file.name}</strong>
          <small class="text-muted ms-2">(${(file.size / 1024).toFixed(1)} KB)</small>
        </div>
        <div>
          <button class="btn btn-sm btn-outline-danger" onclick="uploadApp.removeFile(${index})">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>
    `).join('');
  },

  /**
   * Remove file from list
   */
  removeFile(index) {
    this.files.splice(index, 1);
    this.renderFileList();
    document.getElementById('uploadButton').disabled = this.files.length === 0;
  },

  /**
   * Upload all files
   */
  async uploadAllFiles() {
    if (this.files.length === 0) return;

    const uploadButton = document.getElementById('uploadButton');
    uploadButton.disabled = true;
    uploadButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Uploading...';

    for (let i = 0; i < this.files.length; i++) {
      const file = this.files[i];
      const fileItem = document.getElementById(`file-${i}`);

      fileItem.classList.add('uploading');

      try {
        await this.uploadFile(file, i);
        fileItem.classList.remove('uploading');
        fileItem.classList.add('uploaded');
        fileItem.querySelector('div:last-child').innerHTML = '<i class="bi bi-check-circle-fill text-success"></i>';

      } catch (error) {
        console.error(`Error uploading ${file.name}:`, error);
        fileItem.classList.remove('uploading');
        fileItem.querySelector('div:last-child').innerHTML = '<i class="bi bi-x-circle-fill text-danger"></i>';
        showPublicToast(`Failed to upload ${file.name}: ${error.message}`, 'error');
      }
    }

    // Show success message
    document.getElementById('uploadForm').style.display = 'none';
    document.getElementById('successMessage').style.display = 'block';
  },

  /**
   * Upload single file
   */
  async uploadFile(file, index) {
    // Generate unique filename
    const timestamp = Date.now();
    const filename = `${this.entryData.entry_number}/${timestamp}-${file.name}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('entry-files')
      .upload(filename, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('entry-files')
      .getPublicUrl(filename);

    // Save file metadata to database
    const { error: dbError } = await supabase
      .from('entry_files')
      .insert([{
        entry_id: this.entryData.id,
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_type: this.getFileType(file.type),
        file_size: file.size,
        mime_type: file.type,
        uploaded_by: this.entryData.contact_email,
        is_public: false
      }]);

    if (dbError) throw dbError;

    this.uploadedFiles.push(file);
  },

  /**
   * Get file type category
   */
  getFileType(mimeType) {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.includes('pdf')) return 'pdf';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'document';
    if (mimeType.includes('excel') || mimeType.includes('sheet')) return 'spreadsheet';
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'presentation';
    return 'other';
  },

  /**
   * Show error message
   */
  showError(message) {
    document.querySelector('.upload-section').innerHTML = `
      <div class="alert alert-danger">
        <h5><i class="bi bi-exclamation-triangle me-2"></i>Error</h5>
        <p class="mb-0">${message}</p>
      </div>
    `;
  }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  uploadApp.initialize();
});

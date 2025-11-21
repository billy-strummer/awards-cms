/* ==================================================== */
/* INDIVIDUAL NOMINEE VOTING SYSTEM */
/* ==================================================== */

// Initialize Supabase
const SUPABASE_URL = 'YOUR_SUPABASE_URL'; // TODO: Replace with your Supabase URL
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'; // TODO: Replace with your Supabase anon key
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const nomineeVoting = {
  entry: null,
  entryId: null,
  voterEmail: localStorage.getItem('voterEmail') || null,
  hasVoted: false,

  /**
   * Initialize voting system
   */
  async initialize() {
    // Get entry identifier from URL
    const urlParams = new URLSearchParams(window.location.search);
    const entryNumber = urlParams.get('entry');
    const entryId = urlParams.get('id');

    if (!entryNumber && !entryId) {
      this.showError();
      return;
    }

    // Load the entry
    await this.loadEntry(entryNumber, entryId);

    // Setup event listeners
    this.setupEventListeners();
  },

  /**
   * Load entry by entry number or ID
   */
  async loadEntry(entryNumber, entryId) {
    try {
      let query = supabase
        .from('entries')
        .select(`
          *,
          organisations(company_name, logo_url, website),
          awards(award_name, category)
        `)
        .eq('is_public', true)
        .eq('allow_public_voting', true)
        .in('status', ['shortlisted', 'submitted']);

      // Query by entry number or ID
      if (entryNumber) {
        query = query.eq('entry_number', entryNumber);
      } else if (entryId) {
        query = query.eq('id', entryId);
      }

      const { data, error } = await query.single();

      if (error || !data) {
        console.error('Entry not found:', error);
        this.showError();
        return;
      }

      this.entry = data;
      this.entryId = data.id;

      // Check if user has already voted
      if (this.voterEmail) {
        await this.checkIfVoted();
      }

      // Display the entry
      this.displayEntry();

    } catch (error) {
      console.error('Error loading entry:', error);
      this.showError();
    }
  },

  /**
   * Check if user has already voted for this entry
   */
  async checkIfVoted() {
    try {
      const { data, error } = await supabase
        .from('public_votes')
        .select('id')
        .eq('entry_id', this.entryId)
        .eq('voter_email', this.voterEmail)
        .single();

      if (data) {
        this.hasVoted = true;
      }
    } catch (error) {
      // No vote found, which is fine
      this.hasVoted = false;
    }
  },

  /**
   * Display entry information
   */
  displayEntry() {
    // Hide loading, show card
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('nomineeCard').style.display = 'block';

    const entry = this.entry;
    const org = entry.organisations;
    const award = entry.awards;

    // Update page title and meta tags
    document.title = `Vote for ${org?.company_name || 'Nominee'} - British Trade Awards`;

    // Update Open Graph tags
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.content = `Vote for ${org?.company_name || 'Nominee'} - British Trade Awards`;

    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.content = entry.entry_description?.substring(0, 150) || 'Cast your vote for this nominee';

    // Logo
    const logoEl = document.getElementById('companyLogo');
    if (org?.logo_url) {
      logoEl.src = org.logo_url;
      logoEl.alt = org.company_name;
    } else {
      logoEl.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="120" height="120"%3E%3Crect fill="%23f8f9fa" width="120" height="120"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%236c757d" font-size="40"%3E%F0%9F%8F%A2%3C/text%3E%3C/svg%3E';
      logoEl.alt = 'Company Logo';
    }

    // Award badge
    document.getElementById('awardBadge').textContent = award?.award_name || 'Award';

    // Company name
    document.getElementById('companyName').textContent = org?.company_name || 'Nominee';

    // Entry title
    document.getElementById('entryTitle').textContent = entry.entry_title || '';

    // Entry number
    document.getElementById('entryNumber').textContent = entry.entry_number || '';

    // Vote count
    document.getElementById('voteCount').textContent = (entry.public_votes || 0).toLocaleString();

    // Description
    if (entry.entry_description) {
      document.getElementById('entryDescription').textContent = entry.entry_description;
    }

    // Why should win
    if (entry.why_should_win) {
      document.getElementById('whyShouldWin').style.display = 'block';
      document.getElementById('whyShouldWinText').textContent = entry.why_should_win;
    }

    // Website link
    if (org?.website) {
      document.getElementById('websiteLinkSection').style.display = 'block';
      document.getElementById('websiteLink').href = org.website;
    }

    // Vote button state
    const voteButton = document.getElementById('voteButton');
    if (this.hasVoted) {
      voteButton.innerHTML = '<i class="bi bi-check-circle me-2"></i>You Already Voted';
      voteButton.disabled = true;
    }
  },

  /**
   * Show error state
   */
  showError() {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('errorState').style.display = 'block';
  },

  /**
   * Vote button clicked
   */
  async vote() {
    // If user already has email stored, submit vote directly
    if (this.voterEmail) {
      // Check again if voted (in case of page refresh)
      await this.checkIfVoted();
      if (this.hasVoted) {
        alert('You have already voted for this entry!');
        return;
      }
      await this.submitVote();
    } else {
      // Show verification modal
      this.showVerificationModal();
    }
  },

  /**
   * Show verification modal
   */
  showVerificationModal() {
    document.getElementById('verificationModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
  },

  /**
   * Close verification modal
   */
  closeVerificationModal() {
    document.getElementById('verificationModal').style.display = 'none';
    document.body.style.overflow = 'auto';
  },

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    document.getElementById('verificationForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      this.voterEmail = document.getElementById('voterEmail').value;
      const voterName = document.getElementById('voterName').value;

      // Store email locally
      localStorage.setItem('voterEmail', this.voterEmail);
      if (voterName) {
        localStorage.setItem('voterName', voterName);
      }

      await this.submitVote();
    });
  },

  /**
   * Submit vote
   */
  async submitVote() {
    try {
      const voterName = localStorage.getItem('voterName') || '';

      // Check if already voted for this entry
      const { data: existingVote } = await supabase
        .from('public_votes')
        .select('id')
        .eq('entry_id', this.entryId)
        .eq('voter_email', this.voterEmail)
        .single();

      if (existingVote) {
        alert('You have already voted for this entry!');
        this.closeVerificationModal();
        this.hasVoted = true;
        this.updateVoteButton();
        return;
      }

      // Get IP address
      const ipAddress = await this.getIPAddress();

      // Insert vote
      const { error } = await supabase
        .from('public_votes')
        .insert([{
          entry_id: this.entryId,
          voter_email: this.voterEmail,
          voter_name: voterName,
          voter_ip: ipAddress,
          vote_value: 1,
          email_verified: false,
          verification_token: this.generateToken(),
          verification_sent_at: new Date().toISOString()
        }]);

      if (error) throw error;

      // Update local vote count
      this.entry.public_votes = (this.entry.public_votes || 0) + 1;
      document.getElementById('voteCount').textContent = this.entry.public_votes.toLocaleString();

      // Close verification modal if open
      this.closeVerificationModal();

      // Show success modal
      this.showSuccessModal();

      // Update vote button
      this.hasVoted = true;
      this.updateVoteButton();

      // Send verification email (TODO: implement backend)
      await this.sendVerificationEmail();

    } catch (error) {
      console.error('Error submitting vote:', error);
      alert('Failed to submit vote. Please try again.');
    }
  },

  /**
   * Update vote button state
   */
  updateVoteButton() {
    const voteButton = document.getElementById('voteButton');
    voteButton.innerHTML = '<i class="bi bi-check-circle me-2"></i>You Already Voted';
    voteButton.disabled = true;
  },

  /**
   * Show success modal
   */
  showSuccessModal() {
    document.getElementById('successModal').style.display = 'flex';
  },

  /**
   * Close success modal
   */
  closeSuccessModal() {
    document.getElementById('successModal').style.display = 'none';
  },

  /**
   * Get IP address (for duplicate detection)
   */
  async getIPAddress() {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      return 'unknown';
    }
  },

  /**
   * Generate verification token
   */
  generateToken() {
    return Math.random().toString(36).substring(2) +
           Date.now().toString(36);
  },

  /**
   * Send verification email
   */
  async sendVerificationEmail() {
    // TODO: Call backend API to send verification email
    console.log(`Sending verification email to ${this.voterEmail} for entry ${this.entry.entry_number}`);

    // Email should contain:
    // - Thank you message
    // - Verification link
    // - Entry details
    // - Company information
  },

  /**
   * Share on Twitter
   */
  shareTwitter() {
    const text = `I just voted for ${this.entry.organisations?.company_name} in the British Trade Awards! Cast your vote too:`;
    const url = window.location.href;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
  },

  /**
   * Share on Facebook
   */
  shareFacebook() {
    const url = window.location.href;
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
  },

  /**
   * Share on LinkedIn
   */
  shareLinkedIn() {
    const url = window.location.href;
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank');
  },

  /**
   * Copy voting link to clipboard
   */
  async copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);

      // Change button text temporarily
      const copyBtn = event.target.closest('.share-btn');
      const originalHTML = copyBtn.innerHTML;
      copyBtn.innerHTML = '<i class="bi bi-check2 me-2"></i>Copied!';

      setTimeout(() => {
        copyBtn.innerHTML = originalHTML;
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('Failed to copy link. Please copy manually: ' + window.location.href);
    }
  }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  nomineeVoting.initialize();
});

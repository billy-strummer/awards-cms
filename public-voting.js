/* ==================================================== */
/* PUBLIC VOTING SYSTEM */
/* ==================================================== */

// Initialize Supabase
const SUPABASE_URL = 'YOUR_SUPABASE_URL'; // TODO: Replace
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'; // TODO: Replace
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const votingSystem = {
  allEntries: [],
  currentEntryId: null,
  voterEmail: localStorage.getItem('voterEmail') || null,

  /**
   * Initialize voting system
   */
  async initialize() {
    await this.loadAwards();
    await this.loadEntries();
    this.setupEventListeners();
  },

  /**
   * Load awards for filter
   */
  async loadAwards() {
    try {
      const { data: awards, error } = await supabase
        .from('awards')
        .select('id, award_name')
        .eq('is_active', true)
        .order('award_name');

      if (error) throw error;

      const filter = document.getElementById('awardFilter');
      filter.innerHTML = '<option value="">All Categories</option>' +
        awards.map(a => `<option value="${a.id}">${a.award_name}</option>`).join('');

    } catch (error) {
      console.error('Error loading awards:', error);
    }
  },

  /**
   * Load entries for voting
   */
  async loadEntries() {
    try {
      const { data: entries, error } = await supabase
        .from('entries')
        .select(`
          *,
          organisations(company_name, logo_url, website),
          awards(award_name, category)
        `)
        .eq('is_public', true)
        .eq('allow_public_voting', true)
        .in('status', ['shortlisted', 'submitted'])
        .order('public_votes', { ascending: false });

      if (error) throw error;

      this.allEntries = entries || [];

      // Check which entries user has already voted for
      if (this.voterEmail) {
        const { data: votes } = await supabase
          .from('public_votes')
          .select('entry_id')
          .eq('voter_email', this.voterEmail);

        const votedIds = votes?.map(v => v.entry_id) || [];
        this.allEntries = this.allEntries.map(entry => ({
          ...entry,
          hasVoted: votedIds.includes(entry.id)
        }));
      }

      this.renderEntries();
      this.updateTotalVotes();

    } catch (error) {
      console.error('Error loading entries:', error);
      document.getElementById('entriesGrid').innerHTML = `
        <div class="alert alert-danger">
          Failed to load entries. Please refresh the page.
        </div>
      `;
    }
  },

  /**
   * Render entries
   */
  renderEntries() {
    const grid = document.getElementById('entriesGrid');

    if (this.allEntries.length === 0) {
      grid.innerHTML = `
        <div class="entry-card text-center">
          <i class="bi bi-inbox display-1 opacity-25"></i>
          <p class="text-muted mt-3">No entries available for voting at this time</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = this.allEntries.map(entry => `
      <div class="entry-card ${entry.hasVoted ? 'voted' : ''}">
        <div class="row align-items-center">
          <div class="col-md-2 text-center">
            ${entry.organisations?.logo_url
              ? `<img src="${entry.organisations.logo_url}" alt="${entry.organisations.company_name}" class="company-logo">`
              : `<div class="company-logo bg-light d-flex align-items-center justify-content-center">
                   <i class="bi bi-building fs-1 text-muted"></i>
                 </div>`
            }
          </div>
          <div class="col-md-7">
            <h4 class="mb-2">${entry.organisations?.company_name || 'Unknown Company'}</h4>
            <p class="text-muted mb-2">
              <i class="bi bi-award me-2"></i>${entry.awards?.award_name || 'Unknown Award'}
            </p>
            <h6>${entry.entry_title}</h6>
            <p class="text-muted small">${entry.entry_description ? entry.entry_description.substring(0, 150) + '...' : ''}</p>
            ${entry.organisations?.website ?
              `<a href="${entry.organisations.website}" target="_blank" class="btn btn-sm btn-outline-primary">
                <i class="bi bi-link-45deg me-1"></i>Visit Website
              </a>` : ''
            }
          </div>
          <div class="col-md-3 text-center">
            <div class="vote-count mb-3">
              <i class="bi bi-hand-thumbs-up me-2"></i>
              ${entry.public_votes || 0} votes
            </div>
            <button class="vote-button ${entry.hasVoted ? 'btn btn-success' : ''}"
                    onclick="votingSystem.vote('${entry.id}')"
                    ${entry.hasVoted ? 'disabled' : ''}>
              ${entry.hasVoted
                ? '<i class="bi bi-check-circle me-2"></i>Voted'
                : '<i class="bi bi-hand-thumbs-up me-2"></i>Vote Now'
              }
            </button>
          </div>
        </div>
      </div>
    `).join('');
  },

  /**
   * Filter by award
   */
  filterByAward() {
    const awardId = document.getElementById('awardFilter').value;

    if (awardId) {
      this.filteredEntries = this.allEntries.filter(e => e.award_id === awardId);
    } else {
      this.filteredEntries = [...this.allEntries];
    }

    const grid = document.getElementById('entriesGrid');
    if (this.filteredEntries.length === 0) {
      grid.innerHTML = `
        <div class="entry-card text-center">
          <p class="text-muted">No entries in this category</p>
        </div>
      `;
    } else {
      this.allEntries = this.filteredEntries;
      this.renderEntries();
    }
  },

  /**
   * Vote for entry
   */
  async vote(entryId) {
    this.currentEntryId = entryId;

    // If user already has email stored, submit vote directly
    if (this.voterEmail) {
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
    document.getElementById('verificationModal').style.display = 'block';
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
        .eq('entry_id', this.currentEntryId)
        .eq('voter_email', this.voterEmail)
        .single();

      if (existingVote) {
        alert('You have already voted for this entry!');
        this.closeVerificationModal();
        return;
      }

      // Insert vote
      const { error } = await supabase
        .from('public_votes')
        .insert([{
          entry_id: this.currentEntryId,
          voter_email: this.voterEmail,
          voter_name: voterName,
          voter_ip: await this.getIPAddress(),
          vote_value: 1,
          email_verified: false, // Will be verified via email
          verification_token: this.generateToken(),
          verification_sent_at: new Date().toISOString()
        }]);

      if (error) throw error;

      // Close verification modal if open
      this.closeVerificationModal();

      // Show success modal
      this.showSuccessModal();

      // Send verification email
      await this.sendVerificationEmail();

      // Reload entries to update vote counts
      await this.loadEntries();

    } catch (error) {
      console.error('Error submitting vote:', error);
      alert('Failed to submit vote. Please try again.');
    }
  },

  /**
   * Show success modal
   */
  showSuccessModal() {
    document.getElementById('successModal').style.display = 'block';
    setTimeout(() => {
      this.closeSuccessModal();
    }, 3000);
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
    console.log(`Sending verification email to ${this.voterEmail}`);

    // Email should contain:
    // - Thank you message
    // - Verification link
    // - Entry details
  },

  /**
   * Update total votes counter
   */
  updateTotalVotes() {
    const total = this.allEntries.reduce((sum, entry) => sum + (entry.public_votes || 0), 0);
    document.getElementById('totalVotes').textContent = total.toLocaleString();
  }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  votingSystem.initialize();
});

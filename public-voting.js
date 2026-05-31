/* ==================================================== */
/* PUBLIC VOTING SYSTEM */
/* ==================================================== */

// Lightweight toast for public pages (replaces alert())
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
  requestAnimationFrame(() => (toast.style.opacity = '1'));
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// HTML escape helper for safe rendering
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Call the voting proxy API.
 * All database access is routed through /api/voting-proxy instead of
 * direct Supabase client calls.
 */
async function votingApi(action, params = {}) {
  const res = await fetch('/api/voting-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...params }),
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || 'API request failed');
    err.status = res.status;
    err.code = data.code;
    throw err;
  }
  return data;
}

const votingSystem = {
  allEntries: [],
  currentEntryId: null,
  voterEmail: sessionStorage.getItem('voterEmail') || null,

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
      const { awards } = await votingApi('load_awards');

      const filter = document.getElementById('awardFilter');
      filter.innerHTML =
        '<option value="">All Categories</option>' +
        awards.map((a) => `<option value="${esc(a.id)}">${esc(a.award_name)}</option>`).join('');
    } catch (error) {
      console.error('Error loading awards:', error);
    }
  },

  /**
   * Load entries for voting
   */
  async loadEntries() {
    try {
      const { entries } = await votingApi('load_entries');

      this.allEntries = entries || [];

      // Check which entries user has already voted for
      if (this.voterEmail) {
        const { entry_ids } = await votingApi('check_votes', {
          voter_email: this.voterEmail,
        });

        const votedIds = entry_ids || [];
        this.allEntries = this.allEntries.map((entry) => ({
          ...entry,
          hasVoted: votedIds.includes(entry.id),
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
  renderEntries(entries) {
    const entriesToRender = entries || this.allEntries;
    const grid = document.getElementById('entriesGrid');

    if (entriesToRender.length === 0) {
      grid.innerHTML = `
        <div class="entry-card text-center">
          <i class="bi bi-inbox display-1 opacity-25"></i>
          <p class="text-muted mt-3">No entries available for voting at this time</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = entriesToRender
      .map(
        (entry) => `
      <div class="entry-card ${entry.hasVoted ? 'voted' : ''}">
        <div class="row align-items-center">
          <div class="col-md-2 text-center">
            ${
              entry.organisations?.logo_url
                ? `<img src="${esc(entry.organisations.logo_url)}" alt="${esc(entry.organisations.company_name)}" class="company-logo">`
                : `<div class="company-logo bg-light d-flex align-items-center justify-content-center">
                   <i class="bi bi-building fs-1 text-muted"></i>
                 </div>`
            }
          </div>
          <div class="col-md-7">
            <h4 class="mb-2">${esc(entry.organisations?.company_name || 'Unknown Company')}</h4>
            <p class="text-muted mb-2">
              <i class="bi bi-award me-2"></i>${esc(entry.awards?.award_name || 'Unknown Award')}
            </p>
            <h6>${esc(entry.entry_title)}</h6>
            <p class="text-muted small">${entry.entry_description ? esc(entry.entry_description.substring(0, 150)) + '...' : ''}</p>
            ${
              entry.organisations?.website
                ? `<a href="${esc(entry.organisations.website)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline-primary">
                <i class="bi bi-link-45deg me-1"></i>Visit Website
              </a>`
                : ''
            }
          </div>
          <div class="col-md-3 text-center">
            <div class="vote-count mb-3">
              <i class="bi bi-hand-thumbs-up me-2"></i>
              ${parseInt(entry.public_votes) || 0} votes
            </div>
            <button class="vote-button ${entry.hasVoted ? 'btn btn-success' : ''}"
                    data-action="votingSystem.vote" data-id="${esc(entry.id)}"
                    ${entry.hasVoted ? 'disabled' : ''}>
              ${
                entry.hasVoted
                  ? '<i class="bi bi-check-circle me-2"></i>Voted'
                  : '<i class="bi bi-hand-thumbs-up me-2"></i>Vote Now'
              }
            </button>
          </div>
        </div>
      </div>
    `
      )
      .join('');
  },

  /**
   * Filter by award
   */
  filterByAward() {
    const awardId = document.getElementById('awardFilter').value;

    if (awardId) {
      this.filteredEntries = this.allEntries.filter((e) => e.award_id === awardId);
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
      this.renderEntries(this.filteredEntries);
    }
  },

  /**
   * Vote for entry
   */
  async vote(entryId) {
    this.currentEntryId = entryId;
    this.currentVote = this.allEntries.find((e) => e.id === entryId) || null;

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
    // Filter nominees by award category
    const awardFilter = document.getElementById('awardFilter');
    if (awardFilter) {
      awardFilter.addEventListener('change', () => this.filterByAward());
    }

    document.getElementById('verificationForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      this.voterEmail = document.getElementById('voterEmail').value;
      const voterName = document.getElementById('voterName').value;

      // Store email locally
      sessionStorage.setItem('voterEmail', this.voterEmail);
      if (voterName) {
        sessionStorage.setItem('voterName', voterName);
      }

      await this.submitVote();
    });
  },

  /**
   * Submit vote
   */
  async submitVote() {
    // Prevent double-submit
    if (this._submittingVote) return;
    this._submittingVote = true;
    try {
      const voterName = sessionStorage.getItem('voterName') || '';

      // Rate limit: max 10 votes per hour per email (server enforces too)
      const { count: recentVotes } = await votingApi('check_rate_limit', {
        voter_email: this.voterEmail,
      });
      if (recentVotes >= 10) {
        showPublicToast('You have reached the voting limit. Please try again later.', 'warning');
        this.closeVerificationModal();
        return;
      }

      // Check if already voted for this entry
      const { exists } = await votingApi('check_existing_vote', {
        entry_id: this.currentEntryId,
        voter_email: this.voterEmail,
      });

      if (exists) {
        showPublicToast('You have already voted for this entry!', 'warning');
        this.closeVerificationModal();
        return;
      }

      // Submit vote via API (rate limit + duplicate check enforced server-side too)
      await votingApi('submit_vote', {
        entry_id: this.currentEntryId,
        voter_email: this.voterEmail,
        voter_name: voterName,
        voter_ip: 'unknown',
        verification_token: this.generateToken(),
      });

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
      if (error?.status === 409) {
        showPublicToast('You have already voted for this entry!', 'warning');
      } else {
        showPublicToast('Failed to submit vote. Please try again.', 'error');
      }
    } finally {
      this._submittingVote = false;
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
   * Generate verification token
   */
  generateToken() {
    return crypto.randomUUID().replace(/-/g, '');
  },

  /**
   * Send verification email via the resend-email API
   */
  async sendVerificationEmail() {
    try {
      const resp = await fetch('/api/voting-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_vote_confirmation',
          voter_email: this.voterEmail,
          company_name: this.currentVote?.company_name || 'N/A',
          award_name: this.currentVote?.award_name || 'British Trade Awards',
        }),
      });
      if (!resp.ok) {
        console.warn('Vote confirmation email failed:', resp.status);
      }
    } catch (e) {
      console.warn('Email service unavailable:', e.message);
    }
  },

  /**
   * Update total votes counter
   */
  updateTotalVotes() {
    const total = this.allEntries.reduce((sum, entry) => sum + (entry.public_votes || 0), 0);
    document.getElementById('totalVotes').textContent = total.toLocaleString();
  },
};

// Expose on window for tests and event delegation.
// NOTE: This is a public-facing page that runs outside the main CMS app and does
// not load ModuleRegistry. Direct window.* assignment is intentional here.
window.votingSystem = votingSystem;
window.votingApi = votingApi;
window.showPublicToast = showPublicToast;
window.esc = esc;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  votingSystem.initialize();
});

/* ==================================================== */
/* JUDGE PORTAL - Judging Interface and Scoring */
/* ==================================================== */

// Initialize Supabase
const SUPABASE_URL = 'YOUR_SUPABASE_URL'; // TODO: Replace
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'; // TODO: Replace
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const judgePortal = {
  currentJudge: null,
  assignedEntries: [],
  currentEntry: null,
  currentScore: null,
  scoringCriteria: [
    { id: 'innovation_score', name: 'Innovation & Creativity', maxScore: 10, weight: 0.2 },
    { id: 'impact_score', name: 'Business Impact', maxScore: 10, weight: 0.3 },
    { id: 'quality_score', name: 'Quality & Excellence', maxScore: 10, weight: 0.25 },
    { id: 'presentation_score', name: 'Presentation', maxScore: 10, weight: 0.25 }
  ],

  /**
   * Initialize judge portal
   */
  async initialize() {
    // Check if judge is logged in (you'd implement proper auth)
    const judgeEmail = this.getJudgeFromSession();
    if (!judgeEmail) {
      window.location.href = '/judge-login.html';
      return;
    }

    this.currentJudge = { email: judgeEmail, name: 'Judge' }; // TODO: Get from database

    // Update UI with judge info
    document.getElementById('judgeName').textContent = this.currentJudge.name;
    document.getElementById('judgeEmail').textContent = this.currentJudge.email;

    // Load assigned entries
    await this.loadAssignedEntries();

    // Update progress
    this.updateProgress();
  },

  /**
   * Get judge from session (simplified - use proper auth in production)
   */
  getJudgeFromSession() {
    return localStorage.getItem('judgeEmail') || 'judge@example.com'; // Placeholder
  },

  /**
   * Load entries assigned to this judge
   */
  async loadAssignedEntries() {
    try {
      // In a real system, you'd have a judge_assignments table
      // For now, we'll load entries that need judging

      const { data: entries, error } = await supabase
        .from('entries')
        .select(`
          *,
          organisations(company_name, logo_url),
          awards(award_name, category),
          entry_files(*),
          judge_scores!judge_scores_entry_id_fkey(*)
        `)
        .eq('status', 'submitted')
        .order('submission_date', { ascending: true });

      if (error) throw error;

      this.assignedEntries = entries || [];

      // Check which entries this judge has already scored
      this.assignedEntries = this.assignedEntries.map(entry => {
        const existingScore = entry.judge_scores?.find(
          score => score.judge_email === this.currentJudge.email
        );
        return {
          ...entry,
          hasScored: !!existingScore,
          myScore: existingScore || null
        };
      });

      this.renderEntriesList();

    } catch (error) {
      console.error('Error loading entries:', error);
      alert('Failed to load entries: ' + error.message);
    }
  },

  /**
   * Render entries list
   */
  renderEntriesList() {
    const container = document.getElementById('entriesList');
    const totalCount = document.getElementById('totalEntriesCount');

    totalCount.textContent = this.assignedEntries.length;

    if (this.assignedEntries.length === 0) {
      container.innerHTML = `
        <div class="text-center py-5 text-muted">
          <i class="bi bi-inbox display-4 d-block mb-2 opacity-25"></i>
          <p>No entries assigned</p>
        </div>
      `;
      return;
    }

    container.innerHTML = this.assignedEntries.map(entry => `
      <div class="entry-card ${entry.hasScored ? 'scored' : ''} ${this.currentEntry?.id === entry.id ? 'active' : ''}"
           onclick="judgePortal.selectEntry('${entry.id}')">
        <div class="d-flex justify-content-between align-items-start mb-2">
          <strong class="text-truncate">${entry.organisations?.company_name || 'Unknown'}</strong>
          ${entry.hasScored ? '<i class="bi bi-check-circle-fill text-success"></i>' : ''}
        </div>
        <div class="small text-muted mb-1">${entry.awards?.award_name || ''}</div>
        <div class="small text-truncate">${entry.entry_title}</div>
        ${entry.hasScored ? `<div class="small text-success mt-2">Score: ${entry.myScore?.total_score || 0}/40</div>` : ''}
      </div>
    `).join('');
  },

  /**
   * Filter entries
   */
  filterEntries() {
    const filter = document.getElementById('entriesFilter').value;

    if (filter === 'all') {
      this.renderEntriesList();
    } else if (filter === 'pending') {
      const pending = this.assignedEntries.filter(e => !e.hasScored);
      this.renderFilteredEntries(pending);
    } else if (filter === 'scored') {
      const scored = this.assignedEntries.filter(e => e.hasScored);
      this.renderFilteredEntries(scored);
    }
  },

  /**
   * Render filtered entries
   */
  renderFilteredEntries(entries) {
    const container = document.getElementById('entriesList');
    // Same rendering logic as renderEntriesList but with filtered array
    container.innerHTML = entries.map(entry => `
      <div class="entry-card ${entry.hasScored ? 'scored' : ''} ${this.currentEntry?.id === entry.id ? 'active' : ''}"
           onclick="judgePortal.selectEntry('${entry.id}')">
        <div class="d-flex justify-content-between align-items-start mb-2">
          <strong class="text-truncate">${entry.organisations?.company_name || 'Unknown'}</strong>
          ${entry.hasScored ? '<i class="bi bi-check-circle-fill text-success"></i>' : ''}
        </div>
        <div class="small text-muted mb-1">${entry.awards?.award_name || ''}</div>
        <div class="small text-truncate">${entry.entry_title}</div>
        ${entry.hasScored ? `<div class="small text-success mt-2">Score: ${entry.myScore?.total_score || 0}/40</div>` : ''}
      </div>
    `).join('');
  },

  /**
   * Select entry for judging
   */
  async selectEntry(entryId) {
    this.currentEntry = this.assignedEntries.find(e => e.id === entryId);

    if (!this.currentEntry) return;

    // Check for conflict of interest
    const hasConflict = await this.checkConflictOfInterest(this.currentEntry);

    // Load existing score if any
    this.currentScore = this.currentEntry.myScore;

    // Render judging panel
    this.renderJudgingPanel(hasConflict);

    // Update entries list to show active
    this.renderEntriesList();
  },

  /**
   * Check for conflict of interest
   */
  async checkConflictOfInterest(entry) {
    // TODO: Implement conflict checking logic
    // Check if judge's email domain matches company domain
    // Check if judge has declared conflicts
    return false; // Placeholder
  },

  /**
   * Render judging panel
   */
  renderJudgingPanel(hasConflict) {
    const panel = document.getElementById('judgingPanel');

    panel.innerHTML = `
      <!-- Entry Header -->
      <div class="d-flex justify-content-between align-items-start mb-4">
        <div>
          <h3 class="mb-1">${this.currentEntry.entry_title}</h3>
          <p class="text-muted mb-0">
            ${this.currentEntry.organisations?.company_name || 'Unknown Company'}
            | ${this.currentEntry.awards?.award_name || ''}
          </p>
        </div>
        <span class="badge bg-primary">${this.currentEntry.entry_number}</span>
      </div>

      ${hasConflict ? `
        <div class="conflict-warning">
          <h5><i class="bi bi-exclamation-triangle me-2"></i>Conflict of Interest Detected</h5>
          <p class="mb-2">You may have a conflict of interest with this entry.</p>
          <div class="form-check">
            <input class="form-check-input" type="checkbox" id="declareConflict">
            <label class="form-check-label" for="declareConflict">
              I declare that I have a conflict and should not judge this entry
            </label>
          </div>
        </div>
      ` : ''}

      <!-- Entry Content -->
      <div class="mb-4">
        <h5>Entry Description</h5>
        <div class="p-3 bg-light rounded">
          ${this.currentEntry.entry_description || 'No description provided'}
        </div>
      </div>

      <div class="mb-4">
        <h5>Why Should They Win?</h5>
        <div class="p-3 bg-light rounded" style="max-height: 300px; overflow-y: auto;">
          ${this.currentEntry.why_should_win || 'No submission provided'}
        </div>
      </div>

      ${this.currentEntry.supporting_information ? `
        <div class="mb-4">
          <h5>Supporting Information</h5>
          <div class="p-3 bg-light rounded" style="max-height: 200px; overflow-y: auto;">
            ${this.currentEntry.supporting_information}
          </div>
        </div>
      ` : ''}

      <!-- Supporting Files -->
      ${this.renderSupportingFiles()}

      <!-- Scoring Section -->
      <div class="scoring-card">
        <h5 class="mb-4">
          <i class="bi bi-star me-2"></i>Score This Entry
        </h5>

        ${this.renderScoringCriteria()}

        <!-- Total Score -->
        <div class="total-score mt-4">
          <div class="mb-2">Total Score</div>
          <h3 id="totalScoreDisplay">${this.calculateTotalScore()}</h3>
          <div class="small">out of 40 points</div>
        </div>
      </div>

      <!-- Feedback Section -->
      <div class="mt-4">
        <h5>Written Feedback</h5>

        <div class="mb-3">
          <label class="form-label">Strengths</label>
          <textarea class="form-control" id="feedbackStrengths" rows="3"
                    placeholder="What are the key strengths of this entry?">${this.currentScore?.strengths || ''}</textarea>
        </div>

        <div class="mb-3">
          <label class="form-label">Areas for Improvement</label>
          <textarea class="form-control" id="feedbackWeaknesses" rows="3"
                    placeholder="What could be improved?">${this.currentScore?.weaknesses || ''}</textarea>
        </div>

        <div class="mb-3">
          <label class="form-label">Additional Comments</label>
          <textarea class="form-control" id="feedbackComments" rows="4"
                    placeholder="Any additional feedback or notes...">${this.currentScore?.comments || ''}</textarea>
        </div>

        <div class="mb-3">
          <label class="form-label">Recommendation</label>
          <select class="form-select" id="recommendation">
            <option value="">Select recommendation...</option>
            <option value="shortlist" ${this.currentScore?.recommendation === 'shortlist' ? 'selected' : ''}>Recommend for Shortlist</option>
            <option value="maybe" ${this.currentScore?.recommendation === 'maybe' ? 'selected' : ''}>Maybe / Borderline</option>
            <option value="reject" ${this.currentScore?.recommendation === 'reject' ? 'selected' : ''}>Do Not Shortlist</option>
          </select>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="d-flex gap-2 mt-4">
        <button class="btn btn-success flex-fill" onclick="judgePortal.saveScore(true)">
          <i class="bi bi-check-circle me-2"></i>Submit Score
        </button>
        <button class="btn btn-outline-secondary" onclick="judgePortal.saveScore(false)">
          <i class="bi bi-save me-2"></i>Save Draft
        </button>
        <button class="btn btn-outline-primary" onclick="judgePortal.nextEntry()">
          Next Entry <i class="bi bi-arrow-right ms-2"></i>
        </button>
      </div>
    `;

    // Setup score sliders
    this.setupScoreSliders();
  },

  /**
   * Render supporting files
   */
  renderSupportingFiles() {
    if (!this.currentEntry.entry_files || this.currentEntry.entry_files.length === 0) {
      return '';
    }

    return `
      <div class="mb-4">
        <h5>Supporting Documents</h5>
        ${this.currentEntry.entry_files.map(file => `
          <div class="file-preview">
            <div>
              <i class="bi bi-file-earmark-pdf me-2"></i>
              <strong>${file.file_name}</strong>
              <small class="text-muted ms-2">(${(file.file_size / 1024).toFixed(1)} KB)</small>
            </div>
            <a href="${file.file_url}" target="_blank" class="btn btn-sm btn-outline-primary">
              <i class="bi bi-download"></i> View
            </a>
          </div>
        `).join('')}
      </div>
    `;
  },

  /**
   * Render scoring criteria
   */
  renderScoringCriteria() {
    return this.scoringCriteria.map(criterion => `
      <div class="score-input">
        <div style="min-width: 200px;">
          <strong>${criterion.name}</strong>
          <small class="d-block text-muted">Weight: ${(criterion.weight * 100)}%</small>
        </div>
        <input type="range" class="form-range score-slider" min="0" max="${criterion.maxScore}" step="0.5"
               id="${criterion.id}" value="${this.currentScore?.[criterion.id] || 0}"
               onchange="judgePortal.updateTotalScore()">
        <div class="score-value" id="${criterion.id}_value">${this.currentScore?.[criterion.id] || 0}</div>
      </div>
    `).join('');
  },

  /**
   * Setup score sliders
   */
  setupScoreSliders() {
    this.scoringCriteria.forEach(criterion => {
      const slider = document.getElementById(criterion.id);
      const valueDisplay = document.getElementById(`${criterion.id}_value`);

      if (slider && valueDisplay) {
        slider.addEventListener('input', (e) => {
          valueDisplay.textContent = e.target.value;
          this.updateTotalScore();
        });
      }
    });
  },

  /**
   * Calculate total score
   */
  calculateTotalScore() {
    let total = 0;

    this.scoringCriteria.forEach(criterion => {
      const slider = document.getElementById(criterion.id);
      if (slider) {
        total += parseFloat(slider.value) || 0;
      }
    });

    return total.toFixed(1);
  },

  /**
   * Update total score display
   */
  updateTotalScore() {
    const display = document.getElementById('totalScoreDisplay');
    if (display) {
      display.textContent = this.calculateTotalScore();
    }
  },

  /**
   * Save score
   */
  async saveScore(isComplete) {
    try {
      // Get scores from sliders
      const scores = {};
      this.scoringCriteria.forEach(criterion => {
        const slider = document.getElementById(criterion.id);
        scores[criterion.id] = parseFloat(slider.value) || 0;
      });

      const totalScore = parseFloat(this.calculateTotalScore());

      // Get feedback
      const strengths = document.getElementById('feedbackStrengths').value;
      const weaknesses = document.getElementById('feedbackWeaknesses').value;
      const comments = document.getElementById('feedbackComments').value;
      const recommendation = document.getElementById('recommendation').value;

      // Check for conflict
      const hasConflict = document.getElementById('declareConflict')?.checked || false;

      const scoreData = {
        entry_id: this.currentEntry.id,
        judge_email: this.currentJudge.email,
        judge_name: this.currentJudge.name,
        ...scores,
        total_score: totalScore,
        strengths,
        weaknesses,
        comments,
        recommendation,
        has_conflict: hasConflict,
        is_complete: isComplete,
        scored_at: new Date().toISOString()
      };

      // Upsert score (update if exists, insert if new)
      const { error } = await supabase
        .from('judge_scores')
        .upsert([scoreData], {
          onConflict: 'entry_id,judge_email'
        });

      if (error) throw error;

      alert(isComplete ? 'Score submitted successfully!' : 'Score saved as draft');

      // Reload entries to update status
      await this.loadAssignedEntries();
      this.updateProgress();

      // Move to next entry if submitted
      if (isComplete) {
        this.nextEntry();
      }

    } catch (error) {
      console.error('Error saving score:', error);
      alert('Failed to save score: ' + error.message);
    }
  },

  /**
   * Move to next entry
   */
  nextEntry() {
    const currentIndex = this.assignedEntries.findIndex(e => e.id === this.currentEntry.id);
    const nextIndex = currentIndex + 1;

    if (nextIndex < this.assignedEntries.length) {
      this.selectEntry(this.assignedEntries[nextIndex].id);
    } else {
      alert('You have reviewed all assigned entries!');
    }
  },

  /**
   * Update progress tracker
   */
  updateProgress() {
    const scored = this.assignedEntries.filter(e => e.hasScored).length;
    const pending = this.assignedEntries.length - scored;
    const percent = this.assignedEntries.length > 0
      ? Math.round((scored / this.assignedEntries.length) * 100)
      : 0;

    document.getElementById('scoredCount').textContent = scored;
    document.getElementById('pendingCount').textContent = pending;
    document.getElementById('completionPercent').textContent = percent + '%';
    document.getElementById('progressBar').style.width = percent + '%';
  },

  /**
   * Logout
   */
  logout() {
    localStorage.removeItem('judgeEmail');
    window.location.href = '/judge-login.html';
  }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  judgePortal.initialize();
});

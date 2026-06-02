/**
 * UI INITIALISATION
 * Replaces all inline <script> blocks so the page complies with the
 * Content Security Policy (no 'unsafe-inline' required).
 *
 * Runs after the full DOM is parsed (placed at end of body, with other
 * app scripts). Covers:
 *   1. Hide already-dismissed "Getting Started" banners
 *   2. Restore sidebar collapse state from localStorage
 *   3. Auto-insert "* Required fields" legend in modals
 *   4. Global confirmation-dialog helpers (window.globalActions)
 *   5. Settings: move overflow panel into correct tab pane
 */

// ── 1. Hide "Getting Started" banners already dismissed ───────────
(function hideDismissedBanners() {
  const pairs = [
    ['awardsWorkflowDismissed', 'awardsGettingStarted'],
    ['orgsWorkflowDismissed', 'orgsGettingStarted'],
    ['winnersWorkflowDismissed', 'winnersGettingStarted'],
    ['entriesWorkflowDismissed', 'entriesGettingStarted'],
    ['mediaGalleryWorkflowDismissed', 'mediaGalleryGettingStarted'],
    ['eventsWorkflowDismissed', 'eventsGettingStarted'],
    ['reportsWorkflowDismissed', 'reportsGettingStarted'],
    ['mktWorkflowDismissed', 'marketingGettingStarted'],
    ['socialMediaBannerDismissed', 'socialMediaGettingStarted'],
    ['emailBuilderBannerDismissed', 'emailBuilderGettingStarted'],
    ['paymentsWorkflowDismissed', 'paymentsGettingStarted'],
    ['crmWorkflowDismissed', 'crmGettingStarted'],
    ['settingsWorkflowDismissed', 'settingsGettingStarted'],
  ];
  pairs.forEach(([key, id]) => {
    if (localStorage.getItem(key) === '1') {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    }
  });
})();

// ── 2. Sidebar collapse state ──────────────────────────────────────
(function initSidebar() {
  const sidebar = document.getElementById('appSidebar');
  const toggle = document.getElementById('sidebarToggle');
  if (!sidebar || !toggle) return;
  const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
  if (isCollapsed) sidebar.classList.add('collapsed');
  toggle.title = isCollapsed ? 'Expand sidebar' : 'Collapse sidebar';
  toggle.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    const collapsed = sidebar.classList.contains('collapsed');
    localStorage.setItem('sidebarCollapsed', String(collapsed));
    toggle.title = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
  });
  document.addEventListener('shown.bs.tab', (e) => {
    sidebar.querySelectorAll('.sidebar-nav-link').forEach((btn) => {
      btn.classList.remove('active');
      btn.setAttribute('aria-selected', 'false');
    });
    if (e.target && e.target.closest('.app-sidebar')) {
      e.target.classList.add('active');
      e.target.setAttribute('aria-selected', 'true');
    }
  });
})();

// ── 3. Auto-insert "* Required fields" legend in modals ───────────
document.addEventListener('show.bs.modal', (e) => {
  const modal = e.target;
  const form = modal.querySelector('form');
  if (!form || modal.querySelector('.required-field-legend')) return;
  if (!form.querySelector('[required]')) return;
  const legend = document.createElement('p');
  legend.className = 'required-field-legend text-muted small mb-3 pb-2 border-bottom';
  legend.innerHTML = '<span class="text-danger fw-semibold" aria-hidden="true">*</span> Required fields';
  form.insertBefore(legend, form.firstChild);
});

// ── 4. Global confirmation-dialog helpers ─────────────────────────
window.globalActions = {
  confirmBulkDelete(el) {
    const module = el.dataset.module;
    const fn = el.dataset.fn;
    const label = el.dataset.label || 'item';
    const verb = el.dataset.verb || 'Delete';
    const checked = document.querySelectorAll(
      'input[type="checkbox"]:checked:not(#awardsSelectAll):not(#selectAllOrgs):not([id$="SelectAll"]):not([id$="selectAll"])'
    );
    const count = checked.length || 'the selected';
    const plural = count !== 1 ? 's' : '';
    document.getElementById('bulkDeleteConfirmTitle').textContent =
      `${verb} ${label}${typeof count === 'number' ? 's' : ''}`;
    document.getElementById('bulkDeleteConfirmMsg').textContent = `${verb} ${count} ${label}${plural}?`;
    document.getElementById('bulkDeleteConfirmBtnLabel').textContent = verb;
    document.getElementById('bulkDeleteConfirmBtn').onclick = () => {
      bootstrap.Modal.getInstance(document.getElementById('bulkDeleteConfirmModal'))?.hide();
      const mod = window[module];
      if (mod && typeof mod[fn] === 'function') mod[fn]();
    };
    new bootstrap.Modal(document.getElementById('bulkDeleteConfirmModal')).show();
  },
  confirmClearCanvas() {
    document.getElementById('bulkDeleteConfirmTitle').textContent = 'Clear Email Canvas';
    document.getElementById('bulkDeleteConfirmMsg').textContent = 'Clear the entire email canvas?';
    document.getElementById('bulkDeleteConfirmSub').textContent =
      'All your email content will be removed and cannot be recovered.';
    document.getElementById('bulkDeleteConfirmBtnLabel').textContent = 'Clear Canvas';
    document.getElementById('bulkDeleteConfirmBtn').onclick = () => {
      bootstrap.Modal.getInstance(document.getElementById('bulkDeleteConfirmModal'))?.hide();
      window.emailBuilder?.clearCanvas();
    };
    new bootstrap.Modal(document.getElementById('bulkDeleteConfirmModal')).show();
  },
};

// ── 5. Settings: move overflow panel into correct tab pane ─────────
(function fixSettingsOverflow() {
  const overflow = document.getElementById('settings-security-overflow');
  const secPane = document.getElementById('settings-security');
  if (overflow && secPane) {
    while (overflow.firstChild) secPane.appendChild(overflow.firstChild);
    overflow.remove();
  }
})();

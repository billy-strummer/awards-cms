/**
 * Global Actions
 *
 * Extracted from index.html inline <script> blocks to allow removal of
 * 'unsafe-inline' from the Content-Security-Policy script-src directive.
 *
 * Contains:
 *  - Auto-insert required-field legend in modals
 *  - Sidebar collapse state management
 *  - window.globalActions for confirmation dialogs and inline-handler replacements
 *  - workflow-dismissed banner hiding
 *  - Judge Portal URL display
 *  - Settings security overflow migration
 */

/* ── Required-field legend ── */
document.addEventListener('show.bs.modal', function (e) {
  var modal = e.target;
  var form = modal.querySelector('form');
  if (!form || modal.querySelector('.required-field-legend')) return;
  if (!form.querySelector('[required]')) return;
  var legend = document.createElement('p');
  legend.className = 'required-field-legend text-muted small mb-3 pb-2 border-bottom';
  legend.innerHTML = '<span class="text-danger fw-semibold" aria-hidden="true">*</span> Required fields';
  form.insertBefore(legend, form.firstChild);
});

/* ── Sidebar collapse state ── */
(function () {
  var sidebar = document.getElementById('appSidebar');
  var toggle = document.getElementById('sidebarToggle');
  if (!sidebar || !toggle) return;
  var isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
  if (isCollapsed) sidebar.classList.add('collapsed');
  toggle.title = isCollapsed ? 'Expand sidebar' : 'Collapse sidebar';
  toggle.addEventListener('click', function () {
    sidebar.classList.toggle('collapsed');
    var collapsed = sidebar.classList.contains('collapsed');
    localStorage.setItem('sidebarCollapsed', collapsed);
    toggle.title = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
  });
  /* Sync active state when Bootstrap switches tab */
  document.addEventListener('shown.bs.tab', function (e) {
    sidebar.querySelectorAll('.sidebar-nav-link').forEach(function (btn) {
      btn.classList.remove('active');
      btn.setAttribute('aria-selected', 'false');
    });
    if (e.target && e.target.closest('.app-sidebar')) {
      e.target.classList.add('active');
      e.target.setAttribute('aria-selected', 'true');
    }
  });
})();

/* ── Workflow-dismissed banner hiding ── */
(function () {
  var banners = [
    { key: 'awardsWorkflowDismissed', id: 'awardsGettingStarted' },
    { key: 'orgsWorkflowDismissed', id: 'orgsGettingStarted' },
    { key: 'winnersWorkflowDismissed', id: 'winnersGettingStarted' },
    { key: 'entriesWorkflowDismissed', id: 'entriesGettingStarted' },
    { key: 'mediaGalleryWorkflowDismissed', id: 'mediaGalleryGettingStarted' },
    { key: 'eventsWorkflowDismissed', id: 'eventsGettingStarted' },
    { key: 'reportsWorkflowDismissed', id: 'reportsGettingStarted' },
    { key: 'mktWorkflowDismissed', id: 'marketingGettingStarted' },
    { key: 'socialMediaBannerDismissed', id: 'socialMediaGettingStarted' },
    { key: 'emailBuilderBannerDismissed', id: 'emailBuilderGettingStarted' },
    { key: 'paymentsWorkflowDismissed', id: 'paymentsGettingStarted' },
    { key: 'crmWorkflowDismissed', id: 'crmGettingStarted' },
    { key: 'settingsWorkflowDismissed', id: 'settingsGettingStarted' },
  ];
  banners.forEach(function (b) {
    if (localStorage.getItem(b.key) === '1') {
      var el = document.getElementById(b.id);
      if (el) el.style.display = 'none';
    }
  });
})();

/* ── Judge Portal URL display ── */
(function () {
  var el = document.getElementById('judgePortalUrlDisplay');
  if (el) el.textContent = window.location.origin + '/judge-portal.html';
})();

/* ── Settings security overflow migration ── */
(function () {
  var overflow = document.getElementById('settings-security-overflow');
  var secPane = document.getElementById('settings-security');
  if (overflow && secPane) {
    while (overflow.firstChild) secPane.appendChild(overflow.firstChild);
    overflow.remove();
  }
})();

/* ── Global actions for confirmation dialogs and inline-handler replacements ── */
window.globalActions = {
  /* Bulk-delete confirmation dialog */
  confirmBulkDelete: function (el) {
    var module = el.dataset.module;
    var fn = el.dataset.fn;
    var label = el.dataset.label || 'item';
    var verb = el.dataset.verb || 'Delete';
    var checked = document.querySelectorAll(
      'input[type="checkbox"]:checked:not(#awardsSelectAll):not(#selectAllOrgs):not([id$="SelectAll"]):not([id$="selectAll"])'
    );
    var count = checked.length || 'the selected';
    var plural = count !== 1 ? 's' : '';
    document.getElementById('bulkDeleteConfirmTitle').textContent =
      verb + ' ' + label + (typeof count === 'number' ? 's' : '');
    document.getElementById('bulkDeleteConfirmMsg').textContent = verb + ' ' + count + ' ' + label + plural + '?';
    document.getElementById('bulkDeleteConfirmBtnLabel').textContent = verb;
    document.getElementById('bulkDeleteConfirmBtn').onclick = function () {
      bootstrap.Modal.getInstance(document.getElementById('bulkDeleteConfirmModal'))?.hide();
      var mod = window[module];
      if (mod && typeof mod[fn] === 'function') mod[fn]();
    };
    new bootstrap.Modal(document.getElementById('bulkDeleteConfirmModal')).show();
  },

  /* Clear-canvas confirmation dialog */
  confirmClearCanvas: function () {
    document.getElementById('bulkDeleteConfirmTitle').textContent = 'Clear Email Canvas';
    document.getElementById('bulkDeleteConfirmMsg').textContent = 'Clear the entire email canvas?';
    document.getElementById('bulkDeleteConfirmSub').textContent =
      'All your email content will be removed and cannot be recovered.';
    document.getElementById('bulkDeleteConfirmBtnLabel').textContent = 'Clear Canvas';
    document.getElementById('bulkDeleteConfirmBtn').onclick = function () {
      bootstrap.Modal.getInstance(document.getElementById('bulkDeleteConfirmModal'))?.hide();
      if (window.emailBuilder) emailBuilder.clearCanvas();
    };
    new bootstrap.Modal(document.getElementById('bulkDeleteConfirmModal')).show();
  },

  /* Show keyboard shortcuts modal */
  showShortcutsModal: function () {
    var m = document.getElementById('shortcutsHelpModal');
    if (m) new bootstrap.Modal(m).show();
  },

  /* Dismiss a workflow/getting-started banner and persist to localStorage */
  dismissBanner: function (el) {
    var key = el.dataset.dismissKey;
    var bannerId = el.dataset.dismissId || el.closest('[id$="GettingStarted"]')?.id;
    if (key) localStorage.setItem(key, '1');
    var banner = bannerId ? document.getElementById(bannerId) : el.closest('.alert, [id$="GettingStarted"]');
    if (banner) banner.style.display = 'none';
  },

  /* Date-range preset buttons in Reporting */
  setLastNDays: function (el) {
    var n = parseInt(el.dataset.days || el.dataset.id || '30', 10);
    var now = new Date();
    var start = new Date(now);
    start.setDate(now.getDate() - n);
    var s = document.getElementById('reportStartDate');
    var e = document.getElementById('reportEndDate');
    if (s) s.value = start.toISOString().slice(0, 10);
    if (e) e.value = now.toISOString().slice(0, 10);
  },

  setThisQuarter: function () {
    var now = new Date();
    var q = Math.floor(now.getMonth() / 3);
    var start = new Date(now.getFullYear(), q * 3, 1);
    var s = document.getElementById('reportStartDate');
    var e = document.getElementById('reportEndDate');
    if (s) s.value = start.toISOString().slice(0, 10);
    if (e) e.value = now.toISOString().slice(0, 10);
  },

  setThisYear: function () {
    var now = new Date();
    var s = document.getElementById('reportStartDate');
    var e = document.getElementById('reportEndDate');
    if (s) s.value = now.getFullYear() + '-01-01';
    if (e) e.value = now.toISOString().slice(0, 10);
  },

  /* Toggle password/text visibility on a secret-token input */
  toggleTokenVisibility: function (el) {
    var input = el.previousElementSibling;
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
    var icon = el.querySelector('i');
    if (icon) {
      icon.classList.toggle('bi-eye');
      icon.classList.toggle('bi-eye-slash');
    }
  },

  /* Copy judge portal URL to clipboard */
  copyJudgePortalUrl: function () {
    var url = document.getElementById('judgePortalUrlDisplay')?.textContent;
    if (!url) return;
    navigator.clipboard.writeText(url).then(function () {
      if (window.utils) utils.showToast('Judge Portal URL copied to clipboard', 'success');
    });
  },
};

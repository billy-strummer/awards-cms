// Shows the "incorrect password" message when the gate redirects back with ?error=1.
// External file because the site's CSP has no 'unsafe-inline' in script-src.
(function () {
  const params = new URLSearchParams(window.location.search);
  if (params.get('error') !== '1') return;
  const errorEl = document.getElementById('cs-error');
  if (errorEl) errorEl.style.display = 'block';
})();

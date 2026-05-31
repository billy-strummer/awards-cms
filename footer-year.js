/**
 * footer-year.js
 *
 * Sets the current year on any element with id="footerYear".
 * Extracted from inline <script> blocks to allow removal of
 * 'unsafe-inline' from the Content-Security-Policy script-src directive.
 */
(function () {
  const el = document.getElementById('footerYear');
  if (el) el.textContent = new Date().getFullYear();
})();

/**
 * Shared utilities for standalone public/portal pages.
 * Loaded via <script> before each page's app script.
 * Not part of the main SPA bundle (which uses utils.js instead).
 */
/* global window, document, fetch */

window.publicUtils = (function () {
  'use strict';

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  function escapeAttr(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function toTitleCase(str) {
    if (!str) return '';
    return String(str)
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function showPublicToast(msg, type) {
    type = type || 'warning';
    var container = document.getElementById('publicToastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'publicToastContainer';
      container.setAttribute('role', 'alert');
      container.setAttribute('aria-live', 'polite');
      container.style.cssText =
        'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:99999;max-width:400px;width:calc(100% - 40px);';
      document.body.appendChild(container);
    }
    var colors = { warning: '#ffc107', error: '#dc3545', success: '#28a745', info: '#17a2b8' };
    var textColors = { warning: '#000', error: '#fff', success: '#fff', info: '#fff' };
    var toast = document.createElement('div');
    toast.style.cssText =
      'background:' +
      (colors[type] || colors.warning) +
      ';' +
      'color:' +
      (textColors[type] || '#000') +
      ';' +
      'padding:12px 20px;margin-bottom:8px;border-radius:8px;' +
      'box-shadow:0 4px 12px rgba(0,0,0,.15);font-size:14px;opacity:0;' +
      'transition:opacity .3s;text-align:center;';
    toast.textContent = msg;
    container.appendChild(toast);
    requestAnimationFrame(function () {
      toast.style.opacity = '1';
    });
    setTimeout(function () {
      toast.style.opacity = '0';
      setTimeout(function () {
        toast.remove();
      }, 300);
    }, 4000);
  }

  async function getAuthToken() {
    try {
      var client =
        window.supabase && window.SUPABASE_CONFIG
          ? window.supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey)
          : null;
      if (!client) return null;
      var result = await client.auth.getSession();
      return result.data && result.data.session ? result.data.session.access_token : null;
    } catch (_e) {
      return null;
    }
  }

  async function proxyFetch(body) {
    var token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');
    var res = await fetch('/api/data-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
      },
      body: JSON.stringify(body),
    });
    var json = await res.json();
    if (!res.ok) throw new Error(json.error || json.message || 'API error ' + res.status);
    return json;
  }

  return { escapeHtml, escapeAttr, toTitleCase, showPublicToast, getAuthToken, proxyFetch };
})();

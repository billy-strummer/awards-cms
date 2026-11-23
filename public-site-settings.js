/**
 * public-site-settings.js
 *
 * Applies centrally-managed website settings -- company details, social
 * media links, and the footer's Contact Us / Sitemap links -- to this
 * page's footer. The single source of truth is the cms_config table,
 * edited in the admin CMS under Settings -> Website Settings, and read
 * here via the same public, unauthenticated get_public_data endpoint
 * home.js already uses for season dates and the sponsors toggle.
 *
 * Every value is optional. When a setting has not been configured yet,
 * the corresponding placeholder text/segment is removed (not left showing
 * literal brackets) or the link/icon is hidden (not left pointing at "#"),
 * rather than inventing a value.
 *
 * Shared by every public page with a <footer>, so a change made once in
 * the CMS is reflected consistently everywhere instead of being hardcoded
 * per page.
 */
(function () {
  'use strict';

  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function isHttpUrl(url) {
    return typeof url === 'string' && /^https?:\/\//i.test(url.trim());
  }

  function footerEl() {
    return document.querySelector('footer');
  }

  // Replace, or cleanly remove, the "[Company Name Placeholder]" /
  // "[PLACEHOLDER]" (registration number) / "[Address Placeholder]"
  // segments in the footer's copyright line. Operates on innerHTML of the
  // smallest element containing the full line (a <p>, in every known
  // layout) so the surrounding "&nbsp;|&nbsp;" separators can be removed
  // together with an unset segment.
  function applyCompanyDetails(settings) {
    const footer = footerEl();
    if (!footer) return;

    footer.querySelectorAll('p').forEach(function (el) {
      let html = el.innerHTML;
      if (!html || html.indexOf('Company Name Placeholder') === -1) return;
      const original = html;

      if (settings.company_name) {
        html = html.replace('[Company Name Placeholder]', escapeHtml(settings.company_name));
      } else {
        html = html.replace(/\s*&nbsp;\|&nbsp;\s*<strong>\[Company Name Placeholder\]<\/strong>/, '');
      }

      if (html.indexOf('[PLACEHOLDER]') !== -1) {
        if (settings.company_registration_number) {
          html = html.replace('[PLACEHOLDER]', escapeHtml(settings.company_registration_number));
        } else {
          html = html.replace(/\s*&nbsp;\|&nbsp;\s*Reg\.\s*No\.\s*<strong>\[PLACEHOLDER\]<\/strong>/, '');
        }
      }

      if (html.indexOf('[Address Placeholder]') !== -1) {
        if (settings.company_address) {
          html = html.replace('[Address Placeholder]', escapeHtml(settings.company_address));
        } else {
          html = html.replace(/\s*&nbsp;\|&nbsp;\s*<strong>\[Address Placeholder\][^<]*<\/strong>/, '');
        }
      }

      if (html !== original) el.innerHTML = html;
    });
  }

  // Social icons are matched by their existing aria-label (LinkedIn /
  // Instagram / Facebook / X (Twitter)), not by class -- the class on these
  // anchors varies page to page, but the aria-label text is identical
  // everywhere, including on pages that have not yet adopted a shared
  // footer class.
  function applySocialLinks(socialLinks) {
    const footer = footerEl();
    if (!footer) return;

    const byPlatform = {};
    (socialLinks || []).forEach(function (s) {
      if (s && s.platform) byPlatform[String(s.platform).toLowerCase()] = s;
    });

    // Two exact aria-label conventions exist across public pages: a bare
    // platform name ("LinkedIn") on most pages, and "British Trade Awards
    // on LinkedIn" on home.html and become-a-sponsor.html. Matched exactly
    // (not by substring) so unrelated footer-adjacent controls that happen
    // to mention a platform name -- e.g. winners-portal.html's "Open
    // LinkedIn to post" share button -- are never touched.
    const labelByPlatform = {
      linkedin: ['LinkedIn', 'British Trade Awards on LinkedIn'],
      instagram: ['Instagram', 'British Trade Awards on Instagram'],
      facebook: ['Facebook', 'British Trade Awards on Facebook'],
      twitter: ['X (Twitter)', 'British Trade Awards on X (Twitter)'],
    };

    Object.keys(labelByPlatform).forEach(function (platform) {
      let anchor = null;
      labelByPlatform[platform].some(function (label) {
        anchor = footer.querySelector('a[aria-label="' + label + '"]');
        return !!anchor;
      });
      if (!anchor) return;
      const entry = byPlatform[platform];
      if (entry && entry.visible !== false && isHttpUrl(entry.url)) {
        anchor.setAttribute('href', entry.url.trim());
        anchor.style.display = '';
      } else {
        // No configured, visible URL -- hide rather than leave a dead "#"
        // link that looks clickable but goes nowhere.
        anchor.style.display = 'none';
      }
    });
  }

  // "Contact Us" already works correctly (mailto:info@britishtradeawards.com)
  // on most public pages -- only override it if an admin has explicitly set
  // a different contact URL. "Sitemap" has no real destination anywhere in
  // this codebase, so it is hidden unless/until one is configured.
  function applyFooterLinks(settings) {
    const footer = footerEl();
    if (!footer) return;

    footer.querySelectorAll('a').forEach(function (a) {
      const text = (a.textContent || '').trim();
      const href = a.getAttribute('href');

      if (text === 'Contact Us') {
        if (isHttpUrl(settings.footer_contact_url)) {
          a.setAttribute('href', settings.footer_contact_url.trim());
        } else if (href === '#') {
          a.setAttribute('href', 'mailto:' + (settings.contact_email || 'info@britishtradeawards.com'));
        }
      } else if (text === 'Sitemap' && href === '#') {
        if (isHttpUrl(settings.footer_sitemap_url)) {
          a.setAttribute('href', settings.footer_sitemap_url.trim());
        } else {
          a.style.display = 'none';
        }
      }
    });
  }

  // BTA-071: home.html's main nav/mobile-menu/CTA label text. Scoped
  // strictly to these 3 containers (not a page-wide href match) because
  // home.html has many other links sharing the same hrefs elsewhere on the
  // page (e.g. "submit-entry.html" appears on ~10 other unrelated CTA
  // buttons) -- matching by href *within* these specific, unique containers
  // is safe; matching by href alone across the whole page would not be.
  // Destinations are never changed here, only the visible text.
  function applyNavLabels(navLabels) {
    if (!navLabels) return;
    const containers = [
      document.querySelector('nav.header-nav'),
      document.querySelector('#mobile-menu .mobile-menu-inner'),
      document.querySelector('.header-cta'),
    ].filter(Boolean);
    if (!containers.length) return;

    const hrefToKey = {
      '#categories': 'categories',
      '#regions': 'regions',
      '#find-a-trade': 'findATrade',
      'about.html': 'about',
      'submit-entry.html': 'enterNow',
    };

    containers.forEach(function (container) {
      Object.keys(hrefToKey).forEach(function (href) {
        const label = navLabels[hrefToKey[href]];
        if (!label) return;
        const anchor = container.querySelector('a[href="' + href + '"]');
        if (anchor) anchor.textContent = label;
      });
    });
  }

  // BTA-071: per-page SEO title/meta-description overrides, keyed by the
  // page's own filename (without extension) as the admin-facing slug --
  // e.g. "home" for home.html, "public-voting" for public-voting.html.
  // Every page's existing hardcoded <title>/<meta description> remains in
  // place untouched when no override is configured for that page's slug.
  function currentPageSlug() {
    const file = (window.location.pathname.split('/').pop() || '').trim();
    if (!file) return 'home';
    return file.replace(/\.html?$/i, '');
  }

  function applyPageSeo(pageSeo) {
    if (!pageSeo) return;
    const entry = pageSeo[currentPageSlug()];
    if (!entry) return;

    if (entry.title) {
      document.title = entry.title;
      setMetaContent('property', 'og:title', entry.title);
    }
    if (entry.description) {
      setMetaContent('name', 'description', entry.description);
      setMetaContent('property', 'og:description', entry.description);
    }
  }

  // BTA-072: shared helper for applyPageSeo -- sets an existing <meta>
  // tag's content (matched by attribute+value, since og: tags use
  // "property" rather than "name"), or creates it if the page doesn't
  // already have one. Only ever called with the same title/description
  // values already configured for the page's <title>/meta description --
  // no new admin field or cms_config key.
  function setMetaContent(attr, value, content) {
    const selector = 'meta[' + attr + '="' + value + '"]';
    const existing = document.querySelector(selector);
    if (existing) {
      existing.setAttribute('content', content);
    } else {
      const meta = document.createElement('meta');
      meta.setAttribute(attr, value);
      meta.setAttribute('content', content);
      document.head.appendChild(meta);
    }
  }

  // Keeps "&copy; 2026 British Trade Awards" current without needing a
  // CMS field for it -- the year itself is never a business decision.
  function applyCopyrightYear() {
    const footer = footerEl();
    if (!footer) return;
    const year = String(new Date().getFullYear());
    footer.querySelectorAll('p').forEach(function (el) {
      const html = el.innerHTML;
      if (!html) return;
      const replaced = html.replace(/((?:&copy;|©)\s*)\d{4}(\s*British Trade Awards)/, '$1' + year + '$2');
      if (replaced !== html) el.innerHTML = replaced;
    });
  }

  try {
    applyCopyrightYear();
  } catch (e) {
    console.warn('[BTA] public-site-settings: copyright year', e);
  }

  if (!footerEl()) return;

  fetch('/api/entry-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'get_public_data' }),
  })
    .then(function (r) {
      return r.json();
    })
    .then(function (data) {
      const settings = (data && data.site_settings) || {};
      try {
        applyCompanyDetails(settings);
      } catch (e) {
        console.warn('[BTA] public-site-settings: company details', e);
      }
      try {
        applySocialLinks(settings.social_links);
      } catch (e) {
        console.warn('[BTA] public-site-settings: social links', e);
      }
      try {
        applyFooterLinks(settings);
      } catch (e) {
        console.warn('[BTA] public-site-settings: footer links', e);
      }
      try {
        applyNavLabels(settings.nav_labels);
      } catch (e) {
        console.warn('[BTA] public-site-settings: nav labels', e);
      }
      try {
        applyPageSeo(settings.page_seo);
      } catch (e) {
        console.warn('[BTA] public-site-settings: page SEO', e);
      }
    })
    .catch(function (e) {
      // Network/API failure: leave the page's existing fallback markup
      // untouched rather than throwing.
      console.warn('[BTA] public-site-settings: fetch failed', e);
    });
})();

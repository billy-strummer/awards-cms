/**
 * home.js — interactive behaviour for home.html.
 * Extracted from an inline <script> block so the page complies with the
 * Content Security Policy (no 'unsafe-inline' required).
 *
 * Depends on home-data.js being loaded first (sets window.BTA_HOME_DATA).
 */
(function () {
  'use strict';

  /* ============================================================
     0. CATEGORY GRID — render from BTA_HOME_DATA, optionally
        refreshed with CMS-managed custom sectors from the API.
  ============================================================ */
  try {
    (function initCategoryGrid() {
      const grid = document.getElementById('categories-grid');
      if (!grid) return;

      const data = window.BTA_HOME_DATA || {};
      const sectorCats = data.sectorCategories || {};
      const sectorMeta = data.sectorMeta || {};

      function esc(str) {
        return String(str || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      }

      function renderGrid(catMap, metaMap) {
        const sectors = Object.keys(catMap);
        const delays = ['', ' reveal-delay-1', ' reveal-delay-2', ' reveal-delay-3'];
        grid.innerHTML = sectors
          .map(function (sector, idx) {
            const m = metaMap[sector] || {};
            const num = String(idx + 1).padStart(2, '0');
            const img = m.image ? 'images/categories/' + esc(m.image) : '';
            return (
              '<a href="public-voting.html?sector=' +
              encodeURIComponent(sector) +
              '" class="cat-box reveal' +
              delays[idx % 4] +
              '" ' +
              'data-sector="' +
              esc(sector) +
              '" ' +
              'aria-label="' +
              esc(m.ariaLabel || m.displayName || sector) +
              '">' +
              (img ? '<img class="cat-bg-img" src="' + img + '" alt="" loading="lazy">' : '') +
              '<div class="cat-box-inner">' +
              '<span class="cat-number" aria-hidden="true">' +
              num +
              '</span>' +
              '<div class="cat-accent" aria-hidden="true"></div>' +
              '<h3 class="cat-name">' +
              esc(m.displayName || sector) +
              '</h3>' +
              '<p class="cat-desc">' +
              esc(m.description || '') +
              '</p>' +
              '</div>' +
              '</a>'
            );
          })
          .join('');

        if ('IntersectionObserver' in window) {
          const obs = new IntersectionObserver(
            function (entries_io) {
              entries_io.forEach(function (e) {
                if (e.isIntersecting) {
                  e.target.classList.add('visible');
                  obs.unobserve(e.target);
                }
              });
            },
            { threshold: 0.05 }
          );
          grid.querySelectorAll('.cat-box.reveal').forEach(function (el) {
            obs.observe(el);
          });
        } else {
          grid.querySelectorAll('.cat-box.reveal').forEach(function (el) {
            el.classList.add('visible');
          });
        }
      }

      renderGrid(sectorCats, sectorMeta);

      fetch('/api/voting-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'load_public_sectors' }),
      })
        .then(function (r) {
          return r.json();
        })
        .then(function (res) {
          const cms = res || {};
          const hasCustomSectors = cms.sectors && cms.sectors.length > 0;
          const hasCustomCats = cms.categories && Object.keys(cms.categories).length > 0;
          if (!hasCustomSectors && !hasCustomCats) return;

          const mergedCats = {};
          const mergedMeta = {};
          Object.keys(sectorCats).forEach(function (key) {
            mergedCats[key] = sectorCats[key].slice();
            mergedMeta[key] = sectorMeta[key] || {};
          });

          if (cms.categories) {
            Object.keys(cms.categories).forEach(function (sectorKey) {
              const normKey = sectorKey.toUpperCase();
              if (!mergedCats[normKey]) {
                mergedCats[normKey] = [];
                mergedMeta[normKey] = {
                  displayName: sectorKey.charAt(0).toUpperCase() + sectorKey.slice(1).toLowerCase(),
                  description: '',
                  image: '',
                  ariaLabel: sectorKey,
                };
              }
              cms.categories[sectorKey].forEach(function (cat) {
                if (mergedCats[normKey].indexOf(cat) === -1) mergedCats[normKey].push(cat);
              });
            });
          }

          if (cms.sectors) {
            cms.sectors.forEach(function (s) {
              const key = (s.name || '').toUpperCase();
              if (!key || mergedCats[key]) return;
              mergedCats[key] = [];
              mergedMeta[key] = {
                displayName: s.name.charAt(0).toUpperCase() + s.name.slice(1).toLowerCase(),
                description: '',
                image: '',
                ariaLabel: s.name,
              };
            });
          }

          renderGrid(mergedCats, mergedMeta);
        })
        .catch(function () {
          /* keep static render on API error */
        });
    })();
  } catch (e) {
    console.warn('[BTA] initCategoryGrid', e);
  }

  /* ============================================================
     1. SMART STICKY HEADER
  ============================================================ */
  try {
    (function initHeader() {
      const header = document.getElementById('site-header');
      let lastY = 0;
      let ticking = false;
      const THRESHOLD = 80;

      function onScroll() {
        if (!ticking) {
          window.requestAnimationFrame(updateHeader);
          ticking = true;
        }
      }

      function updateHeader() {
        const y = window.scrollY;

        if (y < THRESHOLD) {
          header.className = 'at-top';
        } else if (y > lastY + 10) {
          header.className = 'scrolled hidden';
        } else if (y <= lastY) {
          header.className = 'scrolled';
        }

        lastY = y;
        ticking = false;
      }

      window.addEventListener('scroll', onScroll, { passive: true });
      updateHeader();
    })();
  } catch (e) {
    console.warn('[BTA] initHeader', e);
  }

  /* ============================================================
     2. MOBILE HAMBURGER MENU
  ============================================================ */
  try {
    (function initMobileMenu() {
      const btn = document.getElementById('hamburger-btn');
      const menu = document.getElementById('mobile-menu');
      const navLinks = menu.querySelectorAll('.mobile-nav-link, .btn-gold');
      let isOpen = false;

      function open() {
        isOpen = true;
        btn.setAttribute('aria-expanded', 'true');
        menu.setAttribute('aria-hidden', 'false');
        menu.classList.add('open');
        document.body.style.overflow = 'hidden';
      }

      function close() {
        isOpen = false;
        btn.setAttribute('aria-expanded', 'false');
        menu.setAttribute('aria-hidden', 'true');
        menu.classList.remove('open');
        document.body.style.overflow = '';
      }

      btn.addEventListener('click', function () {
        isOpen ? close() : open();
      });

      navLinks.forEach(function (link) {
        link.addEventListener('click', close);
      });

      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && isOpen) close();
      });

      document.addEventListener('click', function (e) {
        if (isOpen && !menu.contains(e.target) && !btn.contains(e.target)) {
          close();
        }
      });
    })();
  } catch (e) {
    console.warn('[BTA] initMobileMenu', e);
  }

  /* ============================================================
     3. INTERSECTION OBSERVER — REVEAL ANIMATIONS
  ============================================================ */
  try {
    (function initReveal() {
      const elements = document.querySelectorAll('.reveal');

      if (!('IntersectionObserver' in window)) {
        elements.forEach(function (el) {
          el.classList.add('visible');
        });
        return;
      }

      const observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add('visible');
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.05, rootMargin: '0px 0px 0px 0px' }
      );

      elements.forEach(function (el) {
        observer.observe(el);
      });
    })();
  } catch (e) {
    console.warn('[BTA] initReveal', e);
  }

  /* ============================================================
     4. REGIONAL ACCORDION
     Click a country card → all its counties & cities appear immediately.
  ============================================================ */
  try {
    (function initRegions() {
      const FLAG_MAP = (window.BTA_HOME_DATA && window.BTA_HOME_DATA.flagMap) || {};
      const SUB_REGIONS = (window.BTA_HOME_DATA && window.BTA_HOME_DATA.regionData) || {};

      const cards = document.querySelectorAll('.country-card');

      function chipHtml(loc, country) {
        const flag = FLAG_MAP[loc]
          ? '<img class="chip-flag" src="images/flags/' +
            encodeURIComponent(FLAG_MAP[loc]) +
            '" alt="" aria-hidden="true">'
          : '';
        const href = 'public-voting.html?city=' + encodeURIComponent(loc) + '&country=' + encodeURIComponent(country);
        return '<a href="' + href + '" class="sub-region-chip">' + flag + escapeHtml(loc) + '</a>';
      }

      function renderLocations(country) {
        const countryData = SUB_REGIONS[country] || {};
        const boroughs = window.LONDON_BOROUGHS || countryData['London Boroughs'] || [];

        const subList = document.getElementById('sub-list-' + country);
        if (!subList) return;

        // Render each group with a labelled header
        const groups = Object.entries(countryData);

        subList.innerHTML = groups
          .map(function (entry) {
            const groupName = entry[0];
            const locations = entry[1];
            const chipsHtml = locations
              .map(function (loc) {
                return chipHtml(loc, country);
              })
              .join('');
            return (
              '<div class="region-group">' +
              '<p class="region-group-label">' +
              escapeHtml(groupName) +
              '</p>' +
              '<div class="region-group-chips">' +
              chipsHtml +
              '</div>' +
              '</div>'
            );
          })
          .join('');
      }

      function openAccordion(country) {
        const accordion = document.getElementById('accordion-' + country);
        if (!accordion) return;
        renderLocations(country);
        accordion.classList.add('open');
        accordion.setAttribute('aria-hidden', 'false');
        accordion.style.maxHeight = accordion.scrollHeight + 'px';
      }

      function closeAccordion(country) {
        const accordion = document.getElementById('accordion-' + country);
        if (!accordion) return;
        accordion.style.maxHeight = '0';
        accordion.classList.remove('open');
        accordion.setAttribute('aria-hidden', 'true');
      }

      cards.forEach(function (card) {
        card.addEventListener('click', function () {
          const country = card.getAttribute('data-country');
          const isActive = card.classList.contains('active');

          cards.forEach(function (c) {
            c.classList.remove('active');
            c.setAttribute('aria-expanded', 'false');
            closeAccordion(c.getAttribute('data-country'));
          });

          if (!isActive) {
            card.classList.add('active');
            card.setAttribute('aria-expanded', 'true');
            openAccordion(country);
          }
        });

        card.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            card.click();
          }
        });
      });
    })();
  } catch (e) {
    console.warn('[BTA] initRegions', e);
  }

  /* ============================================================
     5. FIND A TRADE — AUTOCOMPLETE + GEOLOCATION
  ============================================================ */
  try {
    (function initFindTrade() {
      const LOCATIONS = [
        'Kent',
        'Surrey',
        'Essex',
        'Yorkshire',
        'Lancashire',
        'Somerset',
        'Devon',
        'Cornwall',
        'Sussex',
        'Hampshire',
        'Oxfordshire',
        'Cambridgeshire',
        'Norfolk',
        'Suffolk',
        'Lincolnshire',
        'Derbyshire',
        'Nottinghamshire',
        'Leicestershire',
        'Warwickshire',
        'Worcestershire',
        'Shropshire',
        'Staffordshire',
        'Cheshire',
        'Cumbria',
        'Manchester',
        'Liverpool',
        'Leeds',
        'Sheffield',
        'Birmingham',
        'Bristol',
        'Nottingham',
        'Leicester',
        'Newcastle',
        'Sunderland',
        'Cardiff',
        'Swansea',
        'Edinburgh',
        'Glasgow',
        'Aberdeen',
        'Dundee',
      ];

      const input = document.getElementById('location-input');
      const dropdown = document.getElementById('location-dropdown');
      const geoBtn = document.getElementById('geo-btn');
      const form = document.getElementById('find-trade-form');
      const results = document.getElementById('find-results');
      const resultsText = document.getElementById('find-results-text');
      let highlighted = -1;

      function renderDropdown(matches) {
        dropdown.innerHTML = '';
        highlighted = -1;

        if (!matches.length) {
          dropdown.classList.remove('open');
          input.setAttribute('aria-expanded', 'false');
          return;
        }

        matches.forEach(function (loc, idx) {
          const item = document.createElement('div');
          item.className = 'autocomplete-item';
          item.setAttribute('role', 'option');
          item.setAttribute('id', 'autocomplete-item-' + idx);
          item.textContent = loc;
          item.addEventListener('mousedown', function (e) {
            e.preventDefault();
            input.value = loc;
            dropdown.classList.remove('open');
            input.setAttribute('aria-expanded', 'false');
          });
          dropdown.appendChild(item);
        });

        dropdown.classList.add('open');
        input.setAttribute('aria-expanded', 'true');
      }

      function getMatches(query) {
        const q = query.trim().toLowerCase();
        if (!q) return [];
        return LOCATIONS.filter(function (l) {
          return l.toLowerCase().includes(q);
        }).slice(0, 6);
      }

      input.addEventListener('input', function () {
        renderDropdown(getMatches(input.value));
      });

      input.addEventListener('keydown', function (e) {
        const items = dropdown.querySelectorAll('.autocomplete-item');
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          highlighted = Math.min(highlighted + 1, items.length - 1);
          updateHighlight(items);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          highlighted = Math.max(highlighted - 1, -1);
          updateHighlight(items);
        } else if (e.key === 'Enter' && highlighted >= 0) {
          e.preventDefault();
          if (items[highlighted]) {
            input.value = items[highlighted].textContent;
            dropdown.classList.remove('open');
            input.setAttribute('aria-expanded', 'false');
          }
        } else if (e.key === 'Escape') {
          dropdown.classList.remove('open');
          input.setAttribute('aria-expanded', 'false');
        }
      });

      function updateHighlight(items) {
        items.forEach(function (item, idx) {
          item.classList.toggle('highlighted', idx === highlighted);
          if (idx === highlighted) {
            input.setAttribute('aria-activedescendant', item.id);
          }
        });
      }

      input.addEventListener('blur', function () {
        setTimeout(function () {
          dropdown.classList.remove('open');
          input.setAttribute('aria-expanded', 'false');
        }, 150);
      });

      geoBtn.addEventListener('click', function () {
        if (!navigator.geolocation) {
          geoBtn.textContent = 'Geolocation not supported';
          return;
        }

        geoBtn.textContent = 'Detecting location…';

        navigator.geolocation.getCurrentPosition(
          function (pos) {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            const url = 'https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lon;

            fetch(url, { headers: { 'Accept-Language': 'en' } })
              .then(function (r) {
                return r.json();
              })
              .then(function (data) {
                const addr = data.address;
                const place = addr.county || addr.city || addr.town || addr.village || addr.state || '';
                input.value = place;
                geoBtn.innerHTML =
                  '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v4"/><path d="M12 19v4"/><path d="M1 12h4"/><path d="M19 12h4"/></svg> Use my location';
              })
              .catch(function () {
                input.value = 'Location detected';
                geoBtn.innerHTML =
                  '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v4"/><path d="M12 19v4"/><path d="M1 12h4"/><path d="M19 12h4"/></svg> Use my location';
              });
          },
          function () {
            geoBtn.innerHTML =
              '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v4"/><path d="M12 19v4"/><path d="M1 12h4"/><path d="M19 12h4"/></svg> Location unavailable';
          }
        );
      });

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        const location = input.value.trim();
        const category = document.getElementById('category-select').value;
        const catLabel = document.getElementById('category-select').selectedOptions[0].text;

        results.classList.add('open');

        if (location || category) {
          const loc = location ? '<strong>' + escapeHtml(location) + '</strong>' : 'your area';
          const cat = category ? ' in <strong>' + escapeHtml(catLabel) + '</strong>' : '';
          resultsText.innerHTML =
            'No results found for ' +
            loc +
            cat +
            '.<br>' +
            'Our directory of British Trade Award-recommended professionals is launching soon — check back after nominees are announced.';
        } else {
          resultsText.innerHTML = '<strong>Please enter a location</strong> or select a category to search.';
        }
      });
    })();
  } catch (e) {
    console.warn('[BTA] initFindTrade', e);
  }

  /* ============================================================
     6. UTILITY — HTML ESCAPE
  ============================================================ */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  window.escapeHtml = escapeHtml;

  /* ============================================================
     7. SMOOTH SCROLL — polyfill anchor-scroll offsets for header
  ============================================================ */
  try {
    (function initSmoothScroll() {
      const OFFSET = 80;

      document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
        anchor.addEventListener('click', function (e) {
          const targetId = anchor.getAttribute('href').slice(1);
          if (!targetId) return;

          const target = document.getElementById(targetId);
          if (!target) return;

          e.preventDefault();
          const top = target.getBoundingClientRect().top + window.scrollY - OFFSET;
          const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          window.scrollTo({ top: Math.max(0, top), behavior: prefersReducedMotion ? 'instant' : 'smooth' });
        });
      });
    })();
  } catch (e) {
    console.warn('[BTA] initSmoothScroll', e);
  }

  /* ============================================================
     8. CATEGORY MODAL — show sub-categories on card click
  ============================================================ */
  try {
    (function initCategoryModal() {
      const SECTOR_CATEGORIES = (window.BTA_HOME_DATA && window.BTA_HOME_DATA.sectorCategories) || {};
      const CATEGORY_DESCRIPTIONS = (window.BTA_HOME_DATA && window.BTA_HOME_DATA.categoryDescriptions) || {};

      const modal = document.getElementById('cat-modal');
      const closeBtn = document.getElementById('cat-modal-close');
      const closeBtnDetail = document.getElementById('cat-modal-close-detail');
      const backBtn = document.getElementById('cat-modal-back');
      const labelEl = document.getElementById('cat-modal-label');
      const titleEl = document.getElementById('cat-modal-title');
      const listEl = document.getElementById('cat-modal-list');
      const listView = document.getElementById('cat-modal-list-view');
      const detailView = document.getElementById('cat-modal-detail-view');
      const detailName = document.getElementById('cat-detail-name');
      const detailDesc = document.getElementById('cat-detail-desc');
      const detailCta = document.getElementById('cat-detail-cta');

      if (!modal) return;

      let currentSectorParam = '';

      function showListView() {
        if (listView) listView.style.display = '';
        if (detailView) detailView.style.display = 'none';
      }

      function showDetailView(catName, sectorParam) {
        const desc = CATEGORY_DESCRIPTIONS[catName];
        if (!desc) return;
        if (detailName) detailName.textContent = catName;
        if (detailDesc) detailDesc.textContent = desc;
        if (detailCta)
          detailCta.href = 'submit-entry.html?sector=' + sectorParam + '&category=' + encodeURIComponent(catName);
        if (listView) listView.style.display = 'none';
        if (detailView) detailView.style.display = '';
      }

      function openModal(sectorKey) {
        const cats = SECTOR_CATEGORIES[sectorKey];
        if (!cats) return;

        currentSectorParam = encodeURIComponent(sectorKey);

        labelEl.textContent = 'Award Categories';
        titleEl.textContent = sectorKey.replace(/&amp;/g, '&');

        listEl.innerHTML = cats
          .map(function (cat) {
            const hasDesc = !!CATEGORY_DESCRIPTIONS[cat];
            if (hasDesc) {
              return (
                '<li><button class="cat-entry-link" data-cat="' +
                escapeHtml(cat) +
                '">' +
                escapeHtml(cat) +
                '</button></li>'
              );
            }
            const href = 'public-voting.html?sector=' + currentSectorParam + '&category=' + encodeURIComponent(cat);
            return '<li><a href="' + href + '" class="cat-entry-link">' + escapeHtml(cat) + '</a></li>';
          })
          .join('');

        const listCtaEl = document.getElementById('cat-modal-list-cta');
        if (listCtaEl) listCtaEl.href = 'submit-entry.html?sector=' + currentSectorParam;

        showListView();
        modal.classList.add('open');
        modal.focus();
      }

      function closeModal() {
        modal.classList.remove('open');
        showListView();
      }

      listEl.addEventListener('click', function (e) {
        const btn = e.target.closest('button.cat-entry-link');
        if (!btn) return;
        showDetailView(btn.getAttribute('data-cat'), currentSectorParam);
      });

      if (backBtn) backBtn.addEventListener('click', showListView);
      if (closeBtn) closeBtn.addEventListener('click', closeModal);
      if (closeBtnDetail) closeBtnDetail.addEventListener('click', closeModal);

      document.querySelectorAll('.cat-box[data-sector]').forEach(function (box) {
        box.addEventListener('click', function (e) {
          e.preventDefault();
          openModal(box.getAttribute('data-sector').replace(/&amp;/g, '&'));
        });
      });

      modal.addEventListener('click', function (e) {
        if (e.target === modal) closeModal();
      });

      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && modal.classList.contains('open')) {
          closeModal();
        }
      });
    })();
  } catch (e) {
    console.warn('[BTA] initCategoryModal', e);
  }

  /* ============================================================
     9. FEATURED NOMINEES — load from public voting API
  ============================================================ */
  try {
    (function initNominees() {
      const section = document.getElementById('nominees');
      const grid = document.getElementById('nominees-grid');
      if (!section || !grid) return;

      fetch('/api/voting-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'load_entries' }),
      })
        .then(function (r) {
          return r.json();
        })
        .then(function (data) {
          const entries = (data.entries || []).slice(0, 6);
          if (!entries.length) return;

          section.style.display = '';

          grid.innerHTML = entries
            .map(function (entry) {
              const org = entry.organisations || {};
              const award = entry.awards || {};
              const awardLabel = award.award_name || entry.award_category || '';

              const logoHtml = org.logo_url
                ? '<div class="nominee-logo-wrap"><img src="' +
                  escapeHtml(org.logo_url) +
                  '" alt="" loading="lazy"></div>'
                : '<div class="nominee-logo-wrap" aria-hidden="true">' +
                  '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#555" stroke-width="1.5">' +
                  '<rect x="2" y="7" width="20" height="14" rx="2"/>' +
                  '<path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>' +
                  '</svg>' +
                  '</div>';

              const voteHref = 'vote.html?id=' + encodeURIComponent(entry.id);

              return (
                '<div class="nominee-card reveal">' +
                logoHtml +
                (awardLabel ? '<div class="nominee-category-badge">' + escapeHtml(awardLabel) + '</div>' : '') +
                '<div class="nominee-company-name">' +
                escapeHtml(org.company_name || 'Nominee') +
                '</div>' +
                (entry.entry_title
                  ? '<div class="nominee-entry-title">' + escapeHtml(entry.entry_title) + '</div>'
                  : '') +
                '<a href="' +
                voteHref +
                '" class="nominee-vote-btn">Vote Now →</a>' +
                '</div>'
              );
            })
            .join('');

          if ('IntersectionObserver' in window) {
            const obs = new IntersectionObserver(
              function (entries_io) {
                entries_io.forEach(function (e) {
                  if (e.isIntersecting) {
                    e.target.classList.add('visible');
                    obs.unobserve(e.target);
                  }
                });
              },
              { threshold: 0.05 }
            );
            grid.querySelectorAll('.nominee-card.reveal').forEach(function (el) {
              obs.observe(el);
            });
          } else {
            grid.querySelectorAll('.nominee-card.reveal').forEach(function (el) {
              el.classList.add('visible');
            });
          }
        })
        .catch(function (e) {
          console.warn('[BTA] Nominees load failed:', e.message);
        });
    })();
  } catch (e) {
    console.warn('[BTA] initNominees', e);
  }

  /* ============================================================
     10. HERO VIDEO — pause when offscreen (performance)
  ============================================================ */
  try {
    (function initVideo() {
      const video = document.getElementById('hero-video');
      if (!video) return;

      // Pause when scrolled out of view; resume when back in view.
      // No prefers-reduced-motion gate — this is a decorative background,
      // not a UI animation, and should play on all devices.
      if ('IntersectionObserver' in window) {
        const obs = new IntersectionObserver(
          function (entries) {
            entries.forEach(function (entry) {
              if (entry.isIntersecting) {
                video.play().catch(function () {});
              } else {
                video.pause();
              }
            });
          },
          { threshold: 0.1 }
        );
        obs.observe(video);
      } else {
        video.play().catch(function () {});
      }
    })();
  } catch (e) {
    console.warn('[BTA] initVideo', e);
  }
})();

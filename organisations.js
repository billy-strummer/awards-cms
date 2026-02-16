/* ==================================================== */
/* ORGANISATIONS MODULE - ENHANCED VERSION */
/* ==================================================== */

const orgsModule = {
  
  // ============================================
  // State management for bulk operations
  // ============================================
  selectedOrgs: new Set(),
  sortField: null,
  sortDirection: 'asc',
  currentEditingOrg: null,
  originalOrgData: null,
  currentOrgIdForLogo: null,
  currentOrgIdForImages: null,

  /**
 * Load all organisations from database
 * ENHANCED: Now calculates dashboard stats
 */
async loadOrganisations() {
  try {
    utils.showLoading();
    utils.showTableLoading('orgsTableBody', 10);
    
    // Load all organisations using proper Supabase v2 pagination
    let allData = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;
    
    while (hasMore) {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      
      const { data, error } = await STATE.client
        .from('organisations')
        .select('*', { count: 'exact' })
        .range(from, to)
        .order('company_name', { ascending: true });
      
      if (error) throw error;
      
      if (!data || data.length === 0) {
        hasMore = false;
      } else {
        allData = allData.concat(data);
        page++;
        // Page loaded
        
        if (data.length < pageSize) {
          hasMore = false;
        }
      }
    }
    
    // Load award assignments to get county/region/sector for each org
    const { data: assignments } = await STATE.client
      .from('award_assignments')
      .select('organisation_id, award_id');
    
    // Load awards with county
    const { data: awards } = await STATE.client
      .from('awards')
      .select('id, county, sector, year');
    
    // Load counties table to map county → region
    const { data: counties } = await STATE.client
      .from('counties')
      .select('Name, regions(name)');
    
    // Create county → region lookup
    const countyToRegion = {};
    counties?.forEach(c => {
      if (c.Name && c.regions?.name) {
        countyToRegion[c.Name] = c.regions.name;
      }
    });
    
    // Create lookup maps
    const orgAwardMap = {};      // org_id → first award_id (for county/region)
    const orgAwardsCount = {};   // org_id → total assignments count
    assignments?.forEach(a => {
      if (!orgAwardMap[a.organisation_id]) {
        orgAwardMap[a.organisation_id] = a.award_id;
      }
      orgAwardsCount[a.organisation_id] = (orgAwardsCount[a.organisation_id] || 0) + 1;
    });

    const awardMap = {};
    awards?.forEach(a => {
      awardMap[a.id] = a;
    });

    // Attach award data to organisations
    // Priority: award-derived county > org's catchment_area (set by CSV import)
    allData = allData.map(org => {
      const awardId = orgAwardMap[org.id];
      const award = awardMap[awardId];
      const awardCounty = award?.county || null;
      const county = awardCounty || org.catchment_area || null;
      const region = county ? (countyToRegion[county] || org.region) : (org.region || null);

      return {
        ...org,
        county: county,
        region: region,
        sector: award?.sector || org.sector || null,
        year: award?.year || null,
        awards_count: orgAwardsCount[org.id] || 0
      };
    });
    
    STATE.allOrganisations = allData;
    STATE.filteredOrganisations = STATE.allOrganisations;

    // Load last contacted dates for the table column
    await this.loadLastContactedDates();

    // Initialize keyboard shortcuts
    this.initKeyboardShortcuts();

    // Subscribe to realtime changes
    this._subscribeToRealtimeChanges();

    // NEW: Calculate and display dashboard stats
    await this.calculateDashboardStats();

    // Save current filter state in-memory before repopulating dropdowns
    const savedFilters = {
      year: document.getElementById('orgsYearFilter')?.value || '',
      sector: document.getElementById('orgsSectorFilter')?.value || '',
      region: document.getElementById('orgsRegionFilter')?.value || '',
      county: document.getElementById('orgsCountyFilter')?.value || '',
      status: document.getElementById('orgsStatusFilter')?.value || '',
      search: document.getElementById('orgsSearchBox')?.value || ''
    };

    // Populate filter dropdowns (resets selections)
    this.populateFilters();

    // Restore filter state: prefer in-memory values, fall back to localStorage
    const lsFilters = (() => { try { return JSON.parse(localStorage.getItem('orgsFilters') || '{}'); } catch (e) { return {}; } })();
    document.getElementById('orgsYearFilter').value = savedFilters.year || lsFilters.year || '';
    document.getElementById('orgsSectorFilter').value = savedFilters.sector || lsFilters.sector || '';
    if (savedFilters.region || lsFilters.region) {
      document.getElementById('orgsRegionFilter').value = savedFilters.region || lsFilters.region || '';
      this.updateCountyFilterByRegion();
    }
    document.getElementById('orgsCountyFilter').value = savedFilters.county || lsFilters.county || '';
    document.getElementById('orgsStatusFilter').value = savedFilters.status || lsFilters.status || '';
    document.getElementById('orgsSearchBox').value = savedFilters.search || lsFilters.search || '';

    this.filterOrganisations();
    this.populateSectorSuggestions();
    
  } catch (error) {
    console.error('Error loading organisations:', error);
    console.error('Error details:', error.details, error.hint, error.message);
    utils.showToast('Failed to load organisations: ' + error.message, 'error');
    utils.showEmptyState('orgsTableBody', 10, 'Failed to load organisations', 'bi-exclamation-triangle');
  } finally {
    utils.hideLoading();
  }
},
      
  // ============================================
  // State for advanced filters
  // ============================================
  _filterMissingField: null,

  // ============================================
  // Calculate dashboard statistics (Enhanced)
  // ============================================
  async calculateDashboardStats() {
    try {
      const totalCount = STATE.allOrganisations.length;

      // Count unique organisations with award assignments
      const { data: assignments } = await STATE.client
        .from('award_assignments')
        .select('organisation_id');

      const uniqueOrgIds = new Set(assignments?.map(a => a.organisation_id) || []);
      const activeNominees = uniqueOrgIds.size;

      // New this month
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const newThisMonth = STATE.allOrganisations.filter(org => {
        const created = new Date(org.created_at);
        return created >= monthStart;
      }).length;

      // Missing data indicators
      const missingEmail = STATE.allOrganisations.filter(o => !o.email).length;
      const missingLogo = STATE.allOrganisations.filter(o => !o.logo_url).length;

      // Pipeline counts (exclude archived)
      const statusCounts = { prospect: 0, entrant: 0, nominee: 0, shortlisted: 0, winner: 0, sponsor: 0, past_winner: 0 };
      STATE.allOrganisations.forEach(org => {
        const s = org.status || 'prospect';
        if (statusCounts[s] !== undefined) statusCounts[s]++;
      });

      // Find top sector
      const sectorCounts = {};
      STATE.allOrganisations.forEach(org => {
        if (org.sector) {
          sectorCounts[org.sector] = (sectorCounts[org.sector] || 0) + 1;
        }
      });

      const topSectorEntry = Object.entries(sectorCounts)
        .sort((a, b) => b[1] - a[1])[0];
      const topSector = topSectorEntry ? topSectorEntry[0] : '-';

      // Update dashboard UI
      const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      set('orgsTotalCount', totalCount);
      set('orgsWithAwards', activeNominees);
      set('orgsNewThisMonth', newThisMonth);
      set('orgsTopSector', topSector);
      set('orgsMissingEmail', missingEmail);
      set('orgsMissingLogo', missingLogo);
      set('orgsLastUpdated', new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));

      // Pipeline badges with conversion rates
      const convRates = this._calculateConversionRates(statusCounts);
      set('orgsPipelineProspect', statusCounts.prospect + ' Prospects');
      set('orgsPipelineEntrant', statusCounts.entrant + ' Entrants');
      set('orgsPipelineNominee', statusCounts.nominee + ' Nominees');
      set('orgsPipelineShortlisted', statusCounts.shortlisted + ' Shortlisted');
      set('orgsPipelineWinner', statusCounts.winner + ' Winners');

      // Set conversion rate badges
      const setConv = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val + '%'; };
      setConv('orgsConvProspectEntrant', convRates.prospect_to_entrant || 0);
      setConv('orgsConvEntrantNominee', convRates.entrant_to_nominee || 0);
      setConv('orgsConvNomineeShortlisted', convRates.nominee_to_shortlisted || 0);
      setConv('orgsConvShortlistedWinner', convRates.shortlisted_to_winner || 0);

      // Enhanced KPI calculations (Feature 6)
      const sponsorCount = statusCounts.sponsor || 0;
      set('orgsSponsorCount', sponsorCount);

      // At-risk: stale (180+ days) with no recent activity
      const atRisk = STATE.allOrganisations.filter(o => {
        const days = o.updated_at ? Math.floor((Date.now() - new Date(o.updated_at).getTime()) / 86400000) : 999;
        return days > 180 && (o.status || 'prospect') !== 'archived';
      }).length;
      set('orgsAtRiskCount', atRisk);

      // Average engagement score
      const scores = STATE.allOrganisations
        .filter(o => (o.status || 'prospect') !== 'archived')
        .map(o => this.calculateEngagementScore(o));
      const avgEngagement = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      set('orgsAvgEngagement', avgEngagement + '%');

      // Revenue by tier
      const tierRevenue = {};
      STATE.allOrganisations.forEach(org => {
        if (org.tier) tierRevenue[org.tier] = (tierRevenue[org.tier] || 0) + 1;
      });
      const topTier = Object.entries(tierRevenue).sort((a, b) => b[1] - a[1])[0];
      set('orgsTopTier', topTier ? `${topTier[0]} (${topTier[1]})` : '-');

    } catch (error) {
      console.error('Error calculating dashboard stats:', error);
    }
  },

/**
 * Populate filter dropdowns with unique values (Enhanced)
 */
populateFilters() {
  // Populate sector filter
  const sectors = [...new Set(STATE.allOrganisations
    .map(o => o.sector)
    .filter(s => s)
  )].sort();

  const sectorSelect = document.getElementById('orgsSectorFilter');
  if (sectorSelect) {
    sectorSelect.innerHTML = '<option value="">All</option>' +
      sectors.map(s => `<option value="${s}">${utils.escapeHtml(s)}</option>`).join('');
  }

  // Populate county filter
  const counties = [...new Set(STATE.allOrganisations
    .map(o => o.county)
    .filter(c => c)
  )].sort();

  const countySelect = document.getElementById('orgsCountyFilter');
  if (countySelect) {
    countySelect.innerHTML = '<option value="">All</option>' +
      counties.map(c => `<option value="${c}">${utils.escapeHtml(c)}</option>`).join('');
  }

  // Populate region filter
  const regions = [...new Set(STATE.allOrganisations
    .map(o => o.region)
    .filter(r => r)
  )].sort();

  const regionSelect = document.getElementById('orgsRegionFilter');
  if (regionSelect) {
    regionSelect.innerHTML = '<option value="">All Regions</option>' +
      regions.map(r => `<option value="${r}">${utils.escapeHtml(r)}</option>`).join('');
  }

  // Populate tag filter
  const allTags = new Set();
  STATE.allOrganisations.forEach(o => {
    if (o.tags && Array.isArray(o.tags)) {
      o.tags.forEach(t => allTags.add(t));
    }
  });
  const tagSelect = document.getElementById('orgsTagFilter');
  if (tagSelect) {
    tagSelect.innerHTML = '<option value="">All Tags</option>' +
      [...allTags].sort().map(t => `<option value="${utils.escapeHtml(t)}">${utils.escapeHtml(t)}</option>`).join('');
  }

  // Populate saved filter presets
  this._populateFilterPresets();
},

/**
 * Restore saved filter values from localStorage
 */
restoreFilters() {
  try {
    const saved = JSON.parse(localStorage.getItem('orgsFilters') || '{}');
    if (saved.year) {
      const el = document.getElementById('orgsYearFilter');
      if (el) el.value = saved.year;
    }
    if (saved.sector) {
      const el = document.getElementById('orgsSectorFilter');
      if (el) el.value = saved.sector;
    }
    if (saved.region) {
      const el = document.getElementById('orgsRegionFilter');
      if (el) el.value = saved.region;
      this.updateCountyFilterByRegion();
    }
    if (saved.county) {
      const el = document.getElementById('orgsCountyFilter');
      if (el) el.value = saved.county;
    }
    if (saved.status) {
      const el = document.getElementById('orgsStatusFilter');
      if (el) el.value = saved.status;
    }
    if (saved.search) {
      const el = document.getElementById('orgsSearchBox');
      if (el) el.value = saved.search;
    }
  } catch (e) { /* ignore */ }
},

/**
 * Update county dropdown based on selected region
 */
updateCountyFilterByRegion() {
  const selectedRegion = document.getElementById('orgsRegionFilter')?.value || '';
  const countySelect = document.getElementById('orgsCountyFilter');
  
  if (!countySelect) return;
  
  if (!selectedRegion) {
    // No region selected - show all counties
    const allCounties = [...new Set(STATE.allOrganisations
      .map(o => o.county)
      .filter(c => c)
    )].sort();
    
    countySelect.innerHTML = '<option value="">All Counties</option>' +
      allCounties.map(c => `<option value="${c}">${utils.escapeHtml(c)}</option>`).join('');
  } else {
    // Region selected - show only counties in that region
    const countiesInRegion = [...new Set(STATE.allOrganisations
      .filter(o => o.region === selectedRegion)
      .map(o => o.county)
      .filter(c => c)
    )].sort();
    
    countySelect.innerHTML = '<option value="">All Counties</option>' +
      countiesInRegion.map(c => `<option value="${c}">${utils.escapeHtml(c)}</option>`).join('');
  }
  
  // Reset county selection
  countySelect.value = '';
},

  /**
   * Filter organisations based on all filters (Enhanced)
   */
  filterOrganisations() {
  const year = document.getElementById('orgsYearFilter')?.value || '';
  const sector = document.getElementById('orgsSectorFilter')?.value || '';
  const county = document.getElementById('orgsCountyFilter')?.value || '';
  const region = document.getElementById('orgsRegionFilter')?.value || '';
  const status = document.getElementById('orgsStatusFilter')?.value || '';
  const search = document.getElementById('orgsSearchBox')?.value.toLowerCase().trim() || '';
  const tier = document.getElementById('orgsTierFilter')?.value || '';
  const tag = document.getElementById('orgsTagFilter')?.value || '';
  const logoFilter = document.getElementById('orgsLogoFilter')?.value || '';
  const dateFilter = document.getElementById('orgsDateFilter')?.value || '';
  const missingField = this._filterMissingField || '';

  // Save filters to localStorage
  try {
    localStorage.setItem('orgsFilters', JSON.stringify({ year, sector, county, region, status, search, tier, tag, logoFilter, dateFilter }));
  } catch (e) { /* ignore */ }

  // Hide archived by default unless status filter is 'archived' or 'all'
  const showArchived = status === 'archived' || status === 'all';

  // Date range calculation
  let dateThreshold = null;
  let isStaleFilter = false;
  if (dateFilter === 'stale') {
    isStaleFilter = true;
    dateThreshold = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
  } else if (dateFilter) {
    dateThreshold = new Date(Date.now() - parseInt(dateFilter) * 24 * 60 * 60 * 1000);
  }

  STATE.filteredOrganisations = STATE.allOrganisations.filter(org => {
    const orgStatus = org.status || 'prospect';

    // Hide archived unless explicitly filtering for them
    if (!showArchived && orgStatus === 'archived') return false;

    // Year filter
    if (year && String(org.year || '') !== String(year)) return false;

    // Status filter (skip if 'all')
    if (status && status !== 'all' && orgStatus !== status) return false;

    // Sector filter
    if (sector && org.sector !== sector) return false;

    // County filter
    if (county && org.county !== county) return false;

    // Region filter
    if (region && org.region !== region) return false;

    // Tier filter
    if (tier && (org.tier || '') !== tier) return false;

    // Tag filter
    if (tag && !(org.tags && org.tags.includes(tag))) return false;

    // Logo filter
    if (logoFilter === 'has' && !org.logo_url) return false;
    if (logoFilter === 'missing' && org.logo_url) return false;

    // Date filter
    if (dateThreshold) {
      const orgDate = new Date(org.updated_at || org.created_at || 0);
      if (isStaleFilter) {
        if (orgDate > dateThreshold) return false; // stale = NOT updated recently
      } else {
        if (orgDate < dateThreshold) return false; // recent = updated after threshold
      }
    }

    // Missing field filter (from dashboard click)
    if (missingField) {
      if (org[missingField]) return false; // only show orgs missing this field
    }

    // Search filter - searches ALL fields including county, sector, status, tags
    if (search) {
      const tagStr = (org.tags || []).join(' ');
      const searchFields = [
        org.company_name, org.contact_name, org.email, org.website,
        org.notes, org.county, org.sector, org.region,
        org.catchment_area, org.address, orgStatus, org.tier, tagStr,
        org.contact_phone
      ].map(f => (f || '').toLowerCase());

      if (!searchFields.some(f => f.includes(search))) {
        return false;
      }
    }

    return true;
  });

  // Clear the missing field filter after applying it once
  this._filterMissingField = null;

  this.renderOrganisations();
},

  /**
   * Render organisations table
   */
  renderOrganisations() {
  const tbody = document.getElementById('orgsTableBody');
  const count = document.getElementById('orgsCount');
  const showing = document.getElementById('orgsShowing');
  const total = document.getElementById('orgsTotal');
  const lastRefresh = document.getElementById('orgsLastRefresh');

  if (count) count.textContent = STATE.filteredOrganisations.length;
  if (showing) showing.textContent = STATE.filteredOrganisations.length;
  if (total) total.textContent = STATE.allOrganisations.length;
  if (lastRefresh) lastRefresh.textContent = new Date().toLocaleTimeString('en-GB');

  // Dynamic phone column header
  const phoneHeaderEl = document.getElementById('phoneColHeader');
  if (phoneHeaderEl) phoneHeaderEl.style.display = this._showPhoneColumn ? '' : 'none';
  const colSpan = this._showPhoneColumn ? 16 : 15;

  if (STATE.filteredOrganisations.length === 0) {
    // Build active filters summary
    const activeFilters = [];
    const year = document.getElementById('orgsYearFilter')?.value;
    const sector = document.getElementById('orgsSectorFilter')?.value;
    const region = document.getElementById('orgsRegionFilter')?.value;
    const county = document.getElementById('orgsCountyFilter')?.value;
    const status = document.getElementById('orgsStatusFilter')?.value;
    const search = document.getElementById('orgsSearchBox')?.value;
    if (year) activeFilters.push(`Year: <strong>${utils.escapeHtml(year)}</strong>`);
    if (sector) activeFilters.push(`Sector: <strong>${utils.escapeHtml(sector)}</strong>`);
    if (region) activeFilters.push(`Region: <strong>${utils.escapeHtml(region)}</strong>`);
    if (county) activeFilters.push(`County: <strong>${utils.escapeHtml(county)}</strong>`);
    if (status) activeFilters.push(`Status: <strong>${utils.escapeHtml(status)}</strong>`);
    if (search) activeFilters.push(`Search: <strong>"${utils.escapeHtml(search)}"</strong>`);

    const filterSummary = activeFilters.length > 0
      ? `<p class="text-muted small mt-2 mb-2">Active filters: ${activeFilters.join(' &middot; ')}</p>
         <button class="btn btn-sm btn-outline-primary" onclick="orgsModule.resetFilters()">
           <i class="bi bi-x-circle me-1"></i>Clear all filters
         </button>`
      : '';

    tbody.innerHTML = `
      <tr>
        <td colspan="${colSpan}" class="text-center py-5">
          <i class="bi bi-inbox display-4 text-muted opacity-25"></i>
          <p class="text-muted mt-3 mb-0">No organisations found</p>
          ${filterSummary}
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = STATE.filteredOrganisations.map(org => {
    const isSelected = this.selectedOrgs.has(org.id);
    const awardsCount = org.awards_count || 0;
    const escapedName = utils.escapeHtml(org.company_name || '').replace(/'/g, "\\'");
    const tierColors = { 'Bronze': '#CD7F32', 'Silver': '#C0C0C0', 'Gold': '#FFD700', 'Platinum': '#E5E4E2' };
    const tierColor = tierColors[org.tier] || '';
    const updatedDate = org.updated_at || org.created_at;

    return `
      <tr class="fade-in ${isSelected ? 'table-active' : ''}">
        <td class="text-center">
          <input type="checkbox" class="form-check-input"
                 ${isSelected ? 'checked' : ''}
                 onchange="orgsModule.toggleOrgSelection('${org.id}')">
        </td>
        <td>
          <div class="d-flex align-items-center">
            ${org.logo_url ?
              `<img src="${org.logo_url}" alt="${utils.escapeHtml(org.company_name)}"
                   class="me-2 rounded" style="width: 40px; height: 28px; object-fit: contain; border: 1px solid #e0e0e0;">` :
              `<div class="me-2 d-flex align-items-center justify-content-center rounded"
                   style="width: 40px; height: 28px; background: #f5f5f5; border: 1px solid #e0e0e0;">
                <i class="bi bi-building text-muted" style="font-size: 0.8rem;"></i>
              </div>`
            }
            <a class="text-primary text-decoration-none fw-semibold"
               style="cursor: pointer;"
               onclick="orgsModule.openCompanyProfile('${org.id}', '${escapedName}')">
              ${utils.escapeHtml(org.company_name || 'N/A')}
            </a>
          </div>
        </td>
        <td style="cursor: pointer;" ondblclick="orgsModule.startInlineEdit('${org.id}', 'sector', '${utils.escapeHtml(org.sector || '').replace(/'/g, "\\'")}', this)" title="Double-click to edit">
          <span class="badge bg-info-subtle text-info small">
            ${utils.escapeHtml(org.sector || '-')}
          </span>
        </td>
        <td>
          <span class="badge bg-primary-subtle text-primary small">
            ${utils.escapeHtml(org.county || '-')}
          </span>
        </td>
        <td class="small" style="cursor: pointer;" ondblclick="orgsModule.startInlineEdit('${org.id}', 'contact', '${utils.escapeHtml(org.contact_name || '').replace(/'/g, "\\'")}', this)" title="Double-click to edit">
          ${utils.escapeHtml(org.contact_name ? (org.contact_name.length > 18 ? org.contact_name.substring(0, 18) + '...' : org.contact_name) : '-')}
        </td>
        <td class="small" style="cursor: pointer;" ondblclick="orgsModule.startInlineEdit('${org.id}', 'email', '${utils.escapeHtml(org.email || '').replace(/'/g, "\\'")}', this)" title="Double-click to edit">
          ${org.email ?
            `<a href="mailto:${org.email}" class="text-decoration-none" title="${utils.escapeHtml(org.email)}">
              ${org.email.length > 22 ? utils.escapeHtml(org.email.substring(0, 22)) + '...' : utils.escapeHtml(org.email)}
            </a>` : '-'
          }
        </td>
        <td class="text-center">
          ${org.tier ?
            `<span class="badge" style="background: ${tierColor}; color: ${org.tier === 'Gold' || org.tier === 'Silver' || org.tier === 'Platinum' ? '#000' : '#fff'}; font-size: 0.7rem;">
              ${utils.escapeHtml(org.tier)}
            </span>` : '<span class="text-muted small">-</span>'
          }
        </td>
        <td>
          ${org.tags && org.tags.length > 0 ?
            org.tags.slice(0, 3).map(t => `<span class="badge bg-secondary me-1" style="font-size: 0.65rem;">${utils.escapeHtml(t)}</span>`).join('') +
            (org.tags.length > 3 ? `<span class="text-muted" style="font-size: 0.65rem;">+${org.tags.length - 3}</span>` : '')
            : '<span class="text-muted small">-</span>'
          }
        </td>
        <td>
          <span class="badge bg-success-subtle text-success small">
            ${utils.escapeHtml(org.region || '-')}
          </span>
        </td>
        <td class="text-center">
          <select class="form-select form-select-sm border-0 p-0 text-center"
                  style="font-size: 0.75rem; background-position: right 0.25rem center; padding-right: 1.2rem !important; cursor: pointer;"
                  onchange="orgsModule.quickUpdateStatus('${org.id}', this.value)"
                  title="Click to change status">
            ${this._getStatusOptions(org.status || 'prospect').map(s =>
              `<option value="${s.value}" ${(org.status || 'prospect') === s.value ? 'selected' : ''}>${s.label}</option>`
            ).join('')}
          </select>
        </td>
        ${this._showPhoneColumn ? `<td class="small">${utils.escapeHtml(org.contact_phone || '-')}</td>` : ''}
        <td class="text-center">
          ${awardsCount > 0 ?
            `<span class="badge bg-warning text-dark">${awardsCount}</span>` :
            `<span class="text-muted">-</span>`
          }
        </td>
        <td class="text-center small text-muted" title="${updatedDate ? new Date(updatedDate).toLocaleDateString('en-GB') : 'N/A'}">
          ${updatedDate ? this._timeAgo(new Date(updatedDate)) : '-'}
        </td>
        <td class="text-center small text-muted" title="Last contacted">
          ${(() => {
            const lc = this.getLastContacted(org.id);
            return lc ? this._timeAgo(new Date(lc)) : '<span class="text-muted">-</span>';
          })()}
        </td>
        <td class="text-center">
          ${(() => {
            const h = this.getOrgHealthIndicator(org);
            return `<i class="bi ${h.icon} text-${h.color}" title="${h.label}" style="font-size: 0.85rem;"></i>`;
          })()}
        </td>
        <td class="text-center">
          <div class="btn-group btn-group-sm">
            <button class="btn btn-sm btn-outline-secondary"
                    onclick="orgsModule.openCompanyProfile('${org.id}', '${escapedName}')"
                    title="View Profile">
              <i class="bi bi-eye"></i>
            </button>
            ${(org.status || 'prospect') === 'archived'
              ? `<button class="btn btn-sm btn-outline-success"
                      onclick="orgsModule.restoreOrganisation('${org.id}', '${escapedName}')"
                      title="Restore"><i class="bi bi-arrow-counterclockwise"></i></button>`
              : `<button class="btn btn-sm btn-outline-danger"
                      onclick="orgsModule.deleteOrganisation('${org.id}', '${escapedName}')"
                      title="Archive"><i class="bi bi-archive"></i></button>`
            }
          </div>
        </td>
      </tr>
    `;
  }).join('');

    this.updateSortIndicators();
},
  /**
   * Open company profile modal
   * @param {string} orgId - Organisation ID
   * @param {string} companyName - Company name for display
   */

  async openCompanyProfile(orgId, companyName) {
    const modal = new bootstrap.Modal(document.getElementById('companyProfileModal'));
    const contentDiv = document.getElementById('companyProfileContent');
    const titleEl = document.getElementById('companyProfileModalLabel');
    const editBtn = document.getElementById('editOrgBtn');
    const saveBtn = document.getElementById('saveOrgBtn');
    const cancelBtn = document.getElementById('cancelEditOrgBtn');

    // Reset edit mode
    editBtn.style.display = 'none';
    saveBtn.style.display = 'none';
    cancelBtn.style.display = 'none';

    titleEl.innerHTML = `<i class="bi bi-building me-2"></i>${utils.escapeHtml(companyName)}`;
    contentDiv.innerHTML = `
      <div class="text-center py-4">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
      </div>
    `;

    modal.show();

    // Increase z-index when opened from another modal (e.g., assignments modal)
    // This ensures the company profile modal appears on top
    const modalElement = document.getElementById('companyProfileModal');
    const backdrop = document.querySelector('.modal-backdrop');

    // Set higher z-index for modal and backdrop to appear above other modals
    setTimeout(() => {
      modalElement.style.zIndex = '1060';
      // Find the most recent backdrop (the one for this modal)
      const backdrops = document.querySelectorAll('.modal-backdrop');
      if (backdrops.length > 0) {
        backdrops[backdrops.length - 1].style.zIndex = '1059';
      }
    }, 10);

    try {
      // Fetch organisation details with related awards
      const { data: org, error: orgError } = await STATE.client
        .from('organisations')
        .select('*')
        .eq('id', orgId)
        .single();
      
      if (orgError) throw orgError;
      
      // Fetch related awards through award_assignments using explicit FK
      const { data: assignments, error: awardsError } = await STATE.client
        .from('award_assignments')
        .select(`
          status,
          awards!award_assignments_award_id_fkey (*)
        `)
        .eq('organisation_id', orgId);

      if (awardsError) throw awardsError;

      // Extract and sort awards, using assignment status instead of award status
      const awards = (assignments || [])
        .filter(a => a.awards)
        .map(a => ({
          ...a.awards,
          status: a.status, // Use assignment status (nominated/shortlisted/winner)
          package_type: 'bronze', // Default package type
          enhanced_profile: false // Default enhanced profile
        }))
        .sort((a, b) => (b.year || 0) - (a.year || 0));

      // Fetch media gallery items tagged to this organisation
      const { data: taggedMedia, error: mediaError } = await STATE.client
        .from('media_gallery')
        .select('*')
        .eq('organisation_id', orgId)
        .order('created_at', { ascending: false });

      if (mediaError) console.error('Error loading tagged media:', mediaError);

      // Fetch company images for marketing
      const { data: companyImages, error: imagesError } = await STATE.client
        .from('organisation_images')
        .select('*')
        .eq('organisation_id', orgId)
        .order('display_order', { ascending: true });

      if (imagesError) console.error('Error loading company images:', imagesError);

      // Fetch invoices for this organisation
      const { data: invoices, error: invoicesError } = await STATE.client
        .from('invoices')
        .select('*')
        .eq('organisation_id', orgId)
        .order('created_at', { ascending: false });

      if (invoicesError) console.error('Error loading invoices:', invoicesError);

      const invoicesSummary = {
        count: (invoices || []).length,
        totalAmount: (invoices || []).reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0), 0),
        paidAmount: (invoices || []).reduce((sum, inv) => sum + parseFloat(inv.paid_amount || 0), 0),
        balanceDue: (invoices || []).reduce((sum, inv) => sum + parseFloat(inv.balance_due || 0), 0)
      };

      // Fetch entries with public voting enabled for this organisation
      const { data: votingEntries, error: entriesError } = await STATE.client
        .from('entries')
        .select(`
          *,
          award_years (award_name, year)
        `)
        .eq('organisation_id', orgId)
        .eq('allow_public_voting', true)
        .order('created_at', { ascending: false });

      if (entriesError) console.error('Error loading voting entries:', entriesError);

      // Render profile
      contentDiv.innerHTML = `
        <div class="row">
          <div class="col-md-4 mb-3">
            <h6 class="text-muted mb-2"><i class="bi bi-image me-2"></i>Company Logo</h6>
            <div class="card">
              <div class="card-body text-center">
                ${org.logo_url ?
                  `<img src="${org.logo_url}" alt="${utils.escapeHtml(org.company_name)}"
                    class="mb-3" style="width: 250px; height: 170px; object-fit: contain; border: 1px solid #dee2e6; border-radius: 4px; background: #f8f9fa;">` :
                  `<div class="text-muted mb-3" style="width: 250px; height: 170px; display: flex; align-items: center; justify-content: center; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px;">
                    <i class="bi bi-image" style="font-size: 3rem;"></i>
                  </div>`
                }
                <input type="file" id="logoUploadInput" class="form-control form-control-sm mb-2"
                  accept="image/*" onchange="orgsModule.validateAndUploadLogo('${org.id}', this)">
                <button type="button" class="btn btn-sm btn-outline-primary w-100 mb-2"
                  onclick="orgsModule.openLogoGalleryModal('${org.id}')">
                  <i class="bi bi-images me-1"></i>Choose from Media Gallery
                </button>
                ${org.website ?
                  `<button type="button" class="btn btn-sm btn-outline-success w-100 mb-2"
                    onclick="orgsModule.fetchLogoFromWebsite('${org.id}')">
                    <i class="bi bi-globe me-1"></i>Fetch from Website
                  </button>` : ''
                }
                <small class="text-muted">Required: 250x170 px</small>
              </div>
            </div>
          </div>

          <div class="col-md-4 mb-3">
            <h6 class="text-muted mb-2"><i class="bi bi-person me-2"></i>Contact Information</h6>
            <div class="card">
              <div class="card-body">
                <div class="mb-2">
                  <strong>Contact Name:</strong>
                  <span class="view-mode" id="viewContactName">${utils.escapeHtml(org.contact_name || 'N/A')}</span>
                  <input type="text" class="form-control form-control-sm edit-mode" id="editContactName"
                    value="${utils.escapeHtml(org.contact_name || '')}" style="display: none;">
                </div>
                <div class="mb-2">
                  <strong>Email:</strong>
                  <span class="view-mode" id="viewEmail">
                    ${org.email ? `<a href="mailto:${org.email}">${utils.escapeHtml(org.email)}</a>` : 'N/A'}
                  </span>
                  <input type="email" class="form-control form-control-sm edit-mode" id="editEmail"
                    value="${utils.escapeHtml(org.email || '')}" style="display: none;">
                </div>
                <div class="mb-2">
                  <strong>Phone:</strong>
                  <span class="view-mode" id="viewPhone">${utils.escapeHtml(org.contact_phone || 'N/A')}</span>
                  <input type="text" class="form-control form-control-sm edit-mode" id="editPhone"
                    value="${utils.escapeHtml(org.contact_phone || '')}" style="display: none;">
                </div>
                <div class="mb-0">
                  <strong>Website:</strong>
                  <span class="view-mode" id="viewWebsite">
                    ${org.website ?
                      `<a href="${org.website.startsWith('http://') || org.website.startsWith('https://') ? org.website : 'https://' + org.website}" target="_blank" rel="noopener noreferrer">
                        ${utils.escapeHtml(org.website)} <i class="bi bi-box-arrow-up-right small"></i>
                      </a>` : 'N/A'}
                  </span>
                  <input type="url" class="form-control form-control-sm edit-mode" id="editWebsite"
                    value="${utils.escapeHtml(org.website || '')}" style="display: none;" placeholder="e.g., https://example.com">
                </div>
              </div>
            </div>
          </div>

          <div class="col-md-4 mb-3">
            <h6 class="text-muted mb-2"><i class="bi bi-geo-alt me-2"></i>Location</h6>
            <div class="card">
              <div class="card-body">
                <div class="mb-2">
                  <strong>Region:</strong>
                  <span class="view-mode" id="viewRegion">
                    <span class="badge bg-success-subtle text-success">${utils.escapeHtml(org.region || 'N/A')}</span>
                  </span>
                  <select class="form-select form-select-sm edit-mode" id="editRegion" style="display: none;">
                    <option value="">Select Region</option>
                    ${REGIONS.map(r => `<option value="${r}" ${org.region === r ? 'selected' : ''}>${r}</option>`).join('')}
                  </select>
                </div>
                <div class="mb-2">
                  <strong>Address:</strong>
                  <span class="view-mode" id="viewAddress">${utils.escapeHtml(org.address || 'N/A')}</span>
                  <textarea class="form-control form-control-sm edit-mode" id="editAddress"
                    rows="3" style="display: none;">${utils.escapeHtml(org.address || '')}</textarea>
                </div>
                <div class="mb-0">
                  <strong>Catchment Area:</strong>
                  <span class="view-mode" id="viewCatchmentArea">${utils.escapeHtml(org.catchment_area || 'N/A')}</span>
                  <textarea class="form-control form-control-sm edit-mode" id="editCatchmentArea"
                    rows="3" style="display: none;" placeholder="e.g., London, Southeast England, National">${utils.escapeHtml(org.catchment_area || '')}</textarea>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Status & Notes Row -->
        <div class="row mt-3">
          <div class="col-md-6 mb-3">
            <h6 class="text-muted mb-2"><i class="bi bi-flag me-2"></i>Company Status</h6>
            <div class="card">
              <div class="card-body">
                <div class="d-flex flex-wrap gap-1">
                  ${['prospect','entrant','nominee','shortlisted','winner','sponsor','past_winner'].map(s => `
                    <button class="btn btn-sm ${org.status === s ? 'btn-primary' : 'btn-outline-secondary'}"
                      onclick="orgsModule.updateOrgStatus('${org.id}', '${s}')">
                      ${s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ')}
                    </button>
                  `).join('')}
                </div>
              </div>
            </div>
          </div>
          <div class="col-md-6 mb-3">
            <h6 class="text-muted mb-2"><i class="bi bi-chat-left-text me-2"></i>Notes & Comments</h6>
            <div class="card">
              <div class="card-body">
                <div id="orgThreadedNotes">Loading notes...</div>
                <hr class="my-2">
                <div class="input-group input-group-sm">
                  <input type="text" class="form-control" id="newNoteContent" placeholder="Add a note..."
                    onkeydown="if(event.key==='Enter'){event.preventDefault();orgsModule.addThreadedNote('${org.id}');}">
                  <button class="btn btn-primary" onclick="orgsModule.addThreadedNote('${org.id}')"><i class="bi bi-send"></i></button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Company Details Section -->
        <div class="row mt-3">
          <div class="col-md-6 mb-3">
            <h6 class="text-muted mb-2"><i class="bi bi-info-circle me-2"></i>Company Details</h6>
            <div class="card">
              <div class="card-body">
                <div class="mb-2">
                  <strong>Description:</strong>
                  <span class="view-mode" id="viewDescription">${utils.escapeHtml(org.description || 'N/A')}</span>
                  <textarea class="form-control form-control-sm edit-mode" id="editDescription" rows="3" style="display: none;">${utils.escapeHtml(org.description || '')}</textarea>
                </div>
                <div class="mb-2">
                  <strong>Achievements:</strong>
                  <span class="view-mode" id="viewAchievements">${utils.escapeHtml(org.achievements || 'N/A')}</span>
                  <textarea class="form-control form-control-sm edit-mode" id="editAchievements" rows="3" style="display: none;">${utils.escapeHtml(org.achievements || '')}</textarea>
                </div>
                <div class="row">
                  <div class="col-6 mb-2">
                    <strong>Company Size:</strong>
                    <span class="view-mode" id="viewCompanySize">${utils.escapeHtml(org.company_size || 'N/A')}</span>
                    <select class="form-select form-select-sm edit-mode" id="editCompanySize" style="display: none;">
                      <option value="">Select</option>
                      ${['1-10','11-50','51-200','201-500','500+'].map(s => `<option value="${s}" ${org.company_size === s ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                  </div>
                  <div class="col-6 mb-2">
                    <strong>Employees:</strong>
                    <span class="view-mode" id="viewEmployeeCount">${org.employee_count || 'N/A'}</span>
                    <input type="number" class="form-control form-control-sm edit-mode" id="editEmployeeCount" value="${org.employee_count || ''}" style="display: none;" min="0">
                  </div>
                </div>
                <div class="row">
                  <div class="col-6 mb-2">
                    <strong>Year Founded:</strong>
                    <span class="view-mode" id="viewYearFounded">${org.year_founded || 'N/A'}</span>
                    <input type="number" class="form-control form-control-sm edit-mode" id="editYearFounded" value="${org.year_founded || ''}" style="display: none;" min="1800" max="2026">
                  </div>
                  <div class="col-6 mb-2">
                    <strong>Tier:</strong>
                    <span class="view-mode" id="viewTier">
                      ${org.tier ? `<span class="badge bg-warning-subtle text-warning">${utils.escapeHtml(org.tier)}</span>` : 'N/A'}
                    </span>
                    <select class="form-select form-select-sm edit-mode" id="editTier" style="display: none;">
                      <option value="">None</option>
                      ${['Bronze','Silver','Gold','Platinum'].map(t => `<option value="${t}" ${org.tier === t ? 'selected' : ''}>${t}</option>`).join('')}
                    </select>
                  </div>
                </div>
                <div class="mb-0">
                  <strong>Annual Revenue:</strong>
                  <span class="view-mode" id="viewAnnualRevenue">${org.annual_revenue ? '£' + Number(org.annual_revenue).toLocaleString() : 'N/A'}</span>
                  <input type="number" class="form-control form-control-sm edit-mode" id="editAnnualRevenue" value="${org.annual_revenue || ''}" style="display: none;" min="0" step="1000" placeholder="e.g. 500000">
                </div>
              </div>
            </div>
          </div>
          <div class="col-md-6 mb-3">
            <h6 class="text-muted mb-2"><i class="bi bi-share me-2"></i>Social Media & Tags</h6>
            <div class="card">
              <div class="card-body">
                <div class="mb-2">
                  <strong><i class="bi bi-linkedin text-primary me-1"></i>LinkedIn:</strong>
                  <span class="view-mode" id="viewLinkedin">
                    ${org.linkedin_url ? `<a href="${utils.escapeHtml(org.linkedin_url)}" target="_blank" class="text-decoration-none">${utils.escapeHtml(org.linkedin_url.replace(/https?:\/\/(www\.)?linkedin\.com\//, ''))}</a>` : 'N/A'}
                  </span>
                  <input type="url" class="form-control form-control-sm edit-mode" id="editLinkedin" value="${utils.escapeHtml(org.linkedin_url || '')}" style="display: none;" placeholder="https://linkedin.com/company/...">
                </div>
                <div class="mb-2">
                  <strong><i class="bi bi-twitter-x me-1"></i>X/Twitter:</strong>
                  <span class="view-mode" id="viewTwitter">
                    ${org.twitter_url ? `<a href="${utils.escapeHtml(org.twitter_url)}" target="_blank" class="text-decoration-none">${utils.escapeHtml(org.twitter_url.replace(/https?:\/\/(www\.)?(twitter|x)\.com\//, '@'))}</a>` : 'N/A'}
                  </span>
                  <input type="url" class="form-control form-control-sm edit-mode" id="editTwitter" value="${utils.escapeHtml(org.twitter_url || '')}" style="display: none;" placeholder="https://x.com/...">
                </div>
                <div class="mb-2">
                  <strong><i class="bi bi-facebook text-primary me-1"></i>Facebook:</strong>
                  <span class="view-mode" id="viewFacebook">
                    ${org.facebook_url ? `<a href="${utils.escapeHtml(org.facebook_url)}" target="_blank" class="text-decoration-none">${utils.escapeHtml(org.facebook_url.replace(/https?:\/\/(www\.)?facebook\.com\//, ''))}</a>` : 'N/A'}
                  </span>
                  <input type="url" class="form-control form-control-sm edit-mode" id="editFacebook" value="${utils.escapeHtml(org.facebook_url || '')}" style="display: none;" placeholder="https://facebook.com/...">
                </div>
                <div class="mb-2">
                  <strong><i class="bi bi-instagram text-danger me-1"></i>Instagram:</strong>
                  <span class="view-mode" id="viewInstagram">
                    ${org.instagram_url ? `<a href="${utils.escapeHtml(org.instagram_url)}" target="_blank" class="text-decoration-none">${utils.escapeHtml(org.instagram_url.replace(/https?:\/\/(www\.)?instagram\.com\//, '@'))}</a>` : 'N/A'}
                  </span>
                  <input type="url" class="form-control form-control-sm edit-mode" id="editInstagram" value="${utils.escapeHtml(org.instagram_url || '')}" style="display: none;" placeholder="https://instagram.com/...">
                </div>
                <hr class="my-2">
                <div class="mb-0">
                  <strong><i class="bi bi-tags me-1"></i>Tags:</strong>
                  <div id="orgTagsContainer">
                    ${(org.tags && org.tags.length > 0)
                      ? org.tags.map(t => `<span class="badge bg-secondary me-1 mb-1">${utils.escapeHtml(t)} <a href="javascript:void(0);" class="text-white ms-1" onclick="orgsModule.removeTag('${org.id}', '${utils.escapeHtml(t).replace(/'/g, "\\'")}')"><i class="bi bi-x-circle-fill"></i></a></span>`).join('')
                      : '<span class="text-muted small">No tags</span>'
                    }
                  </div>
                  <div class="input-group input-group-sm mt-2">
                    <input type="text" class="form-control" id="newTagInput" placeholder="Add tag..." onkeydown="if(event.key==='Enter'){event.preventDefault();orgsModule.addTag('${org.id}');}">
                    <button class="btn btn-outline-primary" onclick="orgsModule.addTag('${org.id}')"><i class="bi bi-plus"></i></button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        ${invoicesSummary.count > 0 ?
          `<div class="mt-4">
            <h6 class="text-muted mb-3"><i class="bi bi-receipt me-2"></i>Billing & Invoices</h6>
            <div class="card">
              <div class="card-body">
                <div class="row align-items-center">
                  <div class="col-md-8">
                    <div class="row text-center">
                      <div class="col-3">
                        <div class="text-muted small">Total Invoices</div>
                        <div class="fw-bold fs-5">${invoicesSummary.count}</div>
                      </div>
                      <div class="col-3">
                        <div class="text-muted small">Total Amount</div>
                        <div class="fw-bold fs-5">£${invoicesSummary.totalAmount.toFixed(2)}</div>
                      </div>
                      <div class="col-3">
                        <div class="text-muted small">Paid</div>
                        <div class="fw-bold fs-5 text-success">£${invoicesSummary.paidAmount.toFixed(2)}</div>
                      </div>
                      <div class="col-3">
                        <div class="text-muted small">Balance Due</div>
                        <div class="fw-bold fs-5 ${invoicesSummary.balanceDue > 0 ? 'text-danger' : 'text-muted'}">£${invoicesSummary.balanceDue.toFixed(2)}</div>
                      </div>
                    </div>
                  </div>
                  <div class="col-md-4 text-end">
                    <button type="button" class="btn btn-primary"
                      onclick="orgsModule.viewOrganisationInvoices('${org.id}', '${utils.escapeHtml(org.company_name).replace(/'/g, "\\'")}')">
                      <i class="bi bi-file-earmark-text me-2"></i>View All Invoices
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>` : ''
        }

        <div class="mt-4">
          <h6 class="text-muted mb-3"><i class="bi bi-trophy me-2"></i>Award History (${awards.length})</h6>
          ${awards.length === 0 ?
            '<div class="alert alert-info">No awards found for this organisation.</div>' :
            `<div class="table-responsive">
              <table class="table table-sm table-hover">
                <thead>
                  <tr>
                    <th>Year</th>
                    <th>Category</th>
                    <th>Sector</th>
                    <th>Status</th>
                    <th>Package</th>
                    <th class="text-center">Enhanced</th>
                  </tr>
                </thead>
                <tbody>
                  ${awards.map(award => `
                    <tr>
                      <td><span class="badge bg-primary-subtle text-primary">${award.year}</span></td>
                      <td>
                        <a href="javascript:void(0);"
                           class="text-decoration-none fw-semibold text-primary"
                           onclick="assignmentsModule.openAssignmentsModal('${award.id}', '${utils.escapeHtml(utils.formatAwardName(award)).replace(/'/g, "\\'")}')">
                          ${utils.escapeHtml(utils.formatAwardName(award))}
                        </a>
                      </td>
                      <td><span class="badge bg-info-subtle text-info">${utils.escapeHtml(award.sector)}</span></td>
                      <td>${utils.getStatusBadge(award.status)}</td>
                      <td>
                        ${['bronze', 'silver', 'gold'].includes(award.package_type) ?
                          `<a href="javascript:void(0);"
                              onclick="orgsModule.openCompanyProfile('${org.id}', '${utils.escapeHtml(org.company_name).replace(/'/g, "\\'")}')">
                              ${orgsModule.getPackageBadge(award.package_type)}
                           </a>` :
                          '<span class="text-muted">-</span>'
                        }
                      </td>
                      <td class="text-center">
                        ${award.enhanced_profile ?
                          '<i class="bi bi-star-fill text-warning" title="Enhanced Profile" style="font-size: 1.2rem;"></i>' :
                          '<i class="bi bi-star text-muted" title="Standard Profile" style="font-size: 1.2rem; opacity: 0.3;"></i>'
                        }
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>`
          }
        </div>

        ${votingEntries && votingEntries.length > 0 ?
          `<div class="mt-4">
            <h6 class="text-muted mb-3"><i class="bi bi-link-45deg me-2"></i>Public Voting Links (${votingEntries.length})</h6>
            <div class="card">
              <div class="card-body">
                <div class="alert alert-info mb-3">
                  <i class="bi bi-info-circle me-2"></i>
                  Share these voting links with the company so they can gather public votes
                </div>
                <div class="table-responsive">
                  <table class="table table-sm table-hover">
                    <thead>
                      <tr>
                        <th>Entry #</th>
                        <th>Award</th>
                        <th>Entry Title</th>
                        <th>Votes</th>
                        <th>Voting Link</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${votingEntries.map(entry => {
                        const votingUrl = `${window.location.origin}/vote.html?entry=${entry.entry_number}`;
                        return `
                          <tr>
                            <td><span class="badge bg-primary">${utils.escapeHtml(entry.entry_number)}</span></td>
                            <td>
                              <strong>${utils.escapeHtml(entry.award_years ? utils.formatAwardName(entry.award_years) : 'N/A')}</strong>
                            </td>
                            <td>${utils.escapeHtml(entry.entry_title || 'N/A')}</td>
                            <td>
                              <span class="badge bg-success-subtle text-success">
                                <i class="bi bi-hand-thumbs-up me-1"></i>${entry.vote_count || 0} votes
                              </span>
                            </td>
                            <td>
                              <div class="input-group input-group-sm" style="max-width: 400px;">
                                <input type="text" class="form-control" value="${votingUrl}" readonly id="votingUrl_${entry.id}">
                                <button class="btn btn-outline-primary" type="button"
                                  onclick="navigator.clipboard.writeText('${votingUrl}'); utils.showToast('Voting link copied!', 'success');">
                                  <i class="bi bi-clipboard"></i>
                                </button>
                              </div>
                            </td>
                            <td>
                              <a href="${votingUrl}" target="_blank" class="btn btn-sm btn-outline-success" title="Open voting page">
                                <i class="bi bi-box-arrow-up-right"></i>
                              </a>
                            </td>
                          </tr>
                        `;
                      }).join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>` : ''
        }

        <!-- Enhanced Winner Profile Section -->
        <div class="mt-4">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="text-muted mb-0"><i class="bi bi-star-fill me-2"></i>Enhanced Winner Profile</h6>
            <div class="btn-group btn-group-sm" role="group">
              <button type="button"
                class="btn ${org.winner_profile_status === 'published' ? 'btn-success' : 'btn-outline-success'}"
                onclick="orgsModule.setWinnerProfileStatus('${org.id}', 'published')">
                <i class="bi bi-check-circle me-1"></i>Published
              </button>
              <button type="button"
                class="btn ${org.winner_profile_status === 'draft' || !org.winner_profile_status ? 'btn-secondary' : 'btn-outline-secondary'}"
                onclick="orgsModule.setWinnerProfileStatus('${org.id}', 'draft')">
                <i class="bi bi-file-earmark me-1"></i>Draft
              </button>
            </div>
          </div>

          <div class="card">
            <div class="card-body">
              <form id="winnerProfileForm">
                <div class="mb-3">
                  <label class="form-label fw-semibold">Introduction</label>
                  <textarea
                    id="winnerIntro"
                    class="form-control"
                    rows="6"
                    placeholder="Enter winner introduction and achievements...">${utils.escapeHtml(org.winner_intro || '')}</textarea>
                  <small class="text-muted">Rich text displayed on Award page and winner modal</small>
                </div>

                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label class="form-label fw-semibold">YouTube Video ID</label>
                    <input
                      type="text"
                      id="winnerVideoId"
                      class="form-control"
                      placeholder="e.g., dQw4w9WgXcQ"
                      value="${utils.escapeHtml(org.winner_video_id || '')}">
                    <small class="text-muted">Extract from: youtube.com/watch?v=<strong>VIDEO_ID</strong></small>
                  </div>

                  <div class="col-md-6 mb-3">
                    <label class="form-label fw-semibold">Vote for Us Page URL</label>
                    <input
                      type="url"
                      id="winnerVoteUrl"
                      class="form-control"
                      placeholder="https://example.com/vote-for-us"
                      value="${utils.escapeHtml(org.winner_vote_url || '')}">
                    <small class="text-muted">Public voting page link</small>
                  </div>
                </div>

                <div class="d-flex gap-2">
                  <button type="button" class="btn btn-primary" onclick="orgsModule.saveWinnerProfile('${org.id}')">
                    <i class="bi bi-save me-2"></i>Save Profile
                  </button>
                  <button type="button" class="btn btn-secondary" onclick="orgsModule.cancelWinnerProfile('${org.id}', '${utils.escapeHtml(org.company_name || '').replace(/'/g, "\\'")}')">
                    <i class="bi bi-x-circle me-2"></i>Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        <!-- Company Images Section (for Marketing) -->
        <div class="mt-4">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="text-muted mb-0"><i class="bi bi-images me-2"></i>Company Images for Marketing (${(companyImages || []).length})</h6>
            <button type="button" class="btn btn-sm btn-primary" onclick="orgsModule.openUploadImagesModal('${org.id}')">
              <i class="bi bi-cloud-upload me-1"></i>Upload Images
            </button>
          </div>
          ${!companyImages || companyImages.length === 0 ?
            '<div class="alert alert-info"><i class="bi bi-info-circle me-2"></i>No marketing images uploaded yet. Click "Upload Images" to add photos for email campaigns.</div>' :
            `<div class="row g-3">
              ${companyImages.map(img => `
                <div class="col-md-3">
                  <div class="card h-100">
                    <img src="${img.file_url}" class="card-img-top" alt="${utils.escapeHtml(img.title || 'Company Image')}"
                      style="height: 180px; object-fit: cover; cursor: pointer;"
                      onclick="orgsModule.viewImageFull('${img.file_url}', '${utils.escapeHtml(img.title || 'Company Image')}')">
                    <div class="card-body p-2">
                      <p class="card-text small mb-1 fw-semibold">${utils.escapeHtml(img.title || 'Untitled')}</p>
                      ${img.caption ? `<p class="card-text small text-muted mb-2">${utils.escapeHtml(img.caption)}</p>` : ''}
                      <button class="btn btn-sm btn-outline-danger w-100"
                        onclick="orgsModule.deleteCompanyImage('${img.id}', '${org.id}')">
                        <i class="bi bi-trash me-1"></i>Delete
                      </button>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>`
          }
        </div>

        <!-- Tagged Media Gallery Section -->
        <div class="mt-4">
          <h6 class="text-muted mb-3"><i class="bi bi-images me-2"></i>Tagged Media Gallery (${(taggedMedia || []).length})</h6>
          ${!taggedMedia || taggedMedia.length === 0 ?
            '<div class="alert alert-info">No media tagged to this organisation yet. Upload photos/videos in the Media Gallery tab and tag them to this company.</div>' :
            `<div class="row g-3">
              ${taggedMedia.map(media => {
                const isImage = media.file_type?.startsWith('image/');
                const isYouTube = media.file_type === 'video/youtube';
                const eventName = media.events?.event_name || 'Unknown Event';
                const eventYear = media.events?.year || media.events?.event_date?.substring(0, 4) || '';

                return `
                  <div class="col-md-3">
                    <div class="card h-100">
                      ${isImage ?
                        `<img src="${media.file_url}" class="card-img-top" alt="${utils.escapeHtml(media.title || 'Media')}" style="height: 150px; object-fit: cover;">` :
                        isYouTube ?
                        `<div class="card-img-top" style="height: 150px; position: relative;">
                          <img src="https://img.youtube.com/vi/${media.file_url}/mqdefault.jpg"
                            alt="${utils.escapeHtml(media.title || 'YouTube Video')}"
                            style="width: 100%; height: 100%; object-fit: cover;">
                          <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);">
                            <i class="bi bi-youtube text-danger" style="font-size: 2.5rem; filter: drop-shadow(0 0 10px rgba(0,0,0,0.5));"></i>
                          </div>
                        </div>` :
                        `<div class="card-img-top d-flex align-items-center justify-content-center bg-dark" style="height: 150px;">
                          <i class="bi bi-play-circle text-white" style="font-size: 3rem;"></i>
                        </div>`
                      }
                      <div class="card-body p-2">
                        <p class="card-text small mb-1 fw-semibold">${utils.escapeHtml(media.title || 'Untitled')}</p>
                        <p class="card-text small text-muted mb-0">
                          <i class="bi bi-calendar-event me-1"></i>${utils.escapeHtml(eventName)}${eventYear ? ` (${eventYear})` : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>`
          }
        </div>

        <!-- Organisation Contacts Section (Area 4) -->
        <div class="mt-4">
          <h6 class="text-muted mb-3"><i class="bi bi-people me-2"></i>Organisation Contacts</h6>
          <div class="card"><div class="card-body">
            <div id="orgContactsList">Loading contacts...</div>
            <hr class="my-3">
            <h6 class="small fw-semibold">Add New Contact</h6>
            <div class="row g-2">
              <div class="col-md-2"><input type="text" class="form-control form-control-sm" id="newContactFirstName" placeholder="First Name"></div>
              <div class="col-md-2"><input type="text" class="form-control form-control-sm" id="newContactLastName" placeholder="Last Name"></div>
              <div class="col-md-2"><input type="text" class="form-control form-control-sm" id="newContactJobTitle" placeholder="Job Title"></div>
              <div class="col-md-2"><input type="email" class="form-control form-control-sm" id="newContactEmailAddr" placeholder="Email"></div>
              <div class="col-md-2"><input type="tel" class="form-control form-control-sm" id="newContactPhoneNum" placeholder="Phone"></div>
              <div class="col-md-2">
                <div class="form-check form-check-inline"><input class="form-check-input" type="checkbox" id="newContactIsPrimary"><label class="form-check-label small">Primary</label></div>
                <div class="form-check form-check-inline"><input class="form-check-input" type="checkbox" id="newContactReceiveEmails" checked><label class="form-check-label small">Emails</label></div>
              </div>
            </div>
            <button class="btn btn-sm btn-primary mt-2" onclick="orgsModule.addContact('${orgId}')"><i class="bi bi-plus me-1"></i>Add Contact</button>
          </div></div>
        </div>

        <!-- Unified Activity Timeline (Feature 2) -->
        <div class="mt-4">
          <h6 class="text-muted mb-3"><i class="bi bi-clock-history me-2"></i>Activity Timeline
            <span class="badge bg-light text-muted ms-1" style="font-size: 0.6rem;">emails, notes, awards, invoices, status changes</span>
          </h6>
          <div class="card"><div class="card-body" id="orgActivityTimeline">Loading activity...</div></div>
        </div>

        <!-- Communications History & Stats (Area 6) -->
        <div class="mt-4">
          <div class="row">
            <div class="col-md-6">
              <h6 class="text-muted mb-3"><i class="bi bi-envelope-check me-2"></i>Communications History</h6>
              <div class="card"><div class="card-body" id="orgCommsHistory">Loading...</div></div>
            </div>
            <div class="col-md-6">
              <h6 class="text-muted mb-3"><i class="bi bi-calendar-check me-2"></i>Scheduled Follow-ups</h6>
              <div class="card"><div class="card-body">
                <div id="orgFollowUpsList"></div>
                <hr class="my-2">
                <div class="row g-2">
                  <div class="col-5"><input type="date" class="form-control form-control-sm" id="followUpDate" min="${new Date().toISOString().split('T')[0]}"></div>
                  <div class="col-5"><input type="text" class="form-control form-control-sm" id="followUpNote" placeholder="Reminder note..."></div>
                  <div class="col-2"><button class="btn btn-sm btn-primary w-100" onclick="orgsModule.addFollowUp('${orgId}')"><i class="bi bi-plus"></i></button></div>
                </div>
              </div></div>
            </div>
          </div>
          <div class="mt-2 d-flex gap-2">
            <button class="btn btn-sm btn-outline-primary" onclick="orgsModule.openEmailTemplate('${orgId}')"><i class="bi bi-envelope me-1"></i>Email Templates</button>
            <button class="btn btn-sm btn-outline-success" onclick="orgsModule.openSMSTemplate('${orgId}')"><i class="bi bi-chat-dots me-1"></i>SMS / WhatsApp</button>
          </div>
        </div>

        <!-- Document Attachments Section (Area 5) -->
        <div class="mt-4">
          <h6 class="text-muted mb-3"><i class="bi bi-file-earmark me-2"></i>Document Attachments</h6>
          <div class="card"><div class="card-body">
            <div id="orgDocumentsList">Loading documents...</div>
            <hr class="my-2">
            <div class="row g-2 align-items-end">
              <div class="col-md-4"><input type="file" class="form-control form-control-sm" id="docUploadInput"></div>
              <div class="col-md-4"><input type="text" class="form-control form-control-sm" id="docTitle" placeholder="Document title..."></div>
              <div class="col-md-4"><button class="btn btn-sm btn-primary" onclick="orgsModule.uploadDocument('${orgId}')"><i class="bi bi-cloud-upload me-1"></i>Upload</button></div>
            </div>
          </div></div>
        </div>

        <!-- Custom Fields Section (Database-backed) -->
        <div class="mt-4">
          <h6 class="text-muted mb-3"><i class="bi bi-sliders me-2"></i>Custom Fields</h6>
          <div class="card"><div class="card-body">
            <div id="orgCustomFieldsList"></div>
            <hr class="my-2">
            <div class="row g-2 align-items-end">
              <div class="col-md-4"><input type="text" class="form-control form-control-sm" id="customFieldName" placeholder="Field name..."></div>
              <div class="col-md-4"><input type="text" class="form-control form-control-sm" id="customFieldValue" placeholder="Value..."></div>
              <div class="col-md-4"><button class="btn btn-sm btn-primary" onclick="orgsModule.addCustomField('${orgId}')"><i class="bi bi-plus me-1"></i>Add Field</button></div>
            </div>
          </div></div>
        </div>

        <!-- Linked Organisations / Relationships (Feature 3) -->
        <div class="mt-4">
          <h6 class="text-muted mb-3"><i class="bi bi-diagram-3 me-2"></i>Linked Organisations</h6>
          <div class="card"><div class="card-body">
            <div id="orgRelationshipsList">Loading relationships...</div>
            <hr class="my-2">
            <div class="row g-2 align-items-end">
              <div class="col-md-4">
                <input type="text" class="form-control form-control-sm" id="relatedOrgSearch" placeholder="Search organisation..." list="orgNameSuggestions">
                <datalist id="orgNameSuggestions">
                  ${STATE.allOrganisations.filter(o => o.id !== orgId).slice(0, 100).map(o => `<option value="${utils.escapeHtml(o.company_name)}">`).join('')}
                </datalist>
              </div>
              <div class="col-md-4">
                <select class="form-select form-select-sm" id="relationshipType">
                  <option value="related">Related</option>
                  <option value="parent">Parent Company</option>
                  <option value="subsidiary">Subsidiary</option>
                  <option value="co_sponsor">Co-Sponsor</option>
                  <option value="partner">Partner</option>
                  <option value="franchise">Franchise</option>
                </select>
              </div>
              <div class="col-md-4"><button class="btn btn-sm btn-primary" onclick="orgsModule.addRelationship('${orgId}')"><i class="bi bi-link me-1"></i>Link</button></div>
            </div>
          </div></div>
        </div>

        <!-- Email Integration (Feature 4) -->
        <div class="mt-4">
          <h6 class="text-muted mb-3"><i class="bi bi-envelope-at me-2"></i>Compose Email</h6>
          <div class="card"><div class="card-body">
            <div class="mb-2">
              <strong>To:</strong> ${org.email ? `<a href="mailto:${org.email}">${utils.escapeHtml(org.email)}</a>` : '<span class="text-danger">No email address</span>'}
            </div>
            <div class="mb-2">
              <input type="text" class="form-control form-control-sm" id="profileEmailSubject" placeholder="Subject...">
            </div>
            <div class="mb-2">
              <textarea class="form-control form-control-sm" id="profileEmailBody" rows="3" placeholder="Message..."></textarea>
            </div>
            <button class="btn btn-sm btn-primary" onclick="orgsModule.composeEmailFromProfile('${orgId}')" ${!org.email ? 'disabled' : ''}>
              <i class="bi bi-send me-1"></i>Open Email Client
            </button>
          </div></div>
        </div>

        <!-- Sponsorship Packages (Feature 9) -->
        <div class="mt-4">
          <h6 class="text-muted mb-3"><i class="bi bi-cash-stack me-2"></i>Sponsorship Packages</h6>
          <div class="card"><div class="card-body">
            <div id="orgSponsorshipPackages">Loading packages...</div>
            <hr class="my-2">
            <details>
              <summary class="small fw-semibold text-primary cursor-pointer">Add New Package</summary>
              <div class="mt-2">
                <div class="row g-2">
                  <div class="col-md-4"><input type="text" class="form-control form-control-sm" id="spkgName" placeholder="Package name..."></div>
                  <div class="col-md-4">
                    <select class="form-select form-select-sm" id="spkgTier">
                      <option value="">Tier</option>
                      <option value="Bronze">Bronze</option>
                      <option value="Silver">Silver</option>
                      <option value="Gold">Gold</option>
                      <option value="Platinum">Platinum</option>
                      <option value="Custom">Custom</option>
                    </select>
                  </div>
                  <div class="col-md-4"><input type="number" class="form-control form-control-sm" id="spkgAmount" placeholder="Amount (£)" min="0" step="100"></div>
                </div>
                <div class="row g-2 mt-1">
                  <div class="col-md-3"><input type="date" class="form-control form-control-sm" id="spkgStartDate" title="Start Date"></div>
                  <div class="col-md-3"><input type="date" class="form-control form-control-sm" id="spkgEndDate" title="End Date"></div>
                  <div class="col-md-3"><input type="date" class="form-control form-control-sm" id="spkgRenewalDate" title="Renewal Date"></div>
                  <div class="col-md-3">
                    <select class="form-select form-select-sm" id="spkgSchedule">
                      <option value="one_time">One-time</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="annual">Annual</option>
                    </select>
                  </div>
                </div>
                <div class="mt-1">
                  <textarea class="form-control form-control-sm" id="spkgBenefits" rows="2" placeholder="Benefits (one per line)..."></textarea>
                </div>
                <button class="btn btn-sm btn-primary mt-2" onclick="orgsModule.addSponsorshipPackage('${orgId}')"><i class="bi bi-plus me-1"></i>Add Package</button>
              </div>
            </details>
          </div></div>
        </div>

        <!-- Data Completeness Score (Area 9) -->
        <div class="mt-4">
          <h6 class="text-muted mb-3"><i class="bi bi-speedometer2 me-2"></i>Data Completeness</h6>
          <div class="card"><div class="card-body">
            <div class="d-flex align-items-center gap-3">
              <div class="progress flex-grow-1" style="height: 24px;">
                <div class="progress-bar ${this.calculateCompletenessScore(org) >= 70 ? 'bg-success' : this.calculateCompletenessScore(org) >= 40 ? 'bg-warning' : 'bg-danger'}" style="width: ${this.calculateCompletenessScore(org)}%">
                  ${this.calculateCompletenessScore(org)}%
                </div>
              </div>
              <span class="fw-bold">${this.calculateCompletenessScore(org)}%</span>
            </div>
            <small class="text-muted mt-1 d-block">Based on: name, email, contact, phone, website, logo, sector, region, address, description</small>
          </div></div>
        </div>
      `;

      // Load async sections after render
      this._loadProfileAsyncSections(orgId);

      // Store current org data for editing
      this.currentEditingOrg = org;
      this.originalOrgData = { ...org };

      // Show edit button
      editBtn.style.display = 'inline-block';

      // Setup edit button event listener
      editBtn.onclick = () => this.enableEditMode(orgId);
      saveBtn.onclick = () => this.saveOrgChanges(orgId);
      cancelBtn.onclick = () => this.cancelEditMode(orgId, companyName);

    } catch (error) {
      console.error('Error loading company profile:', error);
      contentDiv.innerHTML = `
        <div class="alert alert-danger">
          <i class="bi bi-exclamation-triangle me-2"></i>
          Failed to load company profile: ${utils.escapeHtml(error.message)}
        </div>
      `;
    }
  },

  /**
   * Load async sections for company profile (contacts, timeline, comms, docs, custom fields)
   */
  async _loadProfileAsyncSections(orgId) {
    // Load contacts
    const contacts = await this.loadOrgContacts(orgId);
    const contactsEl = document.getElementById('orgContactsList');
    if (contactsEl) contactsEl.innerHTML = this.renderContactsSection(orgId, contacts);

    // Load unified activity timeline (Feature 2)
    const timeline = await this.loadUnifiedTimeline(orgId);
    const timelineEl = document.getElementById('orgActivityTimeline');
    if (timelineEl) {
      timelineEl.innerHTML = this.renderUnifiedTimeline(timeline);
    }

    // Load threaded notes (Feature 8)
    const notes = await this.getThreadedNotes(orgId);
    const notesEl = document.getElementById('orgThreadedNotes');
    if (notesEl) notesEl.innerHTML = this.renderThreadedNotes(notes, orgId);

    // Load relationships (Feature 3)
    const relationships = await this.getRelationships(orgId);
    const relsEl = document.getElementById('orgRelationshipsList');
    if (relsEl) relsEl.innerHTML = this.renderRelationships(relationships, orgId);

    // Load sponsorship packages (Feature 9)
    const packages = await this.getSponsorshipPackages(orgId);
    const pkgsEl = document.getElementById('orgSponsorshipPackages');
    if (pkgsEl) pkgsEl.innerHTML = this.renderSponsorshipPackages(packages, orgId);

    // Load comms history
    const commsEl = document.getElementById('orgCommsHistory');
    if (commsEl) commsEl.innerHTML = await this.renderCommsHistory(orgId);

    // Load follow-ups (now async/database-backed)
    const followUps = await this.getFollowUps(orgId);
    const followUpsEl = document.getElementById('orgFollowUpsList');
    if (followUpsEl) {
      if (followUps.length === 0) {
        followUpsEl.innerHTML = '<p class="text-muted small mb-0">No scheduled follow-ups</p>';
      } else {
        followUpsEl.innerHTML = `<div class="list-group list-group-flush">
          ${followUps.map(f => {
            const isOverdue = !f.done && new Date(f.date) < new Date();
            const fId = f.id || f.orgId;
            return `<div class="list-group-item px-0 py-2 border-0 d-flex align-items-center ${f.done ? 'text-muted' : ''}">
              <i class="bi ${f.done ? 'bi-check-circle text-success' : isOverdue ? 'bi-exclamation-circle text-danger' : 'bi-clock text-warning'} me-2"></i>
              <div class="flex-grow-1">
                <div class="small ${f.done ? 'text-decoration-line-through' : 'fw-semibold'}">${utils.escapeHtml(f.note || 'Follow up')}</div>
                <div class="text-muted" style="font-size: 0.7rem;">${new Date(f.date).toLocaleDateString('en-GB')} ${isOverdue && !f.done ? '<span class="text-danger">OVERDUE</span>' : ''}</div>
              </div>
              ${!f.done ? `<button class="btn btn-sm btn-outline-success me-1" onclick="orgsModule.completeFollowUp('${orgId}','${fId}')"><i class="bi bi-check"></i></button>` : ''}
              <button class="btn btn-sm btn-outline-danger" onclick="orgsModule.deleteFollowUp('${orgId}','${fId}')"><i class="bi bi-x"></i></button>
            </div>`;
          }).join('')}
        </div>`;
      }
    }

    // Load documents
    const docs = await this.getDocuments(orgId);
    const docsEl = document.getElementById('orgDocumentsList');
    if (docsEl) {
      if (docs.length === 0) {
        docsEl.innerHTML = '<p class="text-muted small mb-0">No documents attached yet</p>';
      } else {
        docsEl.innerHTML = `<div class="list-group list-group-flush">
          ${docs.map(d => `<a href="${d.file_url}" target="_blank" class="list-group-item list-group-item-action d-flex align-items-center py-2 px-0 border-0">
            <i class="bi bi-file-earmark me-2 text-primary"></i>
            <div class="flex-grow-1">
              <div class="small fw-semibold">${utils.escapeHtml(d.title || 'Document')}</div>
              <div class="text-muted" style="font-size: 0.7rem;">${d.file_size ? Math.round(d.file_size / 1024) + ' KB' : ''} ${d.created_at ? '&middot; ' + new Date(d.created_at).toLocaleDateString('en-GB') : ''}</div>
            </div>
            <i class="bi bi-box-arrow-up-right text-muted"></i>
          </a>`).join('')}
        </div>`;
      }
    }

    // Load custom fields (now async/database-backed)
    const customFields = await this.getCustomFields(orgId);
    const cfEl = document.getElementById('orgCustomFieldsList');
    if (cfEl) {
      const entries = Object.entries(customFields);
      if (entries.length === 0) {
        cfEl.innerHTML = '<p class="text-muted small mb-0">No custom fields defined</p>';
      } else {
        cfEl.innerHTML = entries.map(([name, value]) => `
          <div class="d-flex align-items-center mb-1">
            <span class="small fw-semibold me-2" style="width: 120px;">${utils.escapeHtml(name)}:</span>
            <span class="small flex-grow-1">${utils.escapeHtml(value)}</span>
            <button class="btn btn-sm btn-outline-danger py-0" onclick="orgsModule.removeCustomField('${orgId}','${utils.escapeHtml(name).replace(/'/g, "\\'")}')"><i class="bi bi-x"></i></button>
          </div>
        `).join('');
      }
    }
  },

  /**
   * Validate and upload company logo
   * @param {string} orgId - Organisation ID
   * @param {HTMLInputElement} inputElement - File input element
   */
  async validateAndUploadLogo(orgId, inputElement) {
    const file = inputElement.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      utils.showToast('Please select an image file', 'error');
      inputElement.value = '';
      return;
    }

    // Create an image to check dimensions
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.onload = async () => {
        // Validate dimensions (exactly 250x170 px)
        if (img.width !== 250 || img.height !== 170) {
          utils.showToast(`Image must be exactly 250x170 px. Your image is ${img.width}x${img.height} px`, 'error');
          inputElement.value = '';
          return;
        }

        // Dimensions are correct, proceed with upload
        try {
          utils.showLoading();

          // Generate unique filename
          const timestamp = Date.now();
          const fileExt = file.name.split('.').pop();
          const fileName = `logos/${orgId}/${timestamp}.${fileExt}`;

          // Upload to Supabase Storage
          const { data: uploadData, error: uploadError } = await STATE.client.storage
            .from('organisation-logos')
            .upload(fileName, file, {
              cacheControl: '3600',
              upsert: false
            });

          if (uploadError) throw uploadError;

          // Get public URL
          const { data: urlData } = STATE.client.storage
            .from('organisation-logos')
            .getPublicUrl(fileName);

          // Update organisation record with logo URL
          const { error: updateError } = await STATE.client
            .from('organisations')
            .update({ logo_url: urlData.publicUrl })
            .eq('id', orgId);

          if (updateError) throw updateError;

          utils.showToast('Logo uploaded successfully!', 'success');

          // Reload the profile to show new logo
          const org = STATE.allOrganisations.find(o => o.id === orgId);
          if (org) {
            await this.openCompanyProfile(orgId, org.company_name);
          }

        } catch (error) {
          console.error('Error uploading logo:', error);
          utils.showToast('Error uploading logo: ' + error.message, 'error');
          inputElement.value = '';
        } finally {
          utils.hideLoading();
        }
      };

      img.onerror = () => {
        utils.showToast('Failed to load image', 'error');
        inputElement.value = '';
      };

      img.src = e.target.result;
    };

    reader.onerror = () => {
      utils.showToast('Failed to read file', 'error');
      inputElement.value = '';
    };

    reader.readAsDataURL(file);
  },

  /**
   * Set winner profile status
   * @param {string} orgId - Organisation ID
   * @param {string} status - 'published' or 'draft'
   */
  async setWinnerProfileStatus(orgId, status) {
    try {
      utils.showLoading();

      const { error } = await STATE.client
        .from('organisations')
        .update({ winner_profile_status: status })
        .eq('id', orgId);

      if (error) throw error;

      utils.showToast(`Winner profile ${status === 'published' ? 'published' : 'saved as draft'}!`, 'success');

      // Reload the profile to show updated status
      const org = STATE.allOrganisations.find(o => o.id === orgId);
      if (org) {
        await this.openCompanyProfile(orgId, org.company_name);
      }

    } catch (error) {
      console.error('Error updating status:', error);
      utils.showToast('Error updating status: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Save winner profile
   * @param {string} orgId - Organisation ID
   */
  async saveWinnerProfile(orgId) {
    const intro = document.getElementById('winnerIntro').value.trim();
    const videoId = document.getElementById('winnerVideoId').value.trim();
    const voteUrl = document.getElementById('winnerVoteUrl').value.trim();

    try {
      utils.showLoading();

      const { error } = await STATE.client
        .from('organisations')
        .update({
          winner_intro: intro || null,
          winner_video_id: videoId || null,
          winner_vote_url: voteUrl || null
        })
        .eq('id', orgId);

      if (error) throw error;

      utils.showToast('Winner profile saved successfully!', 'success');

      // Reload the profile
      const org = STATE.allOrganisations.find(o => o.id === orgId);
      if (org) {
        await this.openCompanyProfile(orgId, org.company_name);
      }

    } catch (error) {
      console.error('Error saving winner profile:', error);
      utils.showToast('Error saving winner profile: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Cancel winner profile editing
   * @param {string} orgId - Organisation ID
   * @param {string} companyName - Company name
   */
  async cancelWinnerProfile(orgId, companyName) {
    if (utils.confirm('Discard changes to winner profile?')) {
      await this.openCompanyProfile(orgId, companyName);
    }
  },

  /**
   * Open logo gallery modal to select from media gallery
   * @param {string} orgId - Organisation ID
   */
  async openLogoGalleryModal(orgId) {
    this.currentOrgIdForLogo = orgId;

    const modal = new bootstrap.Modal(document.getElementById('selectLogoModal'));
    modal.show();

    const contentDiv = document.getElementById('logoGalleryContent');
    contentDiv.innerHTML = `
      <div class="text-center py-4">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
      </div>
    `;

    try {
      // Fetch all media from media gallery
      const { data: allMedia, error } = await STATE.client
        .from('media_gallery')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter images only (no videos) and check dimensions
      const imageMedia = (allMedia || []).filter(m =>
        m.file_url && m.file_url.match(/\.(jpg|jpeg|png|gif|webp)$/i)
      );

      if (imageMedia.length === 0) {
        contentDiv.innerHTML = `
          <div class="alert alert-warning">
            <i class="bi bi-exclamation-triangle me-2"></i>
            No images found in Media Gallery. Upload some images first.
          </div>
        `;
        return;
      }

      // Check dimensions of each image
      const validLogos = [];
      let checkedCount = 0;

      for (const media of imageMedia) {
        // Load image to check dimensions
        const img = new Image();
        img.crossOrigin = 'anonymous';

        await new Promise((resolve) => {
          img.onload = () => {
            if (img.width === 250 && img.height === 170) {
              validLogos.push(media);
            }
            checkedCount++;
            resolve();
          };
          img.onerror = () => {
            checkedCount++;
            resolve();
          };
          img.src = media.file_url;
        });
      }

      // Display valid logos
      if (validLogos.length === 0) {
        contentDiv.innerHTML = `
          <div class="alert alert-warning">
            <i class="bi bi-exclamation-triangle me-2"></i>
            No images with 250x170 px dimensions found. Please upload images with the correct size to Media Gallery.
          </div>
        `;
        return;
      }

      contentDiv.innerHTML = `
        <div class="row g-3">
          ${validLogos.map(media => `
            <div class="col-md-3">
              <div class="card h-100 logo-option" style="cursor: pointer;"
                   onclick="orgsModule.setLogoFromGallery('${orgId}', '${media.file_url}', '${media.id}')">
                <img src="${media.file_url}" class="card-img-top"
                     alt="${utils.escapeHtml(media.title || 'Logo')}"
                     style="height: 170px; object-fit: contain; background: #f8f9fa;">
                <div class="card-body p-2">
                  <p class="card-text small mb-0 text-center">${utils.escapeHtml(media.title || 'Untitled')}</p>
                  <p class="card-text small text-muted text-center mb-0">250 x 170 px</p>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `;

      // Add hover effect (reuse existing style tag to prevent leaks)
      if (!document.getElementById('logo-option-hover-style')) {
        const style = document.createElement('style');
        style.id = 'logo-option-hover-style';
        style.textContent = `
          .logo-option:hover {
            transform: scale(1.05);
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            transition: all 0.2s;
          }
        `;
        document.head.appendChild(style);
      }

    } catch (error) {
      console.error('Error loading media gallery:', error);
      contentDiv.innerHTML = `
        <div class="alert alert-danger">
          <i class="bi bi-exclamation-triangle me-2"></i>
          Error loading media gallery: ${utils.escapeHtml(error.message)}
        </div>
      `;
    }
  },

  /**
   * Set logo from media gallery
   * @param {string} orgId - Organisation ID
   * @param {string} fileUrl - URL of the selected image
   * @param {string} mediaId - Media ID
   */
  async setLogoFromGallery(orgId, fileUrl, mediaId) {
    try {
      utils.showLoading();

      // Update organisation record with logo URL
      const { error } = await STATE.client
        .from('organisations')
        .update({ logo_url: fileUrl })
        .eq('id', orgId);

      if (error) throw error;

      utils.showToast('Logo updated successfully!', 'success');

      // Close the modal
      const modal = bootstrap.Modal.getInstance(document.getElementById('selectLogoModal'));
      if (modal) modal.hide();

      // Reload the profile to show new logo
      const org = STATE.allOrganisations.find(o => o.id === orgId);
      if (org) {
        org.logo_url = fileUrl; // Update in state
        await this.openCompanyProfile(orgId, org.company_name);
        await this.loadOrganisations(); // Refresh table
      }

    } catch (error) {
      console.error('Error setting logo:', error);
      utils.showToast('Error setting logo: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Fetch company logo from their website URL
   * @param {string} orgId - Organisation ID
   * @param {string} [websiteUrl] - Company website URL (optional, looked up from state)
   * @param {string} [companyName] - Company name (optional)
   */
  async fetchLogoFromWebsite(orgId, websiteUrl, companyName) {
    try {
      // If no websiteUrl provided, look it up from state
      if (!websiteUrl) {
        const org = STATE.allOrganisations.find(o => o.id === orgId);
        if (!org || !org.website) {
          utils.showToast('Please add a website URL first', 'warning');
          return;
        }
        websiteUrl = org.website;
        companyName = org.company_name;
      }

      utils.showLoading('Fetching logo...');

      // Clean up the website URL to get the domain
      let cleanUrl = websiteUrl.trim();
      if (!cleanUrl.startsWith('http')) cleanUrl = 'https://' + cleanUrl;
      let domain = new URL(cleanUrl).hostname.replace(/^www\./, '');

      // Try multiple logo services in order
      const logoServices = [
        // Clearbit Logo API (best quality, but may not have all companies)
        `https://logo.clearbit.com/${domain}`,
        // Google's favicon service (good fallback)
        `https://www.google.com/s2/favicons?sz=128&domain=${domain}`,
        // DuckDuckGo icon service
        `https://icons.duckduckgo.com/ip3/${domain}.ico`
      ];

      let logoUrl = null;

      // Try each service until we find one that works
      for (const serviceUrl of logoServices) {
        try {
          const response = await fetch(serviceUrl, { method: 'HEAD' });
          if (response.ok) {
            logoUrl = serviceUrl;
            break;
          }
        } catch (e) {
          // Try next service
          continue;
        }
      }

      if (!logoUrl) {
        // If all services fail, try the first one anyway (Clearbit)
        logoUrl = logoServices[0];
      }

      // Update the organisation's logo_url
      const { error } = await STATE.client
        .from('organisations')
        .update({ logo_url: logoUrl })
        .eq('id', orgId);

      if (error) throw error;

      utils.showToast('Logo fetched successfully from website!', 'success');

      // Reload the profile to show new logo
      const org = STATE.allOrganisations.find(o => o.id === orgId);
      if (org) {
        org.logo_url = logoUrl; // Update in state
        await this.openCompanyProfile(orgId, org.company_name);
        await this.loadOrganisations(); // Refresh table
      }

    } catch (error) {
      console.error('Error fetching logo from website:', error);
      utils.showToast('Could not fetch logo from website. Try uploading manually.', 'warning');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Open upload company images modal
   * @param {string} orgId - Organisation ID
   */
  openUploadImagesModal(orgId) {
    this.currentOrgIdForImages = orgId;

    // Reset form
    document.getElementById('companyImagesUploadFile').value = '';
    document.getElementById('companyImagesTitle').value = '';
    document.getElementById('companyImagesCaption').value = '';

    const modal = new bootstrap.Modal(document.getElementById('uploadCompanyImagesModal'));
    modal.show();
  },

  /**
   * Upload company images for marketing
   */
  async uploadCompanyImages() {
    const fileInput = document.getElementById('companyImagesUploadFile');
    const title = document.getElementById('companyImagesTitle').value.trim();
    const caption = document.getElementById('companyImagesCaption').value.trim();
    const uploadBtn = document.getElementById('uploadCompanyImagesBtn');

    if (!fileInput.files || fileInput.files.length === 0) {
      utils.showToast('Please select at least one image', 'warning');
      return;
    }

    const files = Array.from(fileInput.files);

    // Validate file types (images only)
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const invalidFiles = files.filter(f => !validTypes.includes(f.type));

    if (invalidFiles.length > 0) {
      utils.showToast(`${invalidFiles.length} file(s) are not valid images and will be skipped`, 'warning');
    }

    const validFiles = files.filter(f => validTypes.includes(f.type));
    if (validFiles.length === 0) {
      utils.showToast('No valid images to upload', 'error');
      return;
    }

    try {
      uploadBtn.disabled = true;
      utils.showLoading();

      let successCount = 0;
      let errorCount = 0;

      for (const file of validFiles) {
        try {
          // Generate unique filename
          const timestamp = Date.now();
          const randomSuffix = Math.random().toString(36).substring(7);
          const fileName = `company-images/${this.currentOrgIdForImages}/${timestamp}_${randomSuffix}_${file.name}`;

          // Upload file to Supabase Storage
          const { data: uploadData, error: uploadError } = await STATE.client.storage
            .from('media-gallery')
            .upload(fileName, file);

          if (uploadError) throw uploadError;

          // Get public URL
          const { data: urlData } = STATE.client.storage
            .from('media-gallery')
            .getPublicUrl(fileName);

          // Insert record into organisation_images table
          const { error: dbError } = await STATE.client
            .from('organisation_images')
            .insert([{
              organisation_id: this.currentOrgIdForImages,
              file_url: urlData.publicUrl,
              title: title || file.name,
              caption: caption || null,
              display_order: successCount
            }]);

          if (dbError) throw dbError;

          successCount++;

        } catch (error) {
          console.error(`Error uploading ${file.name}:`, error);
          errorCount++;
        }
      }

      // Close modal
      bootstrap.Modal.getInstance(document.getElementById('uploadCompanyImagesModal')).hide();

      if (errorCount === 0) {
        utils.showToast(`${successCount} image(s) uploaded successfully!`, 'success');
      } else {
        utils.showToast(`${successCount} succeeded, ${errorCount} failed. Check console for details.`, 'warning');
      }

      // Reload the profile to show new images
      const org = STATE.allOrganisations.find(o => o.id === this.currentOrgIdForImages);
      if (org) {
        await this.openCompanyProfile(this.currentOrgIdForImages, org.company_name);
      }

    } catch (error) {
      console.error('Error uploading company images:', error);
      utils.showToast('Error uploading images: ' + error.message, 'error');
    } finally {
      uploadBtn.disabled = false;
      utils.hideLoading();
    }
  },

  /**
   * Delete company image
   * @param {string} imageId - Image ID
   * @param {string} orgId - Organisation ID
   */
  async deleteCompanyImage(imageId, orgId) {
    if (!confirm('Are you sure you want to delete this image? This action cannot be undone.')) {
      return;
    }

    try {
      utils.showLoading();

      // Get image details to delete from storage
      const { data: image, error: fetchError } = await STATE.client
        .from('organisation_images')
        .select('file_url')
        .eq('id', imageId)
        .single();

      if (fetchError) throw fetchError;

      // Delete from database
      const { error: deleteError } = await STATE.client
        .from('organisation_images')
        .delete()
        .eq('id', imageId);

      if (deleteError) throw deleteError;

      // Extract file path from URL and delete from storage
      if (image && image.file_url) {
        const urlParts = image.file_url.split('/storage/v1/object/public/media-gallery/');
        if (urlParts.length > 1) {
          const filePath = urlParts[1];
          await STATE.client.storage
            .from('media-gallery')
            .remove([filePath]);
        }
      }

      utils.showToast('Image deleted successfully!', 'success');

      // Reload the profile
      const org = STATE.allOrganisations.find(o => o.id === orgId);
      if (org) {
        await this.openCompanyProfile(orgId, org.company_name);
      }

    } catch (error) {
      console.error('Error deleting image:', error);
      utils.showToast('Error deleting image: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * View image in full screen
   * @param {string} imageUrl - Image URL
   * @param {string} title - Image title
   */
  viewImageFull(imageUrl, title) {
    const modal = new bootstrap.Modal(document.getElementById('viewImageFullModal'));
    document.getElementById('viewImageFullTitle').textContent = title;
    document.getElementById('viewImageFullContent').innerHTML = `
      <img src="${imageUrl}" alt="${utils.escapeHtml(title)}" class="img-fluid" style="max-height: 70vh;">
    `;
    modal.show();
  },

  /**
   * Enable edit mode for organisation profile
   * @param {string} orgId - Organisation ID
   */
  enableEditMode(orgId) {
    // Hide view elements and show edit elements
    document.querySelectorAll('.view-mode').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.edit-mode').forEach(el => el.style.display = 'block');

    // Toggle buttons
    document.getElementById('editOrgBtn').style.display = 'none';
    document.getElementById('saveOrgBtn').style.display = 'inline-block';
    document.getElementById('cancelEditOrgBtn').style.display = 'inline-block';
  },

  /**
   * Save organisation changes
   * @param {string} orgId - Organisation ID
   */
  async saveOrgChanges(orgId) {
    try {
      utils.showLoading();

      // Collect updated data from form fields
      const updatedData = {
        contact_name: document.getElementById('editContactName').value.trim(),
        email: document.getElementById('editEmail').value.trim(),
        contact_phone: document.getElementById('editPhone').value.trim(),
        website: document.getElementById('editWebsite').value.trim(),
        region: document.getElementById('editRegion').value,
        address: document.getElementById('editAddress').value.trim(),
        catchment_area: document.getElementById('editCatchmentArea').value.trim(),
        // Extended fields
        description: document.getElementById('editDescription')?.value.trim() || null,
        achievements: document.getElementById('editAchievements')?.value.trim() || null,
        company_size: document.getElementById('editCompanySize')?.value || null,
        employee_count: document.getElementById('editEmployeeCount')?.value ? parseInt(document.getElementById('editEmployeeCount').value) : null,
        year_founded: document.getElementById('editYearFounded')?.value ? parseInt(document.getElementById('editYearFounded').value) : null,
        annual_revenue: document.getElementById('editAnnualRevenue')?.value ? parseFloat(document.getElementById('editAnnualRevenue').value) : null,
        tier: document.getElementById('editTier')?.value || null,
        linkedin_url: document.getElementById('editLinkedin')?.value.trim() || null,
        twitter_url: document.getElementById('editTwitter')?.value.trim() || null,
        facebook_url: document.getElementById('editFacebook')?.value.trim() || null,
        instagram_url: document.getElementById('editInstagram')?.value.trim() || null
      };

      // Update in database
      const { error } = await STATE.client
        .from('organisations')
        .update(updatedData)
        .eq('id', orgId);

      if (error) throw error;

      // Update local state
      const orgIndex = STATE.allOrganisations.findIndex(o => o.id === orgId);
      if (orgIndex !== -1) {
        STATE.allOrganisations[orgIndex] = {
          ...STATE.allOrganisations[orgIndex],
          ...updatedData
        };
      }

      // Update filtered organisations
      const filteredIndex = STATE.filteredOrganisations.findIndex(o => o.id === orgId);
      if (filteredIndex !== -1) {
        STATE.filteredOrganisations[filteredIndex] = {
          ...STATE.filteredOrganisations[filteredIndex],
          ...updatedData
        };
      }

      // Update current editing org
      this.currentEditingOrg = { ...this.currentEditingOrg, ...updatedData };
      this.originalOrgData = { ...this.currentEditingOrg };

      utils.showToast('Organisation updated successfully', 'success');

      // Refresh the profile view
      await this.openCompanyProfile(orgId, this.currentEditingOrg.company_name);

      // Refresh the organisations table
      this.renderOrganisations();

    } catch (error) {
      console.error('Error saving organisation changes:', error);
      utils.showToast('Failed to save changes: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Cancel edit mode and revert to view mode
   * @param {string} orgId - Organisation ID
   * @param {string} companyName - Company name
   */
  async cancelEditMode(orgId, companyName) {
    // Reopen the profile in view mode (this will restore original data)
    await this.openCompanyProfile(orgId, companyName);
  },

  /**
   * Navigate to award from company profile
   * Closes the company profile modal and switches to the Awards tab
   * @param {string} awardId - Award ID
   * @param {string} awardName - Award name
   */
  navigateToAward(awardId, awardName) {
    // Close the company profile modal
    const modalElement = document.getElementById('companyProfileModal');
    const modal = bootstrap.Modal.getInstance(modalElement);
    if (modal) {
      modal.hide();
    }

    // Wait for modal to close, then switch to Awards tab and open assignments
    setTimeout(() => {
      // Switch to Awards tab
      const awardsTab = document.getElementById('awards-tab');
      if (awardsTab) {
        awardsTab.click();
      }

      // Wait a bit for tab to switch, then open assignments modal
      setTimeout(() => {
        if (typeof assignmentsModule !== 'undefined') {
          assignmentsModule.openAssignmentsModal(awardId, awardName);
        }
      }, 300);
    }, 300);
  },

  /**
   * View all invoices for an organisation
   * @param {string} orgId - Organisation ID
   * @param {string} companyName - Company name
   */
  async viewOrganisationInvoices(orgId, companyName) {
    try {
      utils.showLoading();

      // Load invoices with line items
      const { data: invoices, error } = await STATE.client
        .from('invoices')
        .select(`
          *,
          invoice_line_items (*)
        `)
        .eq('organisation_id', orgId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Create and show modal
      let modal = bootstrap.Modal.getInstance(document.getElementById('organisationInvoicesModal'));
      if (!modal) {
        modal = new bootstrap.Modal(document.getElementById('organisationInvoicesModal'));
      }

      const modalTitle = document.getElementById('organisationInvoicesModalTitle');
      const modalBody = document.getElementById('organisationInvoicesModalBody');

      modalTitle.innerHTML = `<i class="bi bi-receipt me-2"></i>Invoices for ${utils.escapeHtml(companyName)}`;

      if (!invoices || invoices.length === 0) {
        modalBody.innerHTML = `
          <div class="alert alert-info">
            <i class="bi bi-info-circle me-2"></i>No invoices found for this organisation.
          </div>
        `;
      } else {
        modalBody.innerHTML = `
          <div class="table-responsive">
            <table class="table table-hover">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Items</th>
                  <th class="text-end">Total</th>
                  <th class="text-end">Paid</th>
                  <th class="text-end">Balance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${invoices.map(invoice => `
                  <tr>
                    <td><strong>${utils.escapeHtml(invoice.invoice_number)}</strong></td>
                    <td>${invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString('en-GB') : 'N/A'}</td>
                    <td>
                      <span class="badge bg-info-subtle text-info">
                        ${this.formatInvoiceType(invoice.invoice_type)}
                      </span>
                      ${invoice.package_type && ['bronze', 'silver', 'gold'].includes(invoice.package_type) ?
                        `<br>${this.getPackageBadge(invoice.package_type)}` : ''
                      }
                    </td>
                    <td>
                      <small class="text-muted">
                        ${invoice.invoice_line_items && invoice.invoice_line_items.length > 0 ?
                          invoice.invoice_line_items.map(item =>
                            `${item.quantity}x ${utils.escapeHtml(item.item_name)}`
                          ).join('<br>') :
                          invoice.description || 'N/A'
                        }
                      </small>
                    </td>
                    <td class="text-end"><strong>£${parseFloat(invoice.total_amount || 0).toFixed(2)}</strong></td>
                    <td class="text-end text-success">£${parseFloat(invoice.paid_amount || 0).toFixed(2)}</td>
                    <td class="text-end ${parseFloat(invoice.balance_due || 0) > 0 ? 'text-danger' : 'text-muted'}">
                      £${parseFloat(invoice.balance_due || 0).toFixed(2)}
                    </td>
                    <td>${this.getInvoiceStatusBadge(invoice.status, invoice.payment_status)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }

      modal.show();

    } catch (error) {
      console.error('Error loading invoices:', error);
      utils.showToast('Error loading invoices: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Format invoice type for display
   */
  formatInvoiceType(type) {
    const types = {
      entry_fee: 'Entry Fee',
      package: 'Package',
      sponsorship: 'Sponsorship',
      tickets: 'Tickets',
      other: 'Other'
    };
    return types[type] || type;
  },

  /**
   * Get invoice status badge
   */
  getInvoiceStatusBadge(status, paymentStatus) {
    const badges = {
      draft: '<span class="badge bg-secondary">Draft</span>',
      sent: '<span class="badge bg-info">Sent</span>',
      viewed: '<span class="badge bg-primary">Viewed</span>',
      paid: '<span class="badge bg-success">Paid</span>',
      partially_paid: '<span class="badge bg-warning">Partially Paid</span>',
      overdue: '<span class="badge bg-danger">Overdue</span>',
      cancelled: '<span class="badge bg-dark">Cancelled</span>',
      refunded: '<span class="badge bg-secondary">Refunded</span>'
    };
    return badges[status] || badges[paymentStatus] || '<span class="badge bg-secondary">Unknown</span>';
  },

  /**
   * Get package badge HTML
   * @param {string} packageType - Package type (bronze/silver/gold/non-attendee)
   * @returns {string} HTML badge
   */
  getPackageBadge(packageType) {
    const packages = {
      'gold': '<span class="badge" style="background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%); color: #000;"><i class="bi bi-award-fill me-1"></i>Gold</span>',
      'silver': '<span class="badge" style="background: linear-gradient(135deg, #C0C0C0 0%, #808080 100%); color: #000;"><i class="bi bi-award-fill me-1"></i>Silver</span>',
      'bronze': '<span class="badge" style="background: linear-gradient(135deg, #CD7F32 0%, #8B4513 100%); color: #fff;"><i class="bi bi-award-fill me-1"></i>Bronze</span>',
      'non-attendee': '<span class="badge bg-secondary"><i class="bi bi-x-circle me-1"></i>Non-Attendee</span>'
    };
    return packages[packageType] || packages['bronze'];
  },

  // ============================================
  // STATUS BADGE
  // ============================================
  getStatusBadge(status) {
    const badges = {
      'prospect': '<span class="badge bg-secondary">Prospect</span>',
      'entrant': '<span class="badge bg-info">Entrant</span>',
      'nominee': '<span class="badge bg-primary">Nominee</span>',
      'shortlisted': '<span class="badge bg-warning text-dark">Shortlisted</span>',
      'winner': '<span class="badge bg-success">Winner</span>',
      'sponsor': '<span class="badge bg-danger">Sponsor</span>',
      'past_winner': '<span class="badge bg-dark">Past Winner</span>'
    };
    return badges[status] || badges['prospect'];
  },

  // ============================================
  // SAVE NEW COMPANY
  // ============================================
  async saveNewCompany() {
    const form = document.getElementById('addCompanyForm');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const companyName = document.getElementById('newCompanyName').value.trim();
    const email = document.getElementById('newCompanyEmail').value.trim();
    let website = document.getElementById('newCompanyWebsite').value.trim() || null;

    // Validate email format if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      utils.showToast('Please enter a valid email address', 'error');
      return;
    }

    // Auto-prefix website URL
    if (website && !website.startsWith('http://') && !website.startsWith('https://')) {
      website = 'https://' + website;
    }

    // Enhanced duplicate detection on entry (Quick Win)
    const fuzzyDupes = this.checkDuplicateOnEntry(companyName);
    if (fuzzyDupes && fuzzyDupes.length > 0) {
      const dupeList = fuzzyDupes.join(', ');
      if (!confirm(`Potential duplicates found:\n${dupeList}\n\nAdd "${companyName}" anyway?`)) {
        return;
      }
    }

    const selectedCounty = document.getElementById('newCompanyCounty')?.value || '';

    const companyData = {
      company_name: companyName,
      sector: document.getElementById('newCompanySector').value,
      contact_name: document.getElementById('newContactName').value.trim() || null,
      contact_phone: document.getElementById('newContactPhone').value.trim() || null,
      email: email || null,
      website: website,
      region: document.getElementById('newCompanyRegion').value,
      address: document.getElementById('newCompanyAddress').value.trim() || null,
      catchment_area: selectedCounty || document.getElementById('newCompanyCatchment').value.trim() || null,
      status: 'prospect'
    };

    try {
      utils.showLoading();

      const { error } = await STATE.client
        .from('organisations')
        .insert([companyData]);

      if (error) throw error;

      utils.showToast('Company added successfully!', 'success');
      bootstrap.Modal.getInstance(document.getElementById('addNewOrgModal')).hide();
      form.reset();
      await this.loadOrganisations();

    } catch (error) {
      console.error('Error saving new company:', error);
      utils.showToast('Error saving company: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  // ============================================
  // SELECT ALL / TOGGLE SELECTION
  // ============================================
  toggleSelectAll() {
    const checkbox = document.getElementById('selectAllOrgs');
    if (checkbox.checked) {
      STATE.filteredOrganisations.forEach(org => this.selectedOrgs.add(org.id));
    } else {
      this.selectedOrgs.clear();
    }
    this.renderOrganisations();
    this.updateBulkActionsBar();
  },

  toggleOrgSelection(orgId) {
    if (this.selectedOrgs.has(orgId)) {
      this.selectedOrgs.delete(orgId);
    } else {
      this.selectedOrgs.add(orgId);
    }
    // Update select all checkbox
    const selectAll = document.getElementById('selectAllOrgs');
    if (selectAll) {
      selectAll.checked = this.selectedOrgs.size === STATE.filteredOrganisations.length;
    }
    this.updateBulkActionsBar();
  },

  updateBulkActionsBar() {
    const bar = document.getElementById('bulkActionsBar');
    const countEl = document.getElementById('selectedCount');
    if (bar && countEl) {
      countEl.textContent = this.selectedOrgs.size;
      bar.style.display = this.selectedOrgs.size > 0 ? 'block' : 'none';
    }
  },

  clearSelection() {
    this.selectedOrgs.clear();
    const selectAll = document.getElementById('selectAllOrgs');
    if (selectAll) selectAll.checked = false;
    this.renderOrganisations();
    this.updateBulkActionsBar();
  },

  // ============================================
  // SORTING
  // ============================================
  sortBy(field) {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }

    const dir = this.sortDirection === 'asc' ? 1 : -1;

    STATE.filteredOrganisations.sort((a, b) => {
      let valA, valB;
      switch (field) {
        case 'company':
          valA = (a.company_name || '').toLowerCase();
          valB = (b.company_name || '').toLowerCase();
          break;
        case 'sector':
          valA = (a.sector || '').toLowerCase();
          valB = (b.sector || '').toLowerCase();
          break;
        case 'county':
          valA = (a.county || '').toLowerCase();
          valB = (b.county || '').toLowerCase();
          break;
        case 'contact':
          valA = (a.contact_name || '').toLowerCase();
          valB = (b.contact_name || '').toLowerCase();
          break;
        case 'email':
          valA = (a.email || '').toLowerCase();
          valB = (b.email || '').toLowerCase();
          break;
        case 'region':
          valA = (a.region || '').toLowerCase();
          valB = (b.region || '').toLowerCase();
          break;
        case 'status':
          valA = (a.status || 'prospect').toLowerCase();
          valB = (b.status || 'prospect').toLowerCase();
          break;
        case 'awards':
          valA = a.awards_count || 0;
          valB = b.awards_count || 0;
          break;
        case 'tier':
          const tierOrder = { 'Platinum': 4, 'Gold': 3, 'Silver': 2, 'Bronze': 1 };
          valA = tierOrder[a.tier] || 0;
          valB = tierOrder[b.tier] || 0;
          break;
        case 'phone':
          valA = (a.contact_phone || '').toLowerCase();
          valB = (b.contact_phone || '').toLowerCase();
          break;
        case 'updated':
          valA = new Date(a.updated_at || a.created_at || 0).getTime();
          valB = new Date(b.updated_at || b.created_at || 0).getTime();
          break;
        default:
          valA = (a.company_name || '').toLowerCase();
          valB = (b.company_name || '').toLowerCase();
      }
      if (valA < valB) return -1 * dir;
      if (valA > valB) return 1 * dir;
      return 0;
    });

    this.renderOrganisations();
  },

  /**
   * Update sort direction indicators in column headers
   */
  updateSortIndicators() {
    document.querySelectorAll('#organisations [data-sort-icon]').forEach(icon => {
      icon.className = 'bi bi-arrow-down-up text-muted ms-1 small';
    });
    if (this.sortField) {
      const activeIcon = document.querySelector(`#organisations [data-sort-icon="${this.sortField}"]`);
      if (activeIcon) {
        const iconClass = this.sortDirection === 'asc' ? 'bi-arrow-up' : 'bi-arrow-down';
        activeIcon.className = `bi ${iconClass} text-primary ms-1 small`;
      }
    }
  },

  /**
   * Populate sector suggestions datalist for add/edit forms
   */
  populateSectorSuggestions() {
    const datalist = document.getElementById('sectorSuggestions');
    if (!datalist) return;
    const existingSectors = [...new Set(STATE.allOrganisations.map(o => o.sector).filter(Boolean))];
    const allSectors = [...new Set([...SECTORS, ...existingSectors])].sort();
    datalist.innerHTML = allSectors.map(s => `<option value="${utils.escapeHtml(s)}">`).join('');
  },

  /**
   * Reset all filters to default
   */
  resetFilters() {
    document.getElementById('orgsSearchBox').value = '';
    document.getElementById('orgsYearFilter').value = '';
    document.getElementById('orgsSectorFilter').value = '';
    document.getElementById('orgsRegionFilter').value = '';
    document.getElementById('orgsCountyFilter').value = '';
    document.getElementById('orgsStatusFilter').value = '';
    const tierEl = document.getElementById('orgsTierFilter');
    if (tierEl) tierEl.value = '';
    const tagEl = document.getElementById('orgsTagFilter');
    if (tagEl) tagEl.value = '';
    const logoEl = document.getElementById('orgsLogoFilter');
    if (logoEl) logoEl.value = '';
    const dateEl = document.getElementById('orgsDateFilter');
    if (dateEl) dateEl.value = '';
    const presetEl = document.getElementById('orgsFilterPreset');
    if (presetEl) presetEl.value = '';
    this._filterMissingField = null;
    this.updateCountyFilterByRegion();
    try { localStorage.removeItem('orgsFilters'); } catch (e) { /* ignore */ }
    this.filterOrganisations();
  },

  // ============================================
  // EXPORT CSV
  // ============================================
  exportToCSV() {
    const data = STATE.filteredOrganisations;
    if (data.length === 0) {
      utils.showToast('No organisations to export', 'warning');
      return;
    }

    const csv = [
      'Company Name,Sector,County,Region,Contact Name,Email,Phone,Website,Status,Tier,Tags,Awards Count,Address,Catchment Area,Description,Engagement Score,Health Status,Last Contacted',
      ...data.map(org => {
        const engagement = this.calculateEngagementScore(org);
        const health = this.getOrgHealthIndicator(org);
        const lastContacted = this.getLastContacted(org.id);
        return [
          `"${(org.company_name || '').replace(/"/g, '""')}"`,
          `"${(org.sector || '').replace(/"/g, '""')}"`,
          `"${(org.county || '').replace(/"/g, '""')}"`,
          `"${(org.region || '').replace(/"/g, '""')}"`,
          `"${(org.contact_name || '').replace(/"/g, '""')}"`,
          `"${(org.email || '').replace(/"/g, '""')}"`,
          `"${(org.contact_phone || '').replace(/"/g, '""')}"`,
          `"${(org.website || '').replace(/"/g, '""')}"`,
          `"${(org.status || 'prospect').replace(/"/g, '""')}"`,
          `"${(org.tier || '').replace(/"/g, '""')}"`,
          `"${(org.tags || []).join('; ').replace(/"/g, '""')}"`,
          `"${org.awards_count || 0}"`,
          `"${(org.address || '').replace(/"/g, '""')}"`,
          `"${(org.catchment_area || '').replace(/"/g, '""')}"`,
          `"${(org.description || '').replace(/"/g, '""')}"`,
          `"${engagement}"`,
          `"${health.label}"`,
          `"${lastContacted ? new Date(lastContacted).toLocaleDateString('en-GB') : 'Never'}"`
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `organisations-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    utils.showToast(`Exported ${data.length} organisations`, 'success');
  },

  // ============================================
  // BULK EMAIL CAMPAIGN
  // ============================================
  bulkEmail() {
    if (this.selectedOrgs.size === 0) {
      utils.showToast('No organisations selected', 'warning');
      return;
    }

    const selectedData = STATE.allOrganisations.filter(org => this.selectedOrgs.has(org.id));
    const withEmail = selectedData.filter(o => o.email);
    const withoutEmail = selectedData.filter(o => !o.email);

    const templates = this._emailTemplates;

    const html = `
      <div class="row g-3">
        <div class="col-12">
          <div class="alert alert-info small py-2 mb-2">
            <i class="bi bi-people me-1"></i><strong>${withEmail.length}</strong> recipient(s) with email
            ${withoutEmail.length > 0 ? ` &middot; <span class="text-warning">${withoutEmail.length} without email (skipped)</span>` : ''}
          </div>
        </div>
        <div class="col-12">
          <label class="form-label small fw-semibold">Send Method</label>
          <div class="btn-group w-100" role="group">
            <input type="radio" class="btn-check" name="emailMethod" id="emailMethodBCC" value="bcc" checked>
            <label class="btn btn-outline-primary btn-sm" for="emailMethodBCC"><i class="bi bi-envelope me-1"></i>BCC (private)</label>
            <input type="radio" class="btn-check" name="emailMethod" id="emailMethodIndividual" value="individual">
            <label class="btn btn-outline-primary btn-sm" for="emailMethodIndividual"><i class="bi bi-person me-1"></i>Individual (personalised)</label>
          </div>
        </div>
        <div class="col-12">
          <label class="form-label small fw-semibold">Template</label>
          <select class="form-select form-select-sm" id="bulkEmailTemplate" onchange="orgsModule._populateBulkEmailFromTemplate()">
            <option value="">-- Custom email --</option>
            ${templates.map(t => `<option value="${t.id}">${utils.escapeHtml(t.name)}</option>`).join('')}
          </select>
        </div>
        <div class="col-12">
          <label class="form-label small fw-semibold">Subject</label>
          <input type="text" class="form-control form-control-sm" id="bulkEmailSubject" placeholder="Enter subject...">
        </div>
        <div class="col-12">
          <label class="form-label small fw-semibold">Body <small class="text-muted">(use {contact_name}, {company_name} for personalisation)</small></label>
          <textarea class="form-control form-control-sm" id="bulkEmailBody" rows="6" placeholder="Enter message..."></textarea>
        </div>
        <div class="col-12">
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-outline-info" onclick="orgsModule._previewBulkEmail()"><i class="bi bi-eye me-1"></i>Preview</button>
            <button class="btn btn-sm btn-primary ms-auto" onclick="orgsModule._sendBulkEmail()"><i class="bi bi-send me-1"></i>Send Campaign</button>
          </div>
        </div>
        <div class="col-12" id="bulkEmailPreview" style="display:none;"></div>
      </div>`;

    this._showDynamicModal(`Email Campaign (${withEmail.length} recipients)`, html, 'bi-megaphone', 'modal-lg');
  },

  _populateBulkEmailFromTemplate() {
    const templateId = document.getElementById('bulkEmailTemplate')?.value;
    if (!templateId) return;
    const template = this._emailTemplates.find(t => t.id === templateId);
    if (template) {
      document.getElementById('bulkEmailSubject').value = template.subject;
      document.getElementById('bulkEmailBody').value = template.body;
    }
  },

  _previewBulkEmail() {
    const subject = document.getElementById('bulkEmailSubject')?.value.trim();
    const body = document.getElementById('bulkEmailBody')?.value.trim();
    if (!subject || !body) { utils.showToast('Enter subject and body first', 'warning'); return; }

    const selectedData = STATE.allOrganisations.filter(org => this.selectedOrgs.has(org.id) && org.email);
    const sample = selectedData[0];
    if (!sample) return;

    const previewSubject = subject.replace(/{company_name}/g, sample.company_name || '').replace(/{contact_name}/g, sample.contact_name || 'Sir/Madam');
    const previewBody = body.replace(/{company_name}/g, sample.company_name || '').replace(/{contact_name}/g, sample.contact_name || 'Sir/Madam');

    const previewEl = document.getElementById('bulkEmailPreview');
    previewEl.style.display = 'block';
    previewEl.innerHTML = `
      <div class="card bg-light">
        <div class="card-header py-2 small fw-semibold"><i class="bi bi-eye me-1"></i>Preview (for ${utils.escapeHtml(sample.company_name || 'first recipient')})</div>
        <div class="card-body py-2">
          <div class="small"><strong>To:</strong> ${utils.escapeHtml(sample.email)}</div>
          <div class="small"><strong>Subject:</strong> ${utils.escapeHtml(previewSubject)}</div>
          <hr class="my-2">
          <div class="small" style="white-space:pre-wrap;">${utils.escapeHtml(previewBody)}</div>
        </div>
      </div>`;
  },

  async _sendBulkEmail() {
    const subject = document.getElementById('bulkEmailSubject')?.value.trim();
    const body = document.getElementById('bulkEmailBody')?.value.trim();
    const method = document.querySelector('input[name="emailMethod"]:checked')?.value || 'bcc';

    if (!subject || !body) { utils.showToast('Enter subject and body', 'warning'); return; }

    const selectedData = STATE.allOrganisations.filter(org => this.selectedOrgs.has(org.id) && org.email);
    if (selectedData.length === 0) { utils.showToast('No recipients with email addresses', 'warning'); return; }

    if (!confirm(`Send email to ${selectedData.length} organisation(s) via ${method === 'bcc' ? 'BCC' : 'individual emails'}?`)) return;

    if (method === 'bcc') {
      // BCC mode: single mailto with all addresses in BCC
      const emails = selectedData.map(o => o.email).join(',');
      const bccSubject = subject.replace(/{company_name}/g, '').replace(/{contact_name}/g, '');
      const bccBody = body.replace(/{company_name}/g, '').replace(/{contact_name}/g, '');
      window.open(`mailto:?bcc=${encodeURIComponent(emails)}&subject=${encodeURIComponent(bccSubject)}&body=${encodeURIComponent(bccBody)}`);
    } else {
      // Individual mode: open first mailto, log all
      const first = selectedData[0];
      const personalSubject = subject.replace(/{company_name}/g, first.company_name || '').replace(/{contact_name}/g, first.contact_name || 'Sir/Madam');
      const personalBody = body.replace(/{company_name}/g, first.company_name || '').replace(/{contact_name}/g, first.contact_name || 'Sir/Madam');
      window.open(`mailto:${encodeURIComponent(first.email)}?subject=${encodeURIComponent(personalSubject)}&body=${encodeURIComponent(personalBody)}`);
      if (selectedData.length > 1) {
        utils.showToast(`Opened email for ${first.company_name}. ${selectedData.length - 1} more will be logged.`, 'info');
      }
    }

    // Log all communications to Supabase
    try {
      const templateId = document.getElementById('bulkEmailTemplate')?.value || 'custom';
      const performedBy = await this._getCurrentUserEmail();
      const commsRecords = selectedData.map(org => ({
        organisation_id: org.id,
        template_id: templateId,
        template_name: `Campaign: ${subject.substring(0, 50)}`,
        subject,
        channel: 'email',
        direction: 'outbound'
      }));
      // Insert in batches of 50
      for (let i = 0; i < commsRecords.length; i += 50) {
        await STATE.client.from('organisation_comms_log').insert(commsRecords.slice(i, i + 50));
      }
      // Log audit
      this._logAudit(null, 'bulk_email', '', `Bulk email campaign to ${selectedData.length} orgs: ${subject}`);
    } catch (e) {
      console.warn('Failed to log bulk email:', e.message);
    }

    // Close modal
    bootstrap.Modal.getInstance(document.getElementById('dynamicOrgModal'))?.hide();
    utils.showToast(`Email campaign sent to ${selectedData.length} organisations`, 'success');
  },

  // ============================================
  // BULK EXPORT
  // ============================================
  bulkExport() {
    if (this.selectedOrgs.size === 0) {
      utils.showToast('No organisations selected', 'warning');
      return;
    }

    const originalFiltered = STATE.filteredOrganisations;
    STATE.filteredOrganisations = STATE.allOrganisations.filter(org => this.selectedOrgs.has(org.id));
    this.exportToCSV();
    STATE.filteredOrganisations = originalFiltered;
  },

  // ============================================
  // UPDATE COMPANY STATUS
  // ============================================
  // QUICK INLINE STATUS UPDATE
  // ============================================
  async quickUpdateStatus(orgId, newStatus) {
    try {
      const org = STATE.allOrganisations.find(o => o.id === orgId);
      const oldStatus = org?.status || 'prospect';

      const { error } = await STATE.client
        .from('organisations')
        .update({ status: newStatus })
        .eq('id', orgId);

      if (error) throw error;

      // Update local state
      if (org) org.status = newStatus;
      const filteredOrg = STATE.filteredOrganisations.find(o => o.id === orgId);
      if (filteredOrg) filteredOrg.status = newStatus;

      // Audit trail
      this._logAudit(orgId, 'status_change', org?.company_name || '', `Status: ${oldStatus} → ${newStatus}`);

      utils.showToast(`Status updated to ${newStatus.replace('_', ' ')}`, 'success');
    } catch (error) {
      console.error('Error updating status:', error);
      utils.showToast('Error updating status: ' + error.message, 'error');
    }
  },

  // ============================================
  // ARCHIVE ORGANISATION (Soft Delete)
  // ============================================
  async deleteOrganisation(orgId, companyName) {
    if (!confirm(`Archive "${companyName}"? This will hide it from the main list but keep all data intact. You can restore it later from the "Show Archived" filter.`)) {
      return;
    }

    try {
      utils.showLoading();

      const { error } = await STATE.client
        .from('organisations')
        .update({ status: 'archived' })
        .eq('id', orgId);

      if (error) throw error;

      // Log the action
      this._logAudit(orgId, 'archived', companyName, 'Organisation archived');

      utils.showToast(`"${companyName}" archived successfully`, 'success');

      // Update local state
      const org = STATE.allOrganisations.find(o => o.id === orgId);
      if (org) org.status = 'archived';

      this.selectedOrgs.delete(orgId);
      this.filterOrganisations();
      this.updateBulkActionsBar();

    } catch (error) {
      console.error('Error archiving organisation:', error);
      utils.showToast('Error archiving: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  async restoreOrganisation(orgId, companyName) {
    try {
      const { error } = await STATE.client
        .from('organisations')
        .update({ status: 'prospect' })
        .eq('id', orgId);

      if (error) throw error;

      this._logAudit(orgId, 'restored', companyName, 'Organisation restored from archive');

      const org = STATE.allOrganisations.find(o => o.id === orgId);
      if (org) org.status = 'prospect';

      utils.showToast(`"${companyName}" restored`, 'success');
      this.filterOrganisations();
    } catch (error) {
      console.error('Error restoring:', error);
      utils.showToast('Error restoring: ' + error.message, 'error');
    }
  },

  async permanentDelete(orgId, companyName) {
    if (!confirm(`PERMANENTLY delete "${companyName}" and all associated data? This CANNOT be undone.`)) return;
    if (!confirm(`Final confirmation: Delete "${companyName}" forever?`)) return;

    try {
      utils.showLoading();

      await STATE.client.from('award_assignments').delete().eq('organisation_id', orgId);
      const { error } = await STATE.client.from('organisations').delete().eq('id', orgId);
      if (error) throw error;

      STATE.allOrganisations = STATE.allOrganisations.filter(o => o.id !== orgId);
      STATE.filteredOrganisations = STATE.filteredOrganisations.filter(o => o.id !== orgId);
      this.selectedOrgs.delete(orgId);

      utils.showToast(`"${companyName}" permanently deleted`, 'success');
      this.renderOrganisations();
      this.updateBulkActionsBar();
    } catch (error) {
      console.error('Error deleting:', error);
      utils.showToast('Error: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  // ============================================
  // BULK ARCHIVE
  // ============================================
  async bulkDelete() {
    if (this.selectedOrgs.size === 0) {
      utils.showToast('No organisations selected', 'warning');
      return;
    }

    const count = this.selectedOrgs.size;
    if (!confirm(`Archive ${count} organisation(s)? They will be hidden from the main list but can be restored later.`)) {
      return;
    }

    try {
      utils.showLoading();
      const orgIds = Array.from(this.selectedOrgs);

      const { error } = await STATE.client
        .from('organisations')
        .update({ status: 'archived' })
        .in('id', orgIds);

      if (error) throw error;

      // Update local state
      orgIds.forEach(id => {
        const org = STATE.allOrganisations.find(o => o.id === id);
        if (org) org.status = 'archived';
      });
      this.selectedOrgs.clear();

      utils.showToast(`${count} organisation(s) archived`, 'success');
      this.filterOrganisations();
      this.updateBulkActionsBar();

    } catch (error) {
      console.error('Error bulk archiving:', error);
      utils.showToast('Error archiving: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  // ============================================
  // BULK STATUS CHANGE
  // ============================================
  async bulkStatusChange(newStatus) {
    if (this.selectedOrgs.size === 0) {
      utils.showToast('No organisations selected', 'warning');
      return;
    }

    const count = this.selectedOrgs.size;
    if (!confirm(`Change status of ${count} organisation(s) to "${newStatus.replace('_', ' ')}"?`)) return;

    try {
      utils.showLoading();
      const orgIds = Array.from(this.selectedOrgs);

      const { error } = await STATE.client
        .from('organisations')
        .update({ status: newStatus })
        .in('id', orgIds);

      if (error) throw error;

      orgIds.forEach(id => {
        const org = STATE.allOrganisations.find(o => o.id === id);
        if (org) org.status = newStatus;
        const fOrg = STATE.filteredOrganisations.find(o => o.id === id);
        if (fOrg) fOrg.status = newStatus;
      });

      utils.showToast(`${count} org(s) updated to ${newStatus.replace('_', ' ')}`, 'success');
      this.renderOrganisations();
    } catch (error) {
      console.error('Error bulk status change:', error);
      utils.showToast('Error: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  async updateOrgStatus(orgId, newStatus) {
    try {
      const { error } = await STATE.client
        .from('organisations')
        .update({ status: newStatus })
        .eq('id', orgId);

      if (error) throw error;

      // Update local state
      const org = STATE.allOrganisations.find(o => o.id === orgId);
      if (org) org.status = newStatus;

      const filteredOrg = STATE.filteredOrganisations.find(o => o.id === orgId);
      if (filteredOrg) filteredOrg.status = newStatus;

      utils.showToast(`Status updated to ${newStatus}`, 'success');

      // Refresh the profile
      if (org) {
        await this.openCompanyProfile(orgId, org.company_name);
      }
    } catch (error) {
      console.error('Error updating status:', error);
      utils.showToast('Error updating status: ' + error.message, 'error');
    }
  },

  // ============================================
  // STATUS WORKFLOW ENFORCEMENT
  // ============================================
  _statusFlow: {
    'prospect':    { next: ['entrant', 'sponsor'], label: 'Prospect' },
    'entrant':     { next: ['nominee', 'prospect'], label: 'Entrant' },
    'nominee':     { next: ['shortlisted', 'entrant'], label: 'Nominee' },
    'shortlisted': { next: ['winner', 'nominee'], label: 'Shortlisted' },
    'winner':      { next: ['past_winner'], label: 'Winner' },
    'past_winner': { next: ['entrant', 'prospect'], label: 'Past Winner' },
    'sponsor':     { next: ['prospect'], label: 'Sponsor' },
    'archived':    { next: ['prospect'], label: 'Archived' }
  },

  _getStatusOptions(currentStatus) {
    const flow = this._statusFlow[currentStatus];
    if (!flow) return [{ value: currentStatus, label: currentStatus }];

    // Show current + valid next statuses
    const options = [{ value: currentStatus, label: flow.label + ' (current)' }];
    (flow.next || []).forEach(s => {
      const f = this._statusFlow[s];
      if (f) options.push({ value: s, label: f.label });
    });
    return options;
  },

  // ============================================
  // AUDIT TRAIL (Supabase-backed)
  // ============================================
  async _logAudit(orgId, action, companyName, details) {
    try {
      const performedBy = await this._getCurrentUserEmail();
      await STATE.client
        .from('org_audit_log')
        .insert([{ org_id: orgId, company_name: companyName, action, details, performed_by: performedBy }]);
    } catch (e) {
      console.warn('Failed to write audit log to Supabase:', e.message);
    }
  },

  // Cache current user email to avoid repeated auth calls
  _cachedUserEmail: null,
  async _getCurrentUserEmail() {
    if (this._cachedUserEmail) return this._cachedUserEmail;
    try {
      const { data } = await STATE.client.auth.getUser();
      this._cachedUserEmail = data?.user?.email || 'admin';
    } catch (e) {
      this._cachedUserEmail = 'admin';
    }
    return this._cachedUserEmail;
  },

  async getAuditLog(orgId) {
    try {
      let query = STATE.client
        .from('org_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (orgId) query = query.eq('org_id', orgId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(e => ({ ...e, timestamp: e.created_at }));
    } catch (e) {
      console.warn('Failed to read audit log from Supabase:', e.message);
      return [];
    }
  },

  async renderAuditLog(orgId) {
    const log = await this.getAuditLog(orgId);
    if (log.length === 0) return '<p class="text-muted small">No activity recorded yet</p>';

    return `<div class="list-group list-group-flush" style="max-height: 300px; overflow-y: auto;">
      ${log.slice(0, 50).map(entry => {
        const date = new Date(entry.timestamp || entry.created_at);
        const timeAgo = this._timeAgo(date);
        const icons = {
          'status_change': 'bi-arrow-repeat text-primary',
          'archived': 'bi-archive text-warning',
          'restored': 'bi-arrow-counterclockwise text-success',
          'created': 'bi-plus-circle text-success',
          'email_sent': 'bi-envelope text-info',
          'note_added': 'bi-sticky text-secondary',
          'csv_import': 'bi-file-earmark-arrow-up text-primary'
        };
        const icon = icons[entry.action] || 'bi-clock-history text-muted';
        return `<div class="list-group-item px-0 py-2 border-0">
          <div class="d-flex align-items-start">
            <i class="bi ${icon} me-2 mt-1"></i>
            <div>
              <div class="small fw-semibold">${utils.escapeHtml(entry.details || entry.action)}</div>
              <div class="text-muted" style="font-size: 0.7rem;">${timeAgo} &middot; ${date.toLocaleDateString('en-GB')} ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  },

  _timeAgo(date) {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
    if (seconds < 604800) return Math.floor(seconds / 86400) + 'd ago';
    return date.toLocaleDateString('en-GB');
  },

  // ============================================
  // DUPLICATE DETECTION
  // ============================================
  _normaliseForMatch(str) {
    return (str || '').toLowerCase()
      .replace(/\b(ltd|limited|plc|inc|llp|llc|&|and|the|co|company)\b/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  },

  findDuplicates(companyName) {
    const normalised = this._normaliseForMatch(companyName);
    if (!normalised || normalised.length < 3) return [];

    return STATE.allOrganisations.filter(org => {
      const orgNorm = this._normaliseForMatch(org.company_name);
      if (!orgNorm) return false;

      // Exact normalised match
      if (orgNorm === normalised) return true;

      // One contains the other
      if (orgNorm.includes(normalised) || normalised.includes(orgNorm)) return true;

      // Levenshtein distance for short names
      if (normalised.length < 15 && orgNorm.length < 15) {
        return this._levenshtein(orgNorm, normalised) <= 2;
      }

      return false;
    });
  },

  _levenshtein(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = a[i-1] === b[j-1]
          ? dp[i-1][j-1]
          : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
      }
    }
    return dp[m][n];
  },

  showDuplicateCheck() {
    const dupeMap = new Map();

    STATE.allOrganisations.forEach(org => {
      const norm = this._normaliseForMatch(org.company_name);
      if (!norm) return;
      if (!dupeMap.has(norm)) dupeMap.set(norm, []);
      dupeMap.get(norm).push(org);
    });

    const duplicateGroups = Array.from(dupeMap.values()).filter(group => group.length > 1);

    if (duplicateGroups.length === 0) {
      utils.showToast('No duplicates found!', 'success');
      return;
    }

    let html = `<div class="alert alert-warning"><i class="bi bi-exclamation-triangle me-2"></i>Found ${duplicateGroups.length} potential duplicate group(s)</div>`;

    duplicateGroups.forEach((group, idx) => {
      html += `<div class="card mb-2"><div class="card-body py-2">
        <h6 class="mb-2">Group ${idx + 1}: "${utils.escapeHtml(group[0].company_name)}"</h6>
        <div class="table-responsive"><table class="table table-sm mb-0">
          <thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Awards</th><th>Action</th></tr></thead>
          <tbody>
          ${group.map(org => `<tr>
            <td class="small">${utils.escapeHtml(org.company_name)}</td>
            <td class="small">${utils.escapeHtml(org.email || '-')}</td>
            <td><span class="badge bg-secondary">${org.status || 'prospect'}</span></td>
            <td class="text-center">${org.awards_count || 0}</td>
            <td><button class="btn btn-sm btn-outline-danger" onclick="orgsModule.deleteOrganisation('${org.id}', '${utils.escapeHtml(org.company_name).replace(/'/g, "\\'")}')">Archive</button></td>
          </tr>`).join('')}
          </tbody>
        </table></div>
      </div></div>`;
    });

    this._showDynamicModal('Duplicate Detection', html, 'bi-files', 'modal-lg');
  },

  // ============================================
  // EMAIL TEMPLATES
  // ============================================
  _emailTemplates: [
    {
      id: 'shortlist_notify',
      name: 'Shortlist Notification',
      subject: 'Congratulations - You have been shortlisted!',
      body: `Dear {contact_name},\n\nWe are delighted to inform you that {company_name} has been shortlisted for the British Trade Awards.\n\nThe awards ceremony will take place shortly, and we will be in touch with further details.\n\nKind regards,\nBritish Trade Awards Team`
    },
    {
      id: 'winner_notify',
      name: 'Winner Announcement',
      subject: 'You are a Winner - British Trade Awards!',
      body: `Dear {contact_name},\n\nCongratulations! We are thrilled to announce that {company_name} has won at the British Trade Awards!\n\nPlease find attached your winner's pack with logos, press release template, and trophy collection details.\n\nKind regards,\nBritish Trade Awards Team`
    },
    {
      id: 'entry_invite',
      name: 'Entry Invitation',
      subject: 'British Trade Awards - Invitation to Enter',
      body: `Dear {contact_name},\n\nWe would like to invite {company_name} to enter the British Trade Awards this year.\n\nEntries are now open and close on [DATE]. You can enter online at [URL].\n\nKind regards,\nBritish Trade Awards Team`
    },
    {
      id: 'feedback_request',
      name: 'Feedback Request',
      subject: 'British Trade Awards - We value your feedback',
      body: `Dear {contact_name},\n\nThank you for participating in the British Trade Awards. We would love to hear your feedback to help us improve.\n\nPlease take a moment to complete our short survey: [SURVEY_URL]\n\nKind regards,\nBritish Trade Awards Team`
    },
    {
      id: 'sponsor_inquiry',
      name: 'Sponsorship Inquiry',
      subject: 'Sponsorship Opportunities - British Trade Awards',
      body: `Dear {contact_name},\n\nWe are reaching out to {company_name} regarding sponsorship opportunities for the upcoming British Trade Awards.\n\nWe have several packages available, including category sponsorship and headline sponsorship.\n\nWould you be available for a brief call to discuss?\n\nKind regards,\nBritish Trade Awards Team`
    }
  ],

  openEmailTemplate(orgId) {
    const org = STATE.allOrganisations.find(o => o.id === orgId) || {};
    const templates = this._emailTemplates;

    let html = `<div class="list-group">
      ${templates.map(t => {
        const subject = t.subject.replace(/{company_name}/g, org.company_name || '').replace(/{contact_name}/g, org.contact_name || 'Sir/Madam');
        const body = t.body.replace(/{company_name}/g, org.company_name || '').replace(/{contact_name}/g, org.contact_name || 'Sir/Madam');
        return `<a href="mailto:${org.email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}"
                   class="list-group-item list-group-item-action"
                   onclick="orgsModule._logComms('${orgId}', '${t.id}', '${utils.escapeHtml(org.company_name || '').replace(/'/g, "\\'")}')">
          <div class="d-flex justify-content-between align-items-center">
            <div>
              <h6 class="mb-1">${t.name}</h6>
              <small class="text-muted">${t.subject}</small>
            </div>
            <i class="bi bi-envelope text-primary"></i>
          </div>
        </a>`;
      }).join('')}
    </div>`;

    this._showDynamicModal(`Email ${utils.escapeHtml(org.company_name || '')}`, html, 'bi-envelope');
  },

  // ============================================
  // COMMUNICATION HISTORY (Supabase-backed)
  // ============================================
  async _logComms(orgId, templateId, companyName) {
    try {
      const template = this._emailTemplates.find(t => t.id === templateId);
      await STATE.client
        .from('organisation_comms_log')
        .insert([{
          organisation_id: orgId,
          template_id: templateId,
          template_name: template?.name || templateId
        }]);

      this._logAudit(orgId, 'email_sent', companyName, `Email sent: ${template?.name || templateId}`);
    } catch (e) {
      console.warn('Failed to write comms log to Supabase:', e.message);
    }
  },

  async getCommsHistory(orgId) {
    try {
      let query = STATE.client
        .from('organisation_comms_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (orgId) query = query.eq('organisation_id', orgId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(e => ({ ...e, timestamp: e.created_at, templateName: e.template_name }));
    } catch (e) {
      console.warn('Failed to read comms history from Supabase:', e.message);
      return [];
    }
  },

  async renderCommsHistory(orgId) {
    const history = await this.getCommsHistory(orgId);
    if (history.length === 0) return '<p class="text-muted small">No communications recorded yet</p>';

    return `<div class="list-group list-group-flush" style="max-height: 250px; overflow-y: auto;">
      ${history.map(entry => {
        const date = new Date(entry.timestamp);
        return `<div class="list-group-item px-0 py-2 border-0">
          <div class="d-flex align-items-center">
            <i class="bi bi-envelope-check text-success me-2"></i>
            <div>
              <div class="small fw-semibold">${utils.escapeHtml(entry.templateName)}</div>
              <div class="text-muted" style="font-size: 0.7rem;">${date.toLocaleDateString('en-GB')} ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  },

  // ============================================
  // TAG MANAGEMENT
  // ============================================
  async addTag(orgId) {
    const input = document.getElementById('newTagInput');
    const tag = (input?.value || '').trim();
    if (!tag) return;

    try {
      const org = STATE.allOrganisations.find(o => o.id === orgId);
      const currentTags = org?.tags || [];

      if (currentTags.includes(tag)) {
        utils.showToast('Tag already exists', 'warning');
        return;
      }

      const newTags = [...currentTags, tag];
      const { error } = await STATE.client
        .from('organisations')
        .update({ tags: newTags })
        .eq('id', orgId);

      if (error) throw error;

      if (org) org.tags = newTags;
      input.value = '';
      utils.showToast(`Tag "${tag}" added`, 'success');
      await this.openCompanyProfile(orgId, org.company_name);
    } catch (error) {
      console.error('Error adding tag:', error);
      utils.showToast('Error adding tag: ' + error.message, 'error');
    }
  },

  async removeTag(orgId, tag) {
    try {
      const org = STATE.allOrganisations.find(o => o.id === orgId);
      const newTags = (org?.tags || []).filter(t => t !== tag);

      const { error } = await STATE.client
        .from('organisations')
        .update({ tags: newTags })
        .eq('id', orgId);

      if (error) throw error;

      if (org) org.tags = newTags;
      utils.showToast(`Tag "${tag}" removed`, 'success');
      await this.openCompanyProfile(orgId, org.company_name);
    } catch (error) {
      console.error('Error removing tag:', error);
      utils.showToast('Error removing tag: ' + error.message, 'error');
    }
  },

  // ============================================
  // INLINE QUICK-EDIT (table cells)
  // ============================================
  startInlineEdit(orgId, field, currentValue, element) {
    // Prevent opening multiple editors at once
    if (document.querySelector('.inline-edit-active')) return;

    const td = element.closest('td');
    const originalHtml = td.innerHTML;
    td.classList.add('inline-edit-active');

    const inputType = field === 'email' ? 'email' : 'text';
    const escaped = utils.escapeHtml(currentValue || '');
    const listAttr = field === 'sector' ? ' list="sectorSuggestions"' : '';

    td.innerHTML = `
      <div class="input-group input-group-sm">
        <input type="${inputType}" class="form-control form-control-sm" id="inlineEdit_${field}"
               value="${escaped}" autofocus${listAttr} autocomplete="off"
               onkeydown="if(event.key==='Enter')orgsModule.saveInlineEdit('${orgId}','${field}');if(event.key==='Escape')orgsModule.cancelInlineEdit(this,'${orgId}');"
               style="font-size: 0.8rem;">
        <button class="btn btn-success btn-sm" onclick="orgsModule.saveInlineEdit('${orgId}','${field}')"><i class="bi bi-check"></i></button>
        <button class="btn btn-outline-secondary btn-sm" onclick="orgsModule.cancelInlineEdit(this,'${orgId}')"><i class="bi bi-x"></i></button>
      </div>
    `;

    // Store original HTML for cancel
    td.dataset.originalHtml = originalHtml;
    td.querySelector('input').focus();
  },

  // Last inline edit for undo support
  _lastInlineEdit: null,

  async saveInlineEdit(orgId, field) {
    const input = document.getElementById(`inlineEdit_${field}`);
    if (!input) return;

    const newValue = input.value.trim();

    // Map display field to DB field
    const fieldMap = { 'contact': 'contact_name', 'email': 'email', 'sector': 'sector' };
    const dbField = fieldMap[field] || field;

    // Capture old value for undo
    const org = STATE.allOrganisations.find(o => o.id === orgId);
    const oldValue = org ? (org[dbField] || '') : '';

    try {
      const { error } = await STATE.client
        .from('organisations')
        .update({ [dbField]: newValue || null })
        .eq('id', orgId);

      if (error) throw error;

      // Update local state
      if (org) org[dbField] = newValue || null;
      const fOrg = STATE.filteredOrganisations.find(o => o.id === orgId);
      if (fOrg) fOrg[dbField] = newValue || null;

      // Store for undo
      this._lastInlineEdit = { orgId, dbField, oldValue, newValue };

      // Log the diff to audit trail
      this._logAuditWithDiff(orgId, 'field_changed', org?.company_name || '', dbField, oldValue, newValue);

      this.renderOrganisations();
      this._showUndoToast(field);
    } catch (error) {
      console.error('Error saving inline edit:', error);
      utils.showToast('Error: ' + error.message, 'error');
    }
  },

  _showUndoToast(field) {
    // Remove existing undo toast
    document.getElementById('undoToast')?.remove();
    const toastHtml = `<div id="undoToast" class="toast show position-fixed bottom-0 end-0 m-3" style="z-index:9999;" role="alert">
      <div class="toast-body d-flex align-items-center gap-2 bg-dark text-white rounded shadow">
        <i class="bi bi-pencil-square"></i>
        <span class="small">${utils.escapeHtml(field)} updated</span>
        <button class="btn btn-sm btn-warning ms-2 py-0 px-2" onclick="orgsModule.undoLastInlineEdit()"><i class="bi bi-arrow-counterclockwise me-1"></i>Undo</button>
        <button type="button" class="btn-close btn-close-white ms-1" onclick="this.closest('.toast').remove()"></button>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', toastHtml);
    // Auto-dismiss after 8 seconds
    setTimeout(() => document.getElementById('undoToast')?.remove(), 8000);
  },

  async undoLastInlineEdit() {
    const edit = this._lastInlineEdit;
    if (!edit) { utils.showToast('Nothing to undo', 'warning'); return; }

    try {
      const { error } = await STATE.client
        .from('organisations')
        .update({ [edit.dbField]: edit.oldValue || null })
        .eq('id', edit.orgId);

      if (error) throw error;

      const org = STATE.allOrganisations.find(o => o.id === edit.orgId);
      if (org) org[edit.dbField] = edit.oldValue || null;
      const fOrg = STATE.filteredOrganisations.find(o => o.id === edit.orgId);
      if (fOrg) fOrg[edit.dbField] = edit.oldValue || null;

      this._lastInlineEdit = null;
      document.getElementById('undoToast')?.remove();
      this.renderOrganisations();
      utils.showToast('Edit undone', 'success');
    } catch (e) {
      utils.showToast('Undo failed: ' + e.message, 'error');
    }
  },

  cancelInlineEdit(element, orgId) {
    const td = element.closest('td');
    if (td) {
      td.classList.remove('inline-edit-active');
      // Re-render to restore original state
      this.renderOrganisations();
    }
  },

  // ============================================
  // BULK FIELD UPDATES
  // ============================================
  async bulkUpdateField(field, value) {
    if (this.selectedOrgs.size === 0) {
      utils.showToast('No organisations selected', 'warning');
      return;
    }

    const count = this.selectedOrgs.size;
    const displayValue = value || '(empty)';
    if (!confirm(`Set ${field} to "${displayValue}" for ${count} organisation(s)?`)) return;

    try {
      utils.showLoading();
      const orgIds = Array.from(this.selectedOrgs);

      const { error } = await STATE.client
        .from('organisations')
        .update({ [field]: value || null })
        .in('id', orgIds);

      if (error) throw error;

      orgIds.forEach(id => {
        const org = STATE.allOrganisations.find(o => o.id === id);
        if (org) org[field] = value || null;
        const fOrg = STATE.filteredOrganisations.find(o => o.id === id);
        if (fOrg) fOrg[field] = value || null;
      });

      utils.showToast(`${count} org(s) updated: ${field} = ${displayValue}`, 'success');
      this.renderOrganisations();
    } catch (error) {
      console.error('Error bulk updating field:', error);
      utils.showToast('Error: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  showBulkFieldModal(field) {
    let options = '';
    if (field === 'sector') {
      // Combine global SECTORS with any existing custom sectors
      const existingSectors = [...new Set(STATE.allOrganisations.map(o => o.sector).filter(Boolean))];
      const allSectors = [...new Set([...SECTORS, ...existingSectors])].sort();
      options = allSectors.map(s => `<option value="${s}">${utils.escapeHtml(s)}</option>`).join('');
    } else if (field === 'region') {
      options = REGIONS.map(r => `<option value="${r}">${utils.escapeHtml(r)}</option>`).join('');
    } else if (field === 'tier') {
      options = ['Bronze','Silver','Gold','Platinum'].map(t => `<option value="${t}">${t}</option>`).join('');
    }

    const modalHtml = `
      <div class="modal fade" id="bulkFieldModal" tabindex="-1">
        <div class="modal-dialog modal-sm">
          <div class="modal-content">
            <div class="modal-header">
              <h6 class="modal-title">Bulk Set ${field.charAt(0).toUpperCase() + field.slice(1)}</h6>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <p class="small text-muted mb-2">Apply to <strong>${this.selectedOrgs.size}</strong> selected organisations</p>
              <select class="form-select" id="bulkFieldValue">
                <option value="">-- Select --</option>
                ${options}
              </select>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Cancel</button>
              <button class="btn btn-primary btn-sm" onclick="
                const val = document.getElementById('bulkFieldValue').value;
                if (!val) { utils.showToast('Please select a value', 'warning'); return; }
                bootstrap.Modal.getInstance(document.getElementById('bulkFieldModal')).hide();
                orgsModule.bulkUpdateField('${field}', val);
              ">Apply</button>
            </div>
          </div>
        </div>
      </div>`;

    document.getElementById('bulkFieldModal')?.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    new bootstrap.Modal(document.getElementById('bulkFieldModal')).show();
  },

  // ============================================
  // BULK AUTO-FETCH LOGOS
  // ============================================
  async bulkFetchLogos() {
    const selected = Array.from(this.selectedOrgs);
    const orgs = STATE.allOrganisations.filter(o => selected.includes(o.id) && o.website && !o.logo_url);

    if (orgs.length === 0) {
      utils.showToast('No selected organisations with websites and missing logos', 'warning');
      return;
    }

    if (!confirm(`Fetch logos for ${orgs.length} organisations with websites but no logo?`)) return;

    utils.showLoading(`Fetching logos: 0/${orgs.length}`);
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < orgs.length; i++) {
      const org = orgs[i];
      try {
        let cleanUrl = org.website.trim();
        if (!cleanUrl.startsWith('http')) cleanUrl = 'https://' + cleanUrl;
        const domain = new URL(cleanUrl).hostname.replace(/^www\./, '');

        const logoServices = [
          `https://logo.clearbit.com/${domain}`,
          `https://www.google.com/s2/favicons?sz=128&domain=${domain}`,
          `https://icons.duckduckgo.com/ip3/${domain}.ico`
        ];

        let logoUrl = null;
        for (const serviceUrl of logoServices) {
          try {
            const response = await fetch(serviceUrl, { method: 'HEAD' });
            if (response.ok) { logoUrl = serviceUrl; break; }
          } catch (e) { continue; }
        }

        if (logoUrl) {
          await STATE.client
            .from('organisations')
            .update({ logo_url: logoUrl })
            .eq('id', org.id);
          org.logo_url = logoUrl;
          successCount++;
        } else {
          failCount++;
        }
      } catch (e) {
        failCount++;
      }

      utils.showLoading(`Fetching logos: ${i + 1}/${orgs.length}`);
      // Small delay between orgs to avoid rate limiting from logo services
      if (i < orgs.length - 1) await new Promise(r => setTimeout(r, 300));
    }

    utils.hideLoading();
    utils.showToast(`Logos fetched: ${successCount} success, ${failCount} failed`, successCount > 0 ? 'success' : 'warning');
    this.renderOrganisations();
  },

  // ============================================
  // CSV IMPORT
  // ============================================
  _csvData: null,
  _csvHeaders: null,
  _csvColumnMap: {},

  // Known DB column mappings from common CSV header names
  _columnAliases: {
    'company_name': 'company_name', 'company name': 'company_name', 'companyname': 'company_name',
    'name': 'company_name', 'business name': 'company_name', 'organisation': 'company_name',
    'sector': 'sector', 'industry': 'sector', 'category': 'sector',
    'county': 'county', 'county/city': 'county', 'location': 'county', 'city': 'county',
    'region': 'region', 'area': 'region',
    'contact_name': 'contact_name', 'contact name': 'contact_name', 'contact': 'contact_name',
    'email': 'email', 'email address': 'email', 'e-mail': 'email',
    'phone': 'contact_phone', 'contact_phone': 'contact_phone', 'telephone': 'contact_phone', 'tel': 'contact_phone',
    'website': 'website', 'url': 'website', 'web': 'website', 'site': 'website',
    'address': 'address', 'postal address': 'address',
    'catchment_area': 'catchment_area', 'catchment area': 'catchment_area', 'catchment': 'catchment_area',
    // Contact-specific fields for multi-contact import
    'first name': 'contact_first_name', 'first_name': 'contact_first_name', 'firstname': 'contact_first_name',
    'last name': 'contact_last_name', 'last_name': 'contact_last_name', 'lastname': 'contact_last_name', 'surname': 'contact_last_name',
    'job title': 'contact_job_title', 'job_title': 'contact_job_title', 'title': 'contact_job_title', 'role': 'contact_job_title', 'position': 'contact_job_title',
    'mobile': 'contact_mobile', 'mobile phone': 'contact_mobile', 'mobile_phone': 'contact_mobile', 'cell': 'contact_mobile'
  },

  _dbFields: ['company_name', 'sector', 'region', 'contact_name', 'email', 'contact_phone', 'website', 'address', 'catchment_area'],
  _contactFields: ['contact_first_name', 'contact_last_name', 'contact_job_title', 'contact_mobile'],

  _getSelectedCounty() {
    const val = document.getElementById('csvCountySelect')?.value || '';
    if (!val) {
      utils.showToast('Please select a County/City first', 'error');
      document.getElementById('csvCountySelect')?.focus();
      return null;
    }
    return val;
  },

  parseCSVFile(input) {
    const file = input.files[0];
    if (!file) return;

    if (!this._getSelectedCounty()) {
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      this._processCSVText(text);
    };
    reader.readAsText(file);
  },

  parseCSVText() {
    if (!this._getSelectedCounty()) return;

    const text = document.getElementById('csvPasteArea').value.trim();
    if (!text) {
      utils.showToast('Please paste CSV data first', 'warning');
      return;
    }
    this._processCSVText(text);
  },

  _processCSVText(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) {
      utils.showToast('CSV must have at least a header row and one data row', 'error');
      return;
    }

    // Parse header
    this._csvHeaders = this._parseCSVLine(lines[0]);

    // Parse data rows
    this._csvData = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this._parseCSVLine(lines[i]);
      if (values.some(v => v.trim())) {
        this._csvData.push(values);
      }
    }

    if (this._csvData.length === 0) {
      utils.showToast('No data rows found in CSV', 'error');
      return;
    }

    // Auto-map columns
    this._csvColumnMap = {};
    this._csvHeaders.forEach((header, idx) => {
      const normalised = header.toLowerCase().trim();
      if (this._columnAliases[normalised]) {
        this._csvColumnMap[idx] = this._columnAliases[normalised];
      }
    });

    // Show step 2: column mapping
    this._showColumnMapping();
  },

  _parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          result.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
    }
    result.push(current.trim());
    return result;
  },

  _showColumnMapping() {
    document.getElementById('csvStep1').style.display = 'none';
    document.getElementById('csvStep2').style.display = 'block';

    const selectedCounty = this._getSelectedCounty();

    const container = document.getElementById('csvColumnMapping');
    container.innerHTML = `
      <div class="col-12 mb-2">
        <div class="alert alert-success py-2 mb-2">
          <i class="bi bi-geo-alt-fill me-1"></i>
          Importing for: <strong>${utils.escapeHtml(selectedCounty)}</strong>
          <small class="text-muted ms-2">(all imported orgs will be tagged to this county)</small>
        </div>
      </div>
    ` + this._csvHeaders.map((header, idx) => {
      const mapped = this._csvColumnMap[idx] || '';
      return `
        <div class="col-md-4 mb-2">
          <label class="form-label small fw-semibold mb-1">
            CSV: "${utils.escapeHtml(header)}"
            <span class="text-muted">(sample: ${utils.escapeHtml(this._csvData[0]?.[idx] || '')})</span>
          </label>
          <select class="form-select form-select-sm" onchange="orgsModule._updateColumnMap(${idx}, this.value)">
            <option value="">-- Skip --</option>
            <optgroup label="Organisation Fields">
              ${this._dbFields.map(f => `<option value="${f}" ${mapped === f ? 'selected' : ''}>${f.replace(/_/g, ' ')}</option>`).join('')}
            </optgroup>
            <optgroup label="Contact Fields">
              ${this._contactFields.map(f => `<option value="${f}" ${mapped === f ? 'selected' : ''}>${f.replace(/^contact_/, '').replace(/_/g, ' ')}</option>`).join('')}
            </optgroup>
          </select>
        </div>
      `;
    }).join('');

    // Add apply mapping button
    container.innerHTML += `
      <div class="col-12 mt-2">
        <button class="btn btn-primary" onclick="orgsModule._applyMapping()">
          <i class="bi bi-eye me-1"></i>Preview Import
        </button>
      </div>
    `;
  },

  _updateColumnMap(idx, value) {
    if (value) {
      this._csvColumnMap[idx] = value;
    } else {
      delete this._csvColumnMap[idx];
    }
  },

  _applyMapping() {
    // Check company_name is mapped
    const hasCompanyName = Object.values(this._csvColumnMap).includes('company_name');
    if (!hasCompanyName) {
      utils.showToast('You must map at least the "Company Name" column', 'error');
      return;
    }

    // Build preview
    const existingNames = new Set(
      STATE.allOrganisations.map(o => (o.company_name || '').toLowerCase())
    );

    let newCount = 0;
    let dupCount = 0;

    const previewRows = this._csvData.map(row => {
      const record = {};
      Object.entries(this._csvColumnMap).forEach(([idx, field]) => {
        record[field] = row[parseInt(idx)] || '';
      });

      const isDuplicate = existingNames.has((record.company_name || '').toLowerCase());
      if (isDuplicate) dupCount++; else newCount++;

      return { record, isDuplicate };
    });

    // Show step 3
    document.getElementById('csvStep2').style.display = 'none';
    document.getElementById('csvStep3').style.display = 'block';

    const mappedFields = [...new Set(Object.values(this._csvColumnMap))];

    document.getElementById('csvPreviewCount').textContent = previewRows.length;
    document.getElementById('csvNewCount').textContent = `${newCount} new`;
    document.getElementById('csvDuplicateCount').textContent = `${dupCount} duplicates`;

    document.getElementById('csvPreviewHeader').innerHTML =
      '<th>#</th>' +
      mappedFields.map(f => `<th>${f.replace(/_/g, ' ')}</th>`).join('') +
      '<th>Status</th>';

    document.getElementById('csvPreviewBody').innerHTML = previewRows.map((item, i) => {
      const issues = this._validateImportRow(item.record);
      return `<tr class="${item.isDuplicate ? 'table-warning' : ''} ${issues.length > 0 ? 'table-danger' : ''}">
        <td class="small">${i + 1}</td>
        ${mappedFields.map(f => `<td class="small">${utils.escapeHtml(item.record[f] || '-')}</td>`).join('')}
        <td>
          ${item.isDuplicate
            ? '<span class="badge bg-warning text-dark">Duplicate</span>'
            : '<span class="badge bg-success">New</span>'
          }
          ${issues.length > 0 ? `<span class="badge bg-danger ms-1" title="${utils.escapeHtml(issues.join(', '))}">Issues: ${issues.length}</span>` : ''}
        </td>
      </tr>`;
    }).join('');

    // Enable import button
    const importBtn = document.getElementById('csvImportBtn');
    importBtn.disabled = false;
    document.getElementById('csvImportBtnCount').textContent = newCount > 0 ? `${newCount}` : `${previewRows.length}`;

    // Store preview for import
    this._csvPreviewRows = previewRows;
  },

  async executeCSVImport() {
    if (!this._csvPreviewRows || this._csvPreviewRows.length === 0) {
      utils.showToast('No data to import', 'warning');
      return;
    }

    // Only import non-duplicates by default, or ask
    const newRows = this._csvPreviewRows.filter(r => !r.isDuplicate);
    const dupRows = this._csvPreviewRows.filter(r => r.isDuplicate);

    let rowsToImport = newRows;
    let mergeRows = [];

    if (this._importMergeMode && dupRows.length > 0) {
      // Merge mode: update existing records with new data
      mergeRows = dupRows;
      rowsToImport = newRows;
      if (!confirm(`Merge mode: ${dupRows.length} existing record(s) will be updated, ${newRows.length} new record(s) will be inserted. Continue?`)) return;
    } else if (dupRows.length > 0 && newRows.length > 0) {
      if (confirm(`${dupRows.length} duplicate(s) found. Import only the ${newRows.length} new companies? (Cancel to import ALL including duplicates)`)) {
        rowsToImport = newRows;
      } else {
        rowsToImport = this._csvPreviewRows;
      }
    } else if (newRows.length === 0) {
      if (!confirm(`All ${dupRows.length} companies already exist. Import them anyway as duplicates?`)) {
        return;
      }
      rowsToImport = this._csvPreviewRows;
    }

    try {
      utils.showLoading();
      const importBtn = document.getElementById('csvImportBtn');
      importBtn.disabled = true;
      importBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Importing...';

      const selectedCounty = this._getSelectedCounty();
      if (!selectedCounty) return;

      // Build records - tag each org with the selected county
      const records = rowsToImport.map(item => {
        const rec = { status: 'prospect', catchment_area: selectedCounty };
        this._dbFields.forEach(field => {
          if (item.record[field]) {
            let val = item.record[field].trim();
            // Auto-prefix website
            if (field === 'website' && val && !val.startsWith('http://') && !val.startsWith('https://')) {
              val = 'https://' + val;
            }
            rec[field] = val || null;
          }
        });
        // Don't overwrite catchment_area if CSV had one mapped
        if (!rec.catchment_area) rec.catchment_area = selectedCounty;
        return rec;
      });

      // Insert in batches of 50
      let successCount = 0;
      let errorCount = 0;
      const batchSize = 50;

      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        const { error } = await STATE.client
          .from('organisations')
          .insert(batch);

        if (error) {
          console.error('Batch import error:', error);
          errorCount += batch.length;
        } else {
          successCount += batch.length;
        }
      }

      // Handle merge mode: update existing records
      let mergeCount = 0;
      if (mergeRows.length > 0) {
        for (const item of mergeRows) {
          try {
            const existingOrg = STATE.allOrganisations.find(o =>
              (o.company_name || '').toLowerCase() === (item.record.company_name || '').toLowerCase()
            );
            if (existingOrg) {
              const updateData = {};
              this._dbFields.forEach(field => {
                if (item.record[field] && item.record[field].trim()) {
                  updateData[field] = item.record[field].trim();
                }
              });
              if (Object.keys(updateData).length > 0) {
                const { error } = await STATE.client.from('organisations').update(updateData).eq('id', existingOrg.id);
                if (!error) mergeCount++;
              }
            }
          } catch (e) { console.error('Merge error:', e); }
        }
      }

      // Import contacts from contact-specific CSV columns
      const hasContactFields = Object.values(this._csvColumnMap).some(f => this._contactFields.includes(f));
      let contactCount = 0;
      if (hasContactFields) {
        // Reload orgs to get the new IDs
        const { data: freshOrgs } = await STATE.client.from('organisations').select('id, company_name');
        const orgNameMap = {};
        (freshOrgs || []).forEach(o => { orgNameMap[(o.company_name || '').toLowerCase()] = o.id; });

        const contactRecords = [];
        for (const item of rowsToImport) {
          const companyName = (item.record.company_name || '').toLowerCase();
          const orgId = orgNameMap[companyName];
          if (!orgId) continue;

          const firstName = item.record.contact_first_name?.trim();
          const lastName = item.record.contact_last_name?.trim();
          const jobTitle = item.record.contact_job_title?.trim();
          const mobile = item.record.contact_mobile?.trim();

          if (firstName || lastName) {
            contactRecords.push({
              organisation_id: orgId,
              first_name: firstName || null,
              last_name: lastName || null,
              job_title: jobTitle || null,
              email: item.record.email?.trim() || null,
              phone: item.record.contact_phone?.trim() || null,
              mobile: mobile || null,
              is_primary: true,
              receive_emails: true
            });
          }
        }

        if (contactRecords.length > 0) {
          for (let i = 0; i < contactRecords.length; i += 50) {
            try {
              await STATE.client.from('organisation_contacts').insert(contactRecords.slice(i, i + 50));
              contactCount += contactRecords.slice(i, i + 50).length;
            } catch (e) { console.warn('Contact import batch error:', e.message); }
          }
        }
      }

      // Track imported counties in localStorage for dashboard
      try {
        const imported = JSON.parse(localStorage.getItem('csvImportedCounties') || '{}');
        imported[selectedCounty] = {
          count: (imported[selectedCounty]?.count || 0) + successCount,
          lastImport: new Date().toISOString()
        };
        localStorage.setItem('csvImportedCounties', JSON.stringify(imported));
      } catch (e) { /* ignore */ }

      // Log import history
      const fileInput = document.getElementById('csvFileInput');
      const filename = fileInput?.files?.[0]?.name || 'pasted-data.csv';
      this._logImportHistory(filename, successCount, selectedCounty);

      // Close modal
      bootstrap.Modal.getInstance(document.getElementById('csvImportModal')).hide();

      if (errorCount === 0) {
        const contactMsg = contactCount > 0 ? ` + ${contactCount} contacts` : '';
        utils.showToast(`Successfully imported ${successCount} organisations${contactMsg} for ${selectedCounty}!`, 'success');
      } else {
        utils.showToast(`${successCount} imported, ${errorCount} failed. Check console for details.`, 'warning');
      }

      // Reset and reload
      this.resetCSVImport();
      await this.loadOrganisations();

      // Update dashboard county coverage
      if (typeof dashboardModule !== 'undefined' && dashboardModule.updateCountyCoverage) {
        dashboardModule.updateCountyCoverage();
      }

    } catch (error) {
      console.error('CSV import error:', error);
      utils.showToast('Import failed: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
      const importBtn = document.getElementById('csvImportBtn');
      if (importBtn) {
        importBtn.disabled = false;
        importBtn.innerHTML = '<i class="bi bi-cloud-upload me-1"></i>Import Organisations';
      }
    }
  },

  resetCSVImport() {
    this._csvData = null;
    this._csvHeaders = null;
    this._csvColumnMap = {};
    this._csvPreviewRows = null;

    document.getElementById('csvStep1').style.display = 'block';
    document.getElementById('csvStep2').style.display = 'none';
    document.getElementById('csvStep3').style.display = 'none';
    document.getElementById('csvFileInput').value = '';
    document.getElementById('csvPasteArea').value = '';
    document.getElementById('csvImportBtn').disabled = true;
  },

  // ============================================
  // SAVED FILTER PRESETS
  // ============================================
  _populateFilterPresets() {
    const presetSelect = document.getElementById('orgsFilterPreset');
    if (!presetSelect) return;
    try {
      const presets = JSON.parse(localStorage.getItem('orgsFilterPresets') || '{}');
      presetSelect.innerHTML = '<option value="">-- Saved Presets --</option>' +
        Object.keys(presets).map(name => `<option value="${utils.escapeHtml(name)}">${utils.escapeHtml(name)}</option>`).join('');
    } catch (e) { /* ignore */ }
  },

  saveFilterPreset() {
    const name = prompt('Name this filter preset:');
    if (!name || !name.trim()) return;
    try {
      const presets = JSON.parse(localStorage.getItem('orgsFilterPresets') || '{}');
      presets[name.trim()] = {
        year: document.getElementById('orgsYearFilter')?.value || '',
        sector: document.getElementById('orgsSectorFilter')?.value || '',
        region: document.getElementById('orgsRegionFilter')?.value || '',
        county: document.getElementById('orgsCountyFilter')?.value || '',
        status: document.getElementById('orgsStatusFilter')?.value || '',
        search: document.getElementById('orgsSearchBox')?.value || '',
        tier: document.getElementById('orgsTierFilter')?.value || '',
        tag: document.getElementById('orgsTagFilter')?.value || '',
        logoFilter: document.getElementById('orgsLogoFilter')?.value || '',
        dateFilter: document.getElementById('orgsDateFilter')?.value || ''
      };
      localStorage.setItem('orgsFilterPresets', JSON.stringify(presets));
      this._populateFilterPresets();
      document.getElementById('orgsFilterPreset').value = name.trim();
      utils.showToast(`Preset "${name.trim()}" saved`, 'success');
    } catch (e) { utils.showToast('Error saving preset', 'error'); }
  },

  loadFilterPreset(name) {
    if (!name) return;
    try {
      const presets = JSON.parse(localStorage.getItem('orgsFilterPresets') || '{}');
      const preset = presets[name];
      if (!preset) return;
      document.getElementById('orgsYearFilter').value = preset.year || '';
      document.getElementById('orgsSectorFilter').value = preset.sector || '';
      document.getElementById('orgsRegionFilter').value = preset.region || '';
      if (preset.region) this.updateCountyFilterByRegion();
      document.getElementById('orgsCountyFilter').value = preset.county || '';
      document.getElementById('orgsStatusFilter').value = preset.status || '';
      document.getElementById('orgsSearchBox').value = preset.search || '';
      const tierEl = document.getElementById('orgsTierFilter');
      if (tierEl) tierEl.value = preset.tier || '';
      const tagEl = document.getElementById('orgsTagFilter');
      if (tagEl) tagEl.value = preset.tag || '';
      const logoEl = document.getElementById('orgsLogoFilter');
      if (logoEl) logoEl.value = preset.logoFilter || '';
      const dateEl = document.getElementById('orgsDateFilter');
      if (dateEl) dateEl.value = preset.dateFilter || '';
      this.filterOrganisations();
      utils.showToast(`Preset "${name}" loaded`, 'success');
    } catch (e) { /* ignore */ }
  },

  deleteFilterPreset() {
    const presetSelect = document.getElementById('orgsFilterPreset');
    const name = presetSelect?.value;
    if (!name) { utils.showToast('Select a preset to delete', 'warning'); return; }
    if (!confirm(`Delete preset "${name}"?`)) return;
    try {
      const presets = JSON.parse(localStorage.getItem('orgsFilterPresets') || '{}');
      delete presets[name];
      localStorage.setItem('orgsFilterPresets', JSON.stringify(presets));
      this._populateFilterPresets();
      utils.showToast(`Preset "${name}" deleted`, 'success');
    } catch (e) { /* ignore */ }
  },

  // ============================================
  // AREA 1: CONVERSION % RATES FOR PIPELINE
  // ============================================
  _calculateConversionRates(statusCounts) {
    const pipeline = ['prospect', 'entrant', 'nominee', 'shortlisted', 'winner'];
    const rates = {};
    for (let i = 0; i < pipeline.length - 1; i++) {
      const from = pipeline[i];
      const to = pipeline[i + 1];
      const fromCount = statusCounts[from] || 0;
      const toCount = statusCounts[to] || 0;
      rates[`${from}_to_${to}`] = fromCount > 0 ? Math.round((toCount / fromCount) * 100) : 0;
    }
    return rates;
  },

  // ============================================
  // AREA 3: PHONE COLUMN TOGGLE
  // ============================================
  _showPhoneColumn: false,

  togglePhoneColumn() {
    this._showPhoneColumn = !this._showPhoneColumn;
    const btn = document.getElementById('togglePhoneColBtn');
    if (btn) btn.classList.toggle('active', this._showPhoneColumn);
    this.renderOrganisations();
  },

  // ============================================
  // AREA 4: ORGANISATION CONTACTS (Multi-contact)
  // ============================================
  async loadOrgContacts(orgId) {
    try {
      const { data, error } = await STATE.client
        .from('organisation_contacts')
        .select('*')
        .eq('organisation_id', orgId)
        .order('is_primary', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (e) {
      console.error('Error loading contacts:', e);
      return [];
    }
  },

  renderContactsSection(orgId, contacts) {
    if (!contacts || contacts.length === 0) {
      return `<div class="alert alert-info small">
        <i class="bi bi-info-circle me-2"></i>No additional contacts. Use the form below to add contacts.
      </div>`;
    }
    return `<div class="table-responsive">
      <table class="table table-sm table-hover mb-0">
        <thead><tr>
          <th>Name</th><th>Job Title</th><th>Email</th><th>Phone</th><th>Primary</th><th>Emails</th><th>Actions</th>
        </tr></thead>
        <tbody>
          ${contacts.map(c => `<tr>
            <td class="small">${utils.escapeHtml((c.first_name || '') + ' ' + (c.last_name || ''))}</td>
            <td class="small">${utils.escapeHtml(c.job_title || '-')}</td>
            <td class="small">${c.email ? `<a href="mailto:${c.email}">${utils.escapeHtml(c.email)}</a>` : '-'}</td>
            <td class="small">${utils.escapeHtml(c.phone || c.mobile || '-')}</td>
            <td class="text-center">${c.is_primary ? '<i class="bi bi-star-fill text-warning"></i>' : '<i class="bi bi-star text-muted" style="cursor:pointer" onclick="orgsModule.setPrimaryContact(\''+orgId+'\',\''+c.id+'\')"></i>'}</td>
            <td class="text-center">${c.receive_emails ? '<i class="bi bi-check-circle text-success"></i>' : '<i class="bi bi-x-circle text-muted" style="cursor:pointer" onclick="orgsModule.toggleContactEmails(\''+orgId+'\',\''+c.id+'\',true)"></i>'}</td>
            <td><button class="btn btn-sm btn-outline-danger" onclick="orgsModule.deleteContact('${orgId}','${c.id}')"><i class="bi bi-trash"></i></button></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  },

  async addContact(orgId) {
    const firstName = document.getElementById('newContactFirstName')?.value.trim();
    const lastName = document.getElementById('newContactLastName')?.value.trim();
    const jobTitle = document.getElementById('newContactJobTitle')?.value.trim();
    const email = document.getElementById('newContactEmailAddr')?.value.trim();
    const phone = document.getElementById('newContactPhoneNum')?.value.trim();
    const isPrimary = document.getElementById('newContactIsPrimary')?.checked || false;
    const receiveEmails = document.getElementById('newContactReceiveEmails')?.checked ?? true;

    if (!firstName && !lastName) { utils.showToast('Please enter a name', 'warning'); return; }

    try {
      if (isPrimary) {
        await STATE.client.from('organisation_contacts').update({ is_primary: false }).eq('organisation_id', orgId);
      }
      const { error } = await STATE.client.from('organisation_contacts').insert([{
        organisation_id: orgId, first_name: firstName || null, last_name: lastName || null,
        job_title: jobTitle || null, email: email || null, phone: phone || null,
        is_primary: isPrimary, receive_emails: receiveEmails
      }]);
      if (error) throw error;
      utils.showToast('Contact added', 'success');
      const org = STATE.allOrganisations.find(o => o.id === orgId);
      if (org) await this.openCompanyProfile(orgId, org.company_name);
    } catch (e) {
      console.error('Error adding contact:', e);
      utils.showToast('Error: ' + e.message, 'error');
    }
  },

  async deleteContact(orgId, contactId) {
    if (!confirm('Delete this contact?')) return;
    try {
      const { error } = await STATE.client.from('organisation_contacts').delete().eq('id', contactId);
      if (error) throw error;
      utils.showToast('Contact deleted', 'success');
      const org = STATE.allOrganisations.find(o => o.id === orgId);
      if (org) await this.openCompanyProfile(orgId, org.company_name);
    } catch (e) {
      utils.showToast('Error: ' + e.message, 'error');
    }
  },

  async setPrimaryContact(orgId, contactId) {
    try {
      await STATE.client.from('organisation_contacts').update({ is_primary: false }).eq('organisation_id', orgId);
      await STATE.client.from('organisation_contacts').update({ is_primary: true }).eq('id', contactId);
      utils.showToast('Primary contact updated', 'success');
      const org = STATE.allOrganisations.find(o => o.id === orgId);
      if (org) await this.openCompanyProfile(orgId, org.company_name);
    } catch (e) {
      utils.showToast('Error: ' + e.message, 'error');
    }
  },

  async toggleContactEmails(orgId, contactId, value) {
    try {
      await STATE.client.from('organisation_contacts').update({ receive_emails: value }).eq('id', contactId);
      utils.showToast(value ? 'Will receive emails' : 'Opted out of emails', 'success');
      const org = STATE.allOrganisations.find(o => o.id === orgId);
      if (org) await this.openCompanyProfile(orgId, org.company_name);
    } catch (e) {
      utils.showToast('Error: ' + e.message, 'error');
    }
  },

  // ============================================
  // AREA 5: CUSTOM FIELDS (Database-backed)
  // ============================================
  async getCustomFields(orgId) {
    try {
      const { data, error } = await STATE.client
        .from('organisation_custom_fields')
        .select('*')
        .eq('organisation_id', orgId)
        .order('field_name');
      if (error) throw error;
      const result = {};
      (data || []).forEach(f => { result[f.field_name] = f.field_value; });
      return result;
    } catch (e) {
      console.warn('Failed to read custom fields from Supabase:', e.message);
      return {};
    }
  },

  async saveCustomField(orgId, fieldName, fieldValue) {
    try {
      if (fieldValue) {
        await STATE.client.from('organisation_custom_fields').upsert({
          organisation_id: orgId, field_name: fieldName, field_value: fieldValue, updated_at: new Date().toISOString()
        }, { onConflict: 'organisation_id,field_name' });
      } else {
        await STATE.client.from('organisation_custom_fields').delete()
          .eq('organisation_id', orgId).eq('field_name', fieldName);
      }
      utils.showToast('Custom field saved', 'success');
    } catch (e) {
      utils.showToast('Error saving custom field: ' + e.message, 'error');
    }
  },

  async addCustomField(orgId) {
    const name = document.getElementById('customFieldName')?.value.trim();
    const value = document.getElementById('customFieldValue')?.value.trim();
    if (!name) { utils.showToast('Enter a field name', 'warning'); return; }
    await this.saveCustomField(orgId, name, value);
    const org = STATE.allOrganisations.find(o => o.id === orgId);
    if (org) this.openCompanyProfile(orgId, org.company_name);
  },

  async removeCustomField(orgId, fieldName) {
    await this.saveCustomField(orgId, fieldName, null);
    const org = STATE.allOrganisations.find(o => o.id === orgId);
    if (org) this.openCompanyProfile(orgId, org.company_name);
  },

  // ============================================
  // AREA 5: DOCUMENT ATTACHMENTS
  // ============================================
  async uploadDocument(orgId) {
    const fileInput = document.getElementById('docUploadInput');
    const docTitle = document.getElementById('docTitle')?.value.trim() || '';
    if (!fileInput?.files?.[0]) { utils.showToast('Select a file', 'warning'); return; }

    const file = fileInput.files[0];
    try {
      utils.showLoading('Uploading document...');
      const timestamp = Date.now();
      const fileName = `documents/${orgId}/${timestamp}_${file.name}`;
      const { error: uploadError } = await STATE.client.storage.from('media-gallery').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = STATE.client.storage.from('media-gallery').getPublicUrl(fileName);

      // Store in organisation_documents or fallback to localStorage
      try {
        const { error } = await STATE.client.from('organisation_documents').insert([{
          organisation_id: orgId, file_url: urlData.publicUrl, title: docTitle || file.name,
          file_type: file.type, file_size: file.size
        }]);
        if (error) throw error;
      } catch (dbErr) {
        console.warn('Failed to save document to Supabase:', dbErr.message);
      }

      utils.showToast('Document uploaded', 'success');
      const org = STATE.allOrganisations.find(o => o.id === orgId);
      if (org) await this.openCompanyProfile(orgId, org.company_name);
    } catch (e) {
      utils.showToast('Error: ' + e.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  async getDocuments(orgId) {
    try {
      const { data, error } = await STATE.client.from('organisation_documents').select('*').eq('organisation_id', orgId).order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (e) {
      console.warn('Failed to read documents from Supabase:', e.message);
      return [];
    }
  },

  // ============================================
  // AREA 6: SCHEDULED FOLLOW-UPS (Database-backed)
  // ============================================
  async getFollowUps(orgId) {
    try {
      let query = STATE.client.from('organisation_follow_ups').select('*')
        .order('follow_up_date', { ascending: true });
      if (orgId) query = query.eq('organisation_id', orgId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(f => ({
        id: f.id, orgId: f.organisation_id, companyName: f.company_name,
        date: f.follow_up_date, note: f.note, done: f.completed, created: f.created_at
      }));
    } catch (e) {
      console.warn('Failed to read follow-ups from Supabase:', e.message);
      return [];
    }
  },

  async addFollowUp(orgId) {
    const date = document.getElementById('followUpDate')?.value;
    const note = document.getElementById('followUpNote')?.value.trim();
    if (!date) { utils.showToast('Select a date', 'warning'); return; }

    const org = STATE.allOrganisations.find(o => o.id === orgId);
    try {
      const { error } = await STATE.client.from('organisation_follow_ups').insert([{
        organisation_id: orgId, company_name: org?.company_name || '',
        follow_up_date: date, note: note || null
      }]);
      if (error) throw error;
      utils.showToast('Follow-up scheduled', 'success');
      if (org) this.openCompanyProfile(orgId, org.company_name);
    } catch (e) { utils.showToast('Error: ' + e.message, 'error'); }
  },

  async completeFollowUp(orgId, followUpId) {
    try {
      const { error } = await STATE.client.from('organisation_follow_ups')
        .update({ completed: true, completed_at: new Date().toISOString() })
        .eq('id', followUpId);
      if (error) throw error;
      utils.showToast('Follow-up completed', 'success');
      const org = STATE.allOrganisations.find(o => o.id === orgId);
      if (org) this.openCompanyProfile(orgId, org.company_name);
    } catch (e) { utils.showToast('Error: ' + e.message, 'error'); }
  },

  async deleteFollowUp(orgId, followUpId) {
    try {
      const { error } = await STATE.client.from('organisation_follow_ups')
        .delete().eq('id', followUpId);
      if (error) throw error;
      utils.showToast('Follow-up deleted', 'success');
      const org = STATE.allOrganisations.find(o => o.id === orgId);
      if (org) this.openCompanyProfile(orgId, org.company_name);
    } catch (e) { utils.showToast('Error: ' + e.message, 'error'); }
  },

  // ============================================
  // AREA 6: SMS/WHATSAPP TEMPLATES
  // ============================================
  _smsTemplates: [
    { id: 'sms_shortlist', name: 'Shortlist SMS', body: 'Hi {contact_name}, great news! {company_name} has been shortlisted for the British Trade Awards. Check your email for details.' },
    { id: 'sms_winner', name: 'Winner SMS', body: 'Congratulations {contact_name}! {company_name} has won at the British Trade Awards! Details in your inbox.' },
    { id: 'sms_reminder', name: 'Entry Reminder', body: 'Hi {contact_name}, just a reminder that entries for British Trade Awards close soon. Don\'t miss out!' }
  ],

  _whatsappTemplates: [
    { id: 'wa_shortlist', name: 'Shortlist WhatsApp', body: 'Hi {contact_name}! Exciting news - {company_name} has been shortlisted for the British Trade Awards! Check your email for all the details.' },
    { id: 'wa_winner', name: 'Winner WhatsApp', body: 'Congratulations {contact_name}! We\'re thrilled to let you know that {company_name} has won at the British Trade Awards! Full details coming to your inbox.' },
    { id: 'wa_invite', name: 'Invitation WhatsApp', body: 'Hi {contact_name}, we\'d love to invite {company_name} to enter the British Trade Awards this year. Interested? Reply for more info!' }
  ],

  openSMSTemplate(orgId) {
    const org = STATE.allOrganisations.find(o => o.id === orgId) || {};
    const phone = org.contact_phone || '';
    const cleanPhone = phone.replace(/[^0-9+]/g, '');

    let html = `<div class="mb-3"><strong>Phone:</strong> ${utils.escapeHtml(phone || 'No phone number')}</div>
    <h6 class="fw-semibold mb-2">SMS Templates</h6>
    <div class="list-group mb-3">
      ${this._smsTemplates.map(t => {
        const body = t.body.replace(/{company_name}/g, org.company_name || '').replace(/{contact_name}/g, org.contact_name || '');
        return `<a href="sms:${cleanPhone}?body=${encodeURIComponent(body)}" class="list-group-item list-group-item-action">
          <div class="d-flex justify-content-between"><div><h6 class="mb-1">${t.name}</h6><small class="text-muted">${utils.escapeHtml(body.substring(0, 80))}...</small></div><i class="bi bi-chat-dots text-success"></i></div>
        </a>`;
      }).join('')}
    </div>
    <h6 class="fw-semibold mb-2">WhatsApp Templates</h6>
    <div class="list-group">
      ${this._whatsappTemplates.map(t => {
        const body = t.body.replace(/{company_name}/g, org.company_name || '').replace(/{contact_name}/g, org.contact_name || '');
        return `<a href="https://wa.me/${cleanPhone.replace('+', '')}?text=${encodeURIComponent(body)}" target="_blank" class="list-group-item list-group-item-action">
          <div class="d-flex justify-content-between"><div><h6 class="mb-1">${t.name}</h6><small class="text-muted">${utils.escapeHtml(body.substring(0, 80))}...</small></div><i class="bi bi-whatsapp text-success"></i></div>
        </a>`;
      }).join('')}
    </div>`;

    this._showDynamicModal('SMS / WhatsApp', html, 'bi-phone');
  },

  // ============================================
  // AREA 7: GLOBAL AUDIT LOG WITH FILTERS & DIFF
  // ============================================
  async showGlobalAuditLog() {
    utils.showLoading();
    try {
      const log = await this.getAuditLog(null);
      let html = `<div class="row g-2 mb-3">
        <div class="col-md-3"><select class="form-select form-select-sm" id="auditActionFilter" onchange="orgsModule._filterAuditLog()">
          <option value="">All Actions</option>
          <option value="status_change">Status Change</option><option value="archived">Archived</option>
          <option value="restored">Restored</option><option value="created">Created</option>
          <option value="email_sent">Email Sent</option><option value="note_added">Note Added</option>
          <option value="csv_import">CSV Import</option>
        </select></div>
        <div class="col-md-3"><input type="date" class="form-control form-control-sm" id="auditDateFrom" onchange="orgsModule._filterAuditLog()" placeholder="From"></div>
        <div class="col-md-3"><input type="date" class="form-control form-control-sm" id="auditDateTo" onchange="orgsModule._filterAuditLog()" placeholder="To"></div>
        <div class="col-md-3"><input type="text" class="form-control form-control-sm" id="auditSearchFilter" oninput="orgsModule._filterAuditLog()" placeholder="Search..."></div>
      </div>
      <div id="auditLogContent" style="max-height: 500px; overflow-y: auto;">
        ${this._renderAuditEntries(log)}
      </div>`;

      this._showDynamicModal('Global Audit Log', html, 'bi-journal-text', 'modal-xl');
      this._cachedAuditLog = log;
    } catch (e) {
      utils.showToast('Error loading audit log', 'error');
    } finally { utils.hideLoading(); }
  },

  _cachedAuditLog: [],

  _filterAuditLog() {
    const action = document.getElementById('auditActionFilter')?.value || '';
    const dateFrom = document.getElementById('auditDateFrom')?.value || '';
    const dateTo = document.getElementById('auditDateTo')?.value || '';
    const search = (document.getElementById('auditSearchFilter')?.value || '').toLowerCase();

    let filtered = this._cachedAuditLog;
    if (action) filtered = filtered.filter(e => e.action === action);
    if (dateFrom) filtered = filtered.filter(e => (e.timestamp || e.created_at) >= dateFrom);
    if (dateTo) filtered = filtered.filter(e => (e.timestamp || e.created_at) <= dateTo + 'T23:59:59');
    if (search) filtered = filtered.filter(e =>
      (e.company_name || '').toLowerCase().includes(search) ||
      (e.details || '').toLowerCase().includes(search)
    );

    const container = document.getElementById('auditLogContent');
    if (container) container.innerHTML = this._renderAuditEntries(filtered);
  },

  _renderAuditEntries(entries) {
    if (!entries || entries.length === 0) return '<p class="text-muted text-center">No audit entries found</p>';
    const icons = {
      'status_change': 'bi-arrow-repeat text-primary',
      'archived': 'bi-archive text-warning',
      'restored': 'bi-arrow-counterclockwise text-success',
      'created': 'bi-plus-circle text-success',
      'email_sent': 'bi-envelope text-info',
      'note_added': 'bi-sticky text-secondary',
      'csv_import': 'bi-file-earmark-arrow-up text-primary'
    };
    return `<table class="table table-sm table-hover"><thead><tr><th>Time</th><th>User</th><th>Company</th><th>Action</th><th>Details</th></tr></thead><tbody>
      ${entries.map(e => {
        const date = new Date(e.timestamp || e.created_at);
        const icon = icons[e.action] || 'bi-clock-history text-muted';
        // Diff view: parse "Status: X → Y" from details
        let detailsHtml = utils.escapeHtml(e.details || e.action);
        const diffMatch = (e.details || '').match(/(.+?):\s*(.+?)\s*→\s*(.+)/);
        if (diffMatch) {
          detailsHtml = `${utils.escapeHtml(diffMatch[1])}: <span class="text-danger text-decoration-line-through">${utils.escapeHtml(diffMatch[2])}</span> → <span class="text-success fw-semibold">${utils.escapeHtml(diffMatch[3])}</span>`;
        }
        const user = e.performed_by || '';
        return `<tr>
          <td class="small text-muted text-nowrap">${date.toLocaleDateString('en-GB')} ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</td>
          <td class="small text-muted">${user ? `<i class="bi bi-person me-1"></i>${utils.escapeHtml(user)}` : ''}</td>
          <td class="small fw-semibold">${utils.escapeHtml(e.company_name || e.companyName || '-')}</td>
          <td><span class="badge bg-light text-dark"><i class="bi ${icon} me-1"></i>${utils.escapeHtml(e.action)}</span></td>
          <td class="small">${detailsHtml}</td>
        </tr>`;
      }).join('')}
    </tbody></table>`;
  },

  // Enhanced audit logging with old/new values for diff view
  async _logAuditWithDiff(orgId, action, companyName, field, oldValue, newValue) {
    const details = `${field}: ${oldValue || '(empty)'} → ${newValue || '(empty)'}`;
    await this._logAudit(orgId, action, companyName, details);
  },

  // ============================================
  // AREA 8: BULK TAG ASSIGNMENT
  // ============================================
  showBulkTagModal() {
    if (this.selectedOrgs.size === 0) { utils.showToast('No organisations selected', 'warning'); return; }
    const allTags = new Set();
    STATE.allOrganisations.forEach(o => { if (o.tags) o.tags.forEach(t => allTags.add(t)); });

    const html = `<p class="small text-muted">Apply to <strong>${this.selectedOrgs.size}</strong> selected organisations</p>
      <div class="mb-3">
        <label class="form-label fw-semibold">Add Tag</label>
        <div class="input-group">
          <input type="text" class="form-control" id="bulkTagInput" list="bulkTagSuggestions" placeholder="Enter tag name...">
          <datalist id="bulkTagSuggestions">${[...allTags].sort().map(t => `<option value="${utils.escapeHtml(t)}">`).join('')}</datalist>
          <button class="btn btn-primary" onclick="orgsModule.executeBulkTagAdd()"><i class="bi bi-plus me-1"></i>Add</button>
        </div>
      </div>
      <div class="mb-3">
        <label class="form-label fw-semibold">Remove Tag</label>
        <select class="form-select" id="bulkTagRemoveSelect">
          <option value="">-- Select tag to remove --</option>
          ${[...allTags].sort().map(t => `<option value="${utils.escapeHtml(t)}">${utils.escapeHtml(t)}</option>`).join('')}
        </select>
        <button class="btn btn-outline-danger btn-sm mt-2" onclick="orgsModule.executeBulkTagRemove()"><i class="bi bi-trash me-1"></i>Remove from Selected</button>
      </div>`;

    this._showDynamicModal('Bulk Tag Assignment', html, 'bi-tags');
  },

  async executeBulkTagAdd() {
    const tag = document.getElementById('bulkTagInput')?.value.trim();
    if (!tag) { utils.showToast('Enter a tag', 'warning'); return; }

    try {
      utils.showLoading();
      const orgIds = Array.from(this.selectedOrgs);
      // Build updates for orgs that need the tag
      const updates = [];
      for (const id of orgIds) {
        const org = STATE.allOrganisations.find(o => o.id === id);
        const currentTags = org?.tags || [];
        if (!currentTags.includes(tag)) {
          const newTags = [...currentTags, tag];
          updates.push({ id, org, newTags });
        }
      }
      // Execute in parallel batches of 5
      for (let i = 0; i < updates.length; i += 5) {
        const batch = updates.slice(i, i + 5);
        await Promise.all(batch.map(({ id, org, newTags }) => {
          if (org) org.tags = newTags;
          return STATE.client.from('organisations').update({ tags: newTags }).eq('id', id);
        }));
      }
      utils.showToast(`Tag "${tag}" added to ${updates.length} org(s)`, 'success');
      this.renderOrganisations();
    } catch (e) { utils.showToast('Error: ' + e.message, 'error'); }
    finally { utils.hideLoading(); }
  },

  async executeBulkTagRemove() {
    const tag = document.getElementById('bulkTagRemoveSelect')?.value;
    if (!tag) { utils.showToast('Select a tag', 'warning'); return; }

    try {
      utils.showLoading();
      const orgIds = Array.from(this.selectedOrgs);
      // Build updates for orgs that have the tag
      const updates = [];
      for (const id of orgIds) {
        const org = STATE.allOrganisations.find(o => o.id === id);
        const currentTags = org?.tags || [];
        if (currentTags.includes(tag)) {
          const newTags = currentTags.filter(t => t !== tag);
          updates.push({ id, org, newTags });
        }
      }
      // Execute in parallel batches of 5
      for (let i = 0; i < updates.length; i += 5) {
        const batch = updates.slice(i, i + 5);
        await Promise.all(batch.map(({ id, org, newTags }) => {
          if (org) org.tags = newTags;
          return STATE.client.from('organisations').update({ tags: newTags }).eq('id', id);
        }));
      }
      utils.showToast(`Tag "${tag}" removed from ${updates.length} org(s)`, 'success');
      this.renderOrganisations();
    } catch (e) { utils.showToast('Error: ' + e.message, 'error'); }
    finally { utils.hideLoading(); }
  },

  // ============================================
  // AREA 8: BULK ASSIGN TO AWARD
  // ============================================
  async showBulkAssignAwardModal() {
    if (this.selectedOrgs.size === 0) { utils.showToast('No organisations selected', 'warning'); return; }

    utils.showLoading();
    try {
      const { data: awards } = await STATE.client.from('awards').select('id, award_name, county, sector, year').order('year', { ascending: false });
      const html = `<p class="small text-muted">Assign <strong>${this.selectedOrgs.size}</strong> selected organisations to an award</p>
        <div class="mb-3">
          <label class="form-label fw-semibold">Select Award</label>
          <select class="form-select" id="bulkAssignAwardSelect">
            <option value="">-- Select Award --</option>
            ${(awards || []).map(a => `<option value="${a.id}">${utils.escapeHtml(a.year + ' - ' + (a.award_name || a.county + ' ' + a.sector))}</option>`).join('')}
          </select>
        </div>
        <div class="mb-3">
          <label class="form-label fw-semibold">Assignment Status</label>
          <select class="form-select" id="bulkAssignStatus">
            <option value="nominated">Nominated</option><option value="shortlisted">Shortlisted</option><option value="winner">Winner</option>
          </select>
        </div>
        <button class="btn btn-primary" onclick="orgsModule.executeBulkAssignAward()"><i class="bi bi-trophy me-1"></i>Assign</button>`;

      this._showDynamicModal('Bulk Assign to Award', html, 'bi-trophy');
    } catch (e) { utils.showToast('Error loading awards', 'error'); }
    finally { utils.hideLoading(); }
  },

  async executeBulkAssignAward() {
    const awardId = document.getElementById('bulkAssignAwardSelect')?.value;
    const status = document.getElementById('bulkAssignStatus')?.value || 'nominated';
    if (!awardId) { utils.showToast('Select an award', 'warning'); return; }

    try {
      utils.showLoading();
      const orgIds = Array.from(this.selectedOrgs);
      const records = orgIds.map(orgId => ({ award_id: awardId, organisation_id: orgId, status }));
      const { error } = await STATE.client.from('award_assignments').upsert(records, { onConflict: 'award_id,organisation_id' });
      if (error) throw error;
      utils.showToast(`${orgIds.length} org(s) assigned to award`, 'success');
      await this.loadOrganisations();
    } catch (e) { utils.showToast('Error: ' + e.message, 'error'); }
    finally { utils.hideLoading(); }
  },

  // ============================================
  // AREA 8: MERGE DUPLICATES
  // ============================================
  showMergeDuplicatesModal() {
    if (this.selectedOrgs.size !== 2) {
      utils.showToast('Select exactly 2 organisations to merge', 'warning');
      return;
    }

    const [id1, id2] = Array.from(this.selectedOrgs);
    const org1 = STATE.allOrganisations.find(o => o.id === id1);
    const org2 = STATE.allOrganisations.find(o => o.id === id2);
    if (!org1 || !org2) return;

    const fields = ['company_name', 'contact_name', 'email', 'contact_phone', 'website', 'sector', 'region', 'address', 'catchment_area', 'description', 'tier', 'status', 'logo_url'];

    let html = `<div class="alert alert-warning small"><i class="bi bi-exclamation-triangle me-2"></i>Select which value to keep for each field. The other organisation will be deleted.</div>
    <table class="table table-sm"><thead><tr><th>Field</th><th>Organisation A</th><th>Organisation B</th></tr></thead><tbody>
    ${fields.map(f => {
      const v1 = org1[f] || '';
      const v2 = org2[f] || '';
      return `<tr>
        <td class="fw-semibold small">${f.replace(/_/g, ' ')}</td>
        <td><label class="d-flex align-items-center small"><input type="radio" name="merge_${f}" value="a" class="me-2" ${v1 ? 'checked' : ''}>${utils.escapeHtml(String(v1) || '(empty)')}</label></td>
        <td><label class="d-flex align-items-center small"><input type="radio" name="merge_${f}" value="b" class="me-2" ${!v1 && v2 ? 'checked' : ''}>${utils.escapeHtml(String(v2) || '(empty)')}</label></td>
      </tr>`;
    }).join('')}
    </tbody></table>
    <button class="btn btn-danger" onclick="orgsModule.executeMerge('${id1}','${id2}')"><i class="bi bi-intersect me-1"></i>Merge (keeps selected values, deletes other)</button>`;

    this._showDynamicModal('Merge Organisations', html, 'bi-intersect', 'modal-lg');
  },

  async executeMerge(id1, id2) {
    if (!confirm('This will merge the two organisations. The non-primary org will be deleted. Continue?')) return;

    const org1 = STATE.allOrganisations.find(o => o.id === id1);
    const org2 = STATE.allOrganisations.find(o => o.id === id2);
    const fields = ['company_name', 'contact_name', 'email', 'contact_phone', 'website', 'sector', 'region', 'address', 'catchment_area', 'description', 'tier', 'status', 'logo_url'];

    const merged = {};
    let keepId = id1, deleteId = id2;
    fields.forEach(f => {
      const radio = document.querySelector(`input[name="merge_${f}"]:checked`);
      if (radio?.value === 'b') {
        merged[f] = org2[f] || null;
      } else {
        merged[f] = org1[f] || null;
      }
    });

    try {
      utils.showLoading();
      // Update the keeper with merged values
      const { error } = await STATE.client.from('organisations').update(merged).eq('id', keepId);
      if (error) throw error;

      // Move award_assignments from deleted org to keeper
      await STATE.client.from('award_assignments').update({ organisation_id: keepId }).eq('organisation_id', deleteId);

      // Merge tags
      const keeperTags = org1.tags || [];
      const deletedTags = org2.tags || [];
      const mergedTags = [...new Set([...keeperTags, ...deletedTags])];
      await STATE.client.from('organisations').update({ tags: mergedTags }).eq('id', keepId);

      // Delete the other org
      await STATE.client.from('organisations').delete().eq('id', deleteId);

      utils.showToast('Organisations merged successfully', 'success');
      this.selectedOrgs.clear();
      await this.loadOrganisations();
    } catch (e) {
      utils.showToast('Error: ' + e.message, 'error');
    } finally { utils.hideLoading(); }
  },

  // ============================================
  // AREA 9: DATA QUALITY
  // ============================================
  calculateCompletenessScore(org) {
    const keyFields = ['company_name', 'email', 'contact_name', 'contact_phone', 'website', 'logo_url', 'sector', 'region', 'address', 'description'];
    const filled = keyFields.filter(f => org[f]).length;
    return Math.round((filled / keyFields.length) * 100);
  },

  validateEmail(email) {
    if (!email) return { valid: false, reason: 'Empty' };
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(email)) return { valid: false, reason: 'Invalid format' };
    const disposable = ['mailinator.com', 'guerrillamail.com', 'tempmail.com', 'throwaway.email'];
    const domain = email.split('@')[1]?.toLowerCase();
    if (disposable.includes(domain)) return { valid: false, reason: 'Disposable email' };
    return { valid: true, reason: 'OK' };
  },

  showDataQualityWizard() {
    const orgs = STATE.allOrganisations.filter(o => (o.status || 'prospect') !== 'archived');

    // Calculate stats
    const missingEmail = orgs.filter(o => !o.email);
    const missingPhone = orgs.filter(o => !o.contact_phone);
    const missingLogo = orgs.filter(o => !o.logo_url);
    const missingWebsite = orgs.filter(o => !o.website);
    const missingContact = orgs.filter(o => !o.contact_name);
    const missingDescription = orgs.filter(o => !o.description);

    const invalidEmails = orgs.filter(o => o.email && !this.validateEmail(o.email).valid);
    const staleOrgs = orgs.filter(o => {
      const updated = new Date(o.updated_at || o.created_at || 0);
      return (Date.now() - updated.getTime()) > 180 * 24 * 60 * 60 * 1000;
    });

    // Average completeness
    const avgCompleteness = orgs.length > 0
      ? Math.round(orgs.reduce((sum, o) => sum + this.calculateCompletenessScore(o), 0) / orgs.length)
      : 0;

    const html = `
      <div class="row g-3 mb-4">
        <div class="col-md-4 text-center">
          <div class="card border-0 bg-light">
            <div class="card-body">
              <h2 class="fw-bold ${avgCompleteness >= 70 ? 'text-success' : avgCompleteness >= 40 ? 'text-warning' : 'text-danger'}">${avgCompleteness}%</h2>
              <small class="text-muted">Avg. Data Completeness</small>
            </div>
          </div>
        </div>
        <div class="col-md-4 text-center">
          <div class="card border-0 bg-light"><div class="card-body"><h2 class="fw-bold text-warning">${invalidEmails.length}</h2><small class="text-muted">Invalid Emails</small></div></div>
        </div>
        <div class="col-md-4 text-center">
          <div class="card border-0 bg-light"><div class="card-body"><h2 class="fw-bold text-danger">${staleOrgs.length}</h2><small class="text-muted">Stale Records (6+ months)</small></div></div>
        </div>
      </div>
      <h6 class="fw-semibold mb-3">Missing Data Breakdown</h6>
      <div class="list-group mb-3">
        ${[
          { label: 'Missing Email', count: missingEmail.length, field: 'email', icon: 'bi-envelope' },
          { label: 'Missing Phone', count: missingPhone.length, field: 'contact_phone', icon: 'bi-phone' },
          { label: 'Missing Logo', count: missingLogo.length, field: 'logo_url', icon: 'bi-image' },
          { label: 'Missing Website', count: missingWebsite.length, field: 'website', icon: 'bi-globe' },
          { label: 'Missing Contact Name', count: missingContact.length, field: 'contact_name', icon: 'bi-person' },
          { label: 'Missing Description', count: missingDescription.length, field: 'description', icon: 'bi-text-paragraph' }
        ].map(item => `
          <a href="javascript:void(0);" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
             onclick="orgsModule._filterMissingField='${item.field}'; orgsModule.filterOrganisations(); bootstrap.Modal.getInstance(document.getElementById('dynamicOrgModal'))?.hide();">
            <span><i class="bi ${item.icon} me-2"></i>${item.label}</span>
            <span class="badge ${item.count > 0 ? 'bg-warning text-dark' : 'bg-success'}">${item.count}</span>
          </a>
        `).join('')}
      </div>
      ${invalidEmails.length > 0 ? `
        <h6 class="fw-semibold mb-2">Invalid Emails</h6>
        <div class="table-responsive mb-3" style="max-height: 200px; overflow-y: auto;">
          <table class="table table-sm"><thead><tr><th>Company</th><th>Email</th><th>Issue</th></tr></thead><tbody>
            ${invalidEmails.slice(0, 50).map(o => {
              const v = this.validateEmail(o.email);
              return `<tr><td class="small">${utils.escapeHtml(o.company_name)}</td><td class="small">${utils.escapeHtml(o.email)}</td><td class="small text-danger">${v.reason}</td></tr>`;
            }).join('')}
          </tbody></table>
        </div>` : ''}
      ${staleOrgs.length > 0 ? `
        <h6 class="fw-semibold mb-2">Stale Records (6+ months without updates)</h6>
        <div class="table-responsive" style="max-height: 200px; overflow-y: auto;">
          <table class="table table-sm"><thead><tr><th>Company</th><th>Last Updated</th><th>Status</th></tr></thead><tbody>
            ${staleOrgs.slice(0, 50).map(o => `<tr>
              <td class="small">${utils.escapeHtml(o.company_name)}</td>
              <td class="small text-muted">${o.updated_at ? new Date(o.updated_at).toLocaleDateString('en-GB') : 'Never'}</td>
              <td>${this.getStatusBadge(o.status || 'prospect')}</td>
            </tr>`).join('')}
          </tbody></table>
        </div>` : ''}`;

    this._showDynamicModal('Data Quality Wizard', html, 'bi-shield-check', 'modal-lg');
  },

  // ============================================
  // AREA 10: ANALYTICS & REPORTING
  // ============================================
  showAnalyticsDashboard() {
    const orgs = STATE.allOrganisations.filter(o => (o.status || 'prospect') !== 'archived');

    // Sector breakdown
    const sectorCounts = {};
    orgs.forEach(o => { if (o.sector) sectorCounts[o.sector] = (sectorCounts[o.sector] || 0) + 1; });
    const topSectors = Object.entries(sectorCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const maxSectorCount = topSectors[0]?.[1] || 1;

    // Regional distribution
    const regionCounts = {};
    orgs.forEach(o => { if (o.region) regionCounts[o.region] = (regionCounts[o.region] || 0) + 1; });
    const topRegions = Object.entries(regionCounts).sort((a, b) => b[1] - a[1]);
    const maxRegionCount = topRegions[0]?.[1] || 1;

    // Status pipeline
    const statusCounts = { prospect: 0, entrant: 0, nominee: 0, shortlisted: 0, winner: 0, sponsor: 0, past_winner: 0 };
    orgs.forEach(o => { const s = o.status || 'prospect'; if (statusCounts[s] !== undefined) statusCounts[s]++; });
    const conversionRates = this._calculateConversionRates(statusCounts);

    // Year-over-year growth
    const yearCounts = {};
    STATE.allOrganisations.forEach(o => {
      const year = o.created_at ? new Date(o.created_at).getFullYear() : null;
      if (year) yearCounts[year] = (yearCounts[year] || 0) + 1;
    });
    const years = Object.keys(yearCounts).sort();

    // Win rate by sector
    const sectorWinData = {};
    orgs.forEach(o => {
      if (o.sector) {
        if (!sectorWinData[o.sector]) sectorWinData[o.sector] = { total: 0, winners: 0 };
        sectorWinData[o.sector].total++;
        if (o.status === 'winner' || o.status === 'past_winner') sectorWinData[o.sector].winners++;
      }
    });
    const winRates = Object.entries(sectorWinData)
      .map(([sector, data]) => ({ sector, rate: data.total > 0 ? Math.round((data.winners / data.total) * 100) : 0, winners: data.winners, total: data.total }))
      .filter(d => d.winners > 0)
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 10);

    const statusColors = { prospect: '#6c757d', entrant: '#0dcaf0', nominee: '#0d6efd', shortlisted: '#ffc107', winner: '#198754', sponsor: '#dc3545', past_winner: '#212529' };

    const html = `
      <div class="row g-4">
        <!-- Sector Breakdown -->
        <div class="col-md-6">
          <h6 class="fw-semibold mb-3"><i class="bi bi-pie-chart me-2"></i>Sector Breakdown (Top 10)</h6>
          <div class="card"><div class="card-body">
            ${topSectors.map(([sector, count]) => `
              <div class="d-flex align-items-center mb-2">
                <span class="small text-truncate me-2" style="width: 120px;" title="${utils.escapeHtml(sector)}">${utils.escapeHtml(sector)}</span>
                <div class="flex-grow-1"><div class="progress" style="height: 20px;">
                  <div class="progress-bar bg-info" style="width: ${(count / maxSectorCount) * 100}%">${count}</div>
                </div></div>
              </div>`).join('')}
            ${topSectors.length === 0 ? '<p class="text-muted small">No sector data</p>' : ''}
          </div></div>
        </div>

        <!-- Regional Distribution -->
        <div class="col-md-6">
          <h6 class="fw-semibold mb-3"><i class="bi bi-geo-alt me-2"></i>Regional Distribution</h6>
          <div class="card"><div class="card-body">
            ${topRegions.map(([region, count]) => `
              <div class="d-flex align-items-center mb-2">
                <span class="small text-truncate me-2" style="width: 120px;" title="${utils.escapeHtml(region)}">${utils.escapeHtml(region)}</span>
                <div class="flex-grow-1"><div class="progress" style="height: 20px;">
                  <div class="progress-bar bg-success" style="width: ${(count / maxRegionCount) * 100}%">${count}</div>
                </div></div>
              </div>`).join('')}
            ${topRegions.length === 0 ? '<p class="text-muted small">No region data</p>' : ''}
          </div></div>
        </div>

        <!-- Status Pipeline with Conversion Rates -->
        <div class="col-md-6">
          <h6 class="fw-semibold mb-3"><i class="bi bi-funnel me-2"></i>Status Pipeline & Conversion</h6>
          <div class="card"><div class="card-body">
            ${['prospect', 'entrant', 'nominee', 'shortlisted', 'winner'].map((s, i, arr) => {
              const count = statusCounts[s] || 0;
              const maxCount = Math.max(...Object.values(statusCounts)) || 1;
              const convKey = i < arr.length - 1 ? `${s}_to_${arr[i + 1]}` : null;
              const convRate = convKey ? conversionRates[convKey] : null;
              return `<div class="d-flex align-items-center mb-1">
                <span class="small me-2" style="width: 80px;">${s.charAt(0).toUpperCase() + s.slice(1)}</span>
                <div class="flex-grow-1"><div class="progress" style="height: 22px;">
                  <div class="progress-bar" style="width: ${(count / maxCount) * 100}%; background-color: ${statusColors[s]}">${count}</div>
                </div></div>
              </div>
              ${convRate !== null ? `<div class="text-end mb-2"><small class="text-muted"><i class="bi bi-arrow-down"></i> ${convRate}% conversion</small></div>` : ''}`;
            }).join('')}
          </div></div>
        </div>

        <!-- Year-over-Year Growth -->
        <div class="col-md-6">
          <h6 class="fw-semibold mb-3"><i class="bi bi-graph-up me-2"></i>Year-over-Year Growth</h6>
          <div class="card"><div class="card-body">
            ${years.length > 0 ? (() => {
              const maxYearCount = Math.max(...Object.values(yearCounts)) || 1;
              return years.map((y, i) => {
                const count = yearCounts[y];
                const prevCount = i > 0 ? yearCounts[years[i - 1]] : null;
                const growth = prevCount ? Math.round(((count - prevCount) / prevCount) * 100) : null;
                return `<div class="d-flex align-items-center mb-2">
                  <span class="small fw-semibold me-2" style="width: 50px;">${y}</span>
                  <div class="flex-grow-1"><div class="progress" style="height: 22px;">
                    <div class="progress-bar bg-primary" style="width: ${(count / maxYearCount) * 100}%">${count}</div>
                  </div></div>
                  ${growth !== null ? `<span class="ms-2 small ${growth >= 0 ? 'text-success' : 'text-danger'}">${growth >= 0 ? '+' : ''}${growth}%</span>` : ''}
                </div>`;
              }).join('');
            })() : '<p class="text-muted small">No year data available</p>'}
          </div></div>
        </div>

        <!-- Win Rate by Sector -->
        <div class="col-12">
          <h6 class="fw-semibold mb-3"><i class="bi bi-trophy me-2"></i>Win Rate by Sector</h6>
          <div class="card"><div class="card-body">
            ${winRates.length > 0 ? `<div class="table-responsive"><table class="table table-sm"><thead><tr><th>Sector</th><th>Total Orgs</th><th>Winners</th><th>Win Rate</th><th></th></tr></thead><tbody>
              ${winRates.map(d => `<tr>
                <td class="small fw-semibold">${utils.escapeHtml(d.sector)}</td>
                <td class="small">${d.total}</td>
                <td class="small">${d.winners}</td>
                <td class="small fw-bold ${d.rate >= 50 ? 'text-success' : d.rate >= 25 ? 'text-warning' : 'text-muted'}">${d.rate}%</td>
                <td><div class="progress" style="height: 12px; width: 100px;"><div class="progress-bar bg-success" style="width: ${d.rate}%"></div></div></td>
              </tr>`).join('')}
            </tbody></table></div>` : '<p class="text-muted small">No winners data to show win rates</p>'}
          </div></div>
        </div>
      </div>`;

    this._showDynamicModal('Analytics & Reporting', html, 'bi-bar-chart', 'modal-xl');
  },

  // ============================================
  // AREA 11: ENHANCED IMPORT/EXPORT
  // ============================================
  // Excel Export
  exportToExcel() {
    const data = STATE.filteredOrganisations;
    if (data.length === 0) { utils.showToast('No organisations to export', 'warning'); return; }

    // Build XML Spreadsheet (compatible with Excel without external libs)
    const headers = ['Company Name', 'Sector', 'County', 'Region', 'Contact Name', 'Email', 'Phone', 'Website', 'Status', 'Tier', 'Tags', 'Awards Count', 'Address', 'Catchment Area', 'Description', 'Year Founded', 'Employees', 'Engagement Score', 'Health Status', 'Last Contacted'];
    const xmlHeader = '<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Organisations"><Table>';
    const headerRow = '<Row>' + headers.map(h => `<Cell><Data ss:Type="String">${this._xmlEscape(h)}</Data></Cell>`).join('') + '</Row>';
    const dataRows = data.map(org => {
      const engagement = this.calculateEngagementScore(org);
      const health = this.getOrgHealthIndicator(org);
      const lastContacted = this.getLastContacted(org.id);
      const vals = [
        org.company_name, org.sector, org.county, org.region, org.contact_name,
        org.email, org.contact_phone, org.website, org.status || 'prospect',
        org.tier, (org.tags || []).join(', '), String(org.awards_count || 0),
        org.address, org.catchment_area, org.description, org.year_founded ? String(org.year_founded) : '', org.employee_count ? String(org.employee_count) : '',
        String(engagement), health.label,
        lastContacted ? new Date(lastContacted).toLocaleDateString('en-GB') : 'Never'
      ];
      return '<Row>' + vals.map(v => `<Cell><Data ss:Type="String">${this._xmlEscape(v || '')}</Data></Cell>`).join('') + '</Row>';
    }).join('');
    const xmlFooter = '</Table></Worksheet></Workbook>';
    const xml = xmlHeader + headerRow + dataRows + xmlFooter;

    const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `organisations-export-${new Date().toISOString().split('T')[0]}.xls`;
    a.click();
    window.URL.revokeObjectURL(url);
    utils.showToast(`Exported ${data.length} organisations to Excel`, 'success');
  },

  _xmlEscape(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  // Import History
  _logImportHistory(filename, count, county) {
    try {
      const history = JSON.parse(localStorage.getItem('orgImportHistory') || '[]');
      history.unshift({ filename, count, county, date: new Date().toISOString() });
      if (history.length > 100) history.length = 100;
      localStorage.setItem('orgImportHistory', JSON.stringify(history));
    } catch (e) { /* ignore */ }
  },

  showImportHistory() {
    try {
      const history = JSON.parse(localStorage.getItem('orgImportHistory') || '[]');
      const html = history.length === 0
        ? '<p class="text-muted text-center">No import history yet</p>'
        : `<div class="table-responsive"><table class="table table-sm"><thead><tr><th>Date</th><th>File</th><th>County</th><th>Records</th></tr></thead><tbody>
          ${history.map(h => `<tr>
            <td class="small">${new Date(h.date).toLocaleDateString('en-GB')} ${new Date(h.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</td>
            <td class="small">${utils.escapeHtml(h.filename || 'N/A')}</td>
            <td class="small">${utils.escapeHtml(h.county || 'N/A')}</td>
            <td class="small fw-semibold">${h.count}</td>
          </tr>`).join('')}
        </tbody></table></div>`;

      this._showDynamicModal('Import History', html, 'bi-clock-history');
    } catch (e) { utils.showToast('Error loading history', 'error'); }
  },

  // Enhanced CSV import with validation
  _validateImportRow(record) {
    const issues = [];
    if (!record.company_name || record.company_name.trim().length < 2) issues.push('Company name too short');
    if (record.email && !this.validateEmail(record.email).valid) issues.push('Invalid email: ' + this.validateEmail(record.email).reason);
    if (record.website && !/^https?:\/\/.+\..+/.test(record.website) && !/^.+\..+/.test(record.website)) issues.push('Invalid website URL');
    if (record.contact_phone && !/^[\d\s+\-()]{7,}$/.test(record.contact_phone)) issues.push('Invalid phone format');
    return issues;
  },

  // Import merge mode flag
  _importMergeMode: false,

  toggleImportMergeMode() {
    this._importMergeMode = !this._importMergeMode;
    const btn = document.getElementById('importMergeModeBtn');
    if (btn) {
      btn.classList.toggle('btn-primary', this._importMergeMode);
      btn.classList.toggle('btn-outline-secondary', !this._importMergeMode);
      btn.innerHTML = this._importMergeMode
        ? '<i class="bi bi-arrow-repeat me-1"></i>Merge Mode: ON'
        : '<i class="bi bi-arrow-repeat me-1"></i>Merge Mode: OFF';
    }
  },

  // ============================================
  // FEATURE 2: UNIFIED ACTIVITY TIMELINE
  // ============================================
  async loadUnifiedTimeline(orgId) {
    try {
      const [auditLog, commsLog, notes, followUps] = await Promise.all([
        this.getAuditLog(orgId),
        this.getCommsHistory(orgId),
        this.getThreadedNotes(orgId),
        this.getFollowUps(orgId)
      ]);

      // Also load award assignments for this org
      let assignments = [];
      try {
        const { data } = await STATE.client.from('award_assignments')
          .select('*, awards!award_assignments_award_id_fkey(award_name, year)')
          .eq('organisation_id', orgId);
        assignments = data || [];
      } catch (e) { /* ignore */ }

      // Also load invoices
      let invoices = [];
      try {
        const { data } = await STATE.client.from('invoices')
          .select('id, invoice_number, total_amount, status, created_at')
          .eq('organisation_id', orgId);
        invoices = data || [];
      } catch (e) { /* ignore */ }

      const timeline = [
        ...auditLog.map(e => ({ ...e, _type: 'audit', _date: new Date(e.timestamp || e.created_at), _icon: 'bi-clock-history text-muted', _label: e.details || e.action })),
        ...commsLog.map(e => ({ ...e, _type: 'comms', _date: new Date(e.timestamp || e.created_at), _icon: 'bi-envelope-check text-success', _label: `Email: ${e.templateName || e.template_name || 'Unknown'}` })),
        ...notes.map(e => ({ ...e, _type: 'note', _date: new Date(e.created_at), _icon: 'bi-chat-left-text text-info', _label: `Note by ${e.author || 'Unknown'}: ${(e.content || '').substring(0, 80)}` })),
        ...followUps.filter(f => f.done).map(f => ({ ...f, _type: 'followup', _date: new Date(f.created), _icon: 'bi-check-circle text-success', _label: `Follow-up completed: ${f.note || 'N/A'}` })),
        ...assignments.map(a => ({ ...a, _type: 'assignment', _date: new Date(a.created_at), _icon: 'bi-trophy text-warning', _label: `Award assignment: ${a.awards?.award_name || 'Unknown'} (${a.status})` })),
        ...invoices.map(inv => ({ ...inv, _type: 'invoice', _date: new Date(inv.created_at), _icon: 'bi-receipt text-primary', _label: `Invoice #${inv.invoice_number || 'N/A'}: £${parseFloat(inv.total_amount || 0).toFixed(2)} (${inv.status})` }))
      ].sort((a, b) => b._date - a._date).slice(0, 50);

      return timeline;
    } catch (e) { return []; }
  },

  renderUnifiedTimeline(timeline) {
    if (!timeline || timeline.length === 0) return '<p class="text-muted small">No activity recorded yet</p>';
    const iconMap = {
      'status_change': 'bi-arrow-repeat text-primary', 'archived': 'bi-archive text-warning',
      'restored': 'bi-arrow-counterclockwise text-success', 'created': 'bi-plus-circle text-success',
      'email_sent': 'bi-envelope text-info', 'note_added': 'bi-sticky text-secondary',
      'csv_import': 'bi-file-earmark-arrow-up text-primary', 'field_changed': 'bi-pencil text-info'
    };

    return `<div class="list-group list-group-flush" style="max-height: 400px; overflow-y: auto;">
      ${timeline.map(e => {
        const icon = e._type === 'audit' ? (iconMap[e.action] || e._icon) : e._icon;
        return `<div class="list-group-item px-0 py-2 border-0">
          <div class="d-flex align-items-start">
            <i class="bi ${icon} me-2 mt-1"></i>
            <div class="flex-grow-1">
              <div class="small fw-semibold">${utils.escapeHtml(e._label)}</div>
              <div class="text-muted" style="font-size: 0.7rem;">${this._timeAgo(e._date)} &middot; ${e._date.toLocaleDateString('en-GB')} ${e._date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
            <span class="badge bg-light text-muted" style="font-size: 0.6rem;">${e._type}</span>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  },

  // ============================================
  // FEATURE 3: RELATIONSHIP MAPPING
  // ============================================
  async getRelationships(orgId) {
    try {
      const { data: outgoing } = await STATE.client.from('organisation_relationships')
        .select('*, related:related_organisation_id(id, company_name, logo_url, status)')
        .eq('organisation_id', orgId);
      const { data: incoming } = await STATE.client.from('organisation_relationships')
        .select('*, source:organisation_id(id, company_name, logo_url, status)')
        .eq('related_organisation_id', orgId);
      return { outgoing: outgoing || [], incoming: incoming || [] };
    } catch (e) { return { outgoing: [], incoming: [] }; }
  },

  async addRelationship(orgId) {
    const relatedName = document.getElementById('relatedOrgSearch')?.value.trim();
    const relType = document.getElementById('relationshipType')?.value || 'related';
    if (!relatedName) { utils.showToast('Search for an organisation', 'warning'); return; }

    const related = STATE.allOrganisations.find(o =>
      o.company_name?.toLowerCase() === relatedName.toLowerCase() && o.id !== orgId
    );
    if (!related) { utils.showToast('Organisation not found', 'error'); return; }

    try {
      const { error } = await STATE.client.from('organisation_relationships').insert([{
        organisation_id: orgId, related_organisation_id: related.id, relationship_type: relType
      }]);
      if (error) throw error;
      utils.showToast('Relationship added', 'success');
      const org = STATE.allOrganisations.find(o => o.id === orgId);
      if (org) this.openCompanyProfile(orgId, org.company_name);
    } catch (e) { utils.showToast('Error: ' + e.message, 'error'); }
  },

  async removeRelationship(relId, orgId) {
    try {
      await STATE.client.from('organisation_relationships').delete().eq('id', relId);
      utils.showToast('Relationship removed', 'success');
      const org = STATE.allOrganisations.find(o => o.id === orgId);
      if (org) this.openCompanyProfile(orgId, org.company_name);
    } catch (e) { utils.showToast('Error: ' + e.message, 'error'); }
  },

  renderRelationships(relationships, orgId) {
    const all = [
      ...relationships.outgoing.map(r => ({ id: r.id, type: r.relationship_type, org: r.related, direction: 'outgoing' })),
      ...relationships.incoming.map(r => ({ id: r.id, type: r.relationship_type, org: r.source, direction: 'incoming' }))
    ];
    const typeLabels = { parent: 'Parent Company', subsidiary: 'Subsidiary', co_sponsor: 'Co-Sponsor', partner: 'Partner', franchise: 'Franchise', related: 'Related' };

    if (all.length === 0) return '<p class="text-muted small mb-0">No linked organisations</p>';
    return `<div class="list-group list-group-flush">
      ${all.map(r => `<div class="list-group-item px-0 py-2 border-0 d-flex align-items-center">
        ${r.org?.logo_url ? `<img src="${r.org.logo_url}" class="me-2 rounded" style="width:30px;height:21px;object-fit:contain;border:1px solid #e0e0e0;">` :
          `<div class="me-2 d-flex align-items-center justify-content-center rounded" style="width:30px;height:21px;background:#f5f5f5;border:1px solid #e0e0e0;"><i class="bi bi-building text-muted" style="font-size:0.6rem;"></i></div>`}
        <div class="flex-grow-1">
          <a href="javascript:void(0);" class="small fw-semibold text-primary text-decoration-none"
            onclick="orgsModule.openCompanyProfile('${r.org?.id}', '${utils.escapeHtml(r.org?.company_name || '').replace(/'/g, "\\'")}')">${utils.escapeHtml(r.org?.company_name || 'Unknown')}</a>
          <span class="badge bg-light text-muted ms-1" style="font-size:0.6rem;">${typeLabels[r.type] || r.type}${r.direction === 'incoming' ? ' (of this)' : ''}</span>
        </div>
        <button class="btn btn-sm btn-outline-danger py-0" onclick="orgsModule.removeRelationship('${r.id}','${orgId}')"><i class="bi bi-x"></i></button>
      </div>`).join('')}
    </div>`;
  },

  // ============================================
  // FEATURE 4: EMAIL INTEGRATION IN PROFILE
  // ============================================
  async composeEmailFromProfile(orgId) {
    const org = STATE.allOrganisations.find(o => o.id === orgId);
    if (!org) return;
    const to = org.email || '';
    const subject = document.getElementById('profileEmailSubject')?.value.trim() || '';
    const body = document.getElementById('profileEmailBody')?.value.trim() || '';
    if (!to) { utils.showToast('No email address for this company', 'warning'); return; }
    if (!subject) { utils.showToast('Enter a subject', 'warning'); return; }

    // Log the communication
    try {
      await STATE.client.from('organisation_comms_log').insert([{
        organisation_id: orgId, template_name: subject, subject, message: body, channel: 'email', direction: 'outbound'
      }]);
    } catch (e) { /* ignore */ }
    this._logAudit(orgId, 'email_sent', org.company_name, `Email composed: ${subject}`);

    // Open mailto link
    const mailtoUrl = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoUrl);
    utils.showToast('Email client opened', 'success');
    document.getElementById('profileEmailSubject').value = '';
    document.getElementById('profileEmailBody').value = '';
  },

  // ============================================
  // FEATURE 5: KANBAN PIPELINE BOARD VIEW
  // ============================================
  _kanbanViewActive: false,
  _kanbanExpandedColumns: new Set(),

  toggleKanbanView() {
    this._kanbanViewActive = !this._kanbanViewActive;
    const kanbanEl = document.getElementById('orgKanbanBoard');
    const tableEl = document.getElementById('orgTableContainer');
    const toggleBtn = document.getElementById('kanbanToggleBtn');

    if (this._kanbanViewActive) {
      if (kanbanEl) kanbanEl.style.display = 'block';
      if (tableEl) tableEl.style.display = 'none';
      if (toggleBtn) { toggleBtn.classList.remove('btn-outline-info'); toggleBtn.classList.add('btn-info'); }
      this.renderKanbanBoard();
    } else {
      if (kanbanEl) kanbanEl.style.display = 'none';
      if (tableEl) tableEl.style.display = 'block';
      if (toggleBtn) { toggleBtn.classList.remove('btn-info'); toggleBtn.classList.add('btn-outline-info'); }
    }
  },

  renderKanbanBoard() {
    const kanbanEl = document.getElementById('orgKanbanBoard');
    if (!kanbanEl) return;

    const stages = [
      { key: 'prospect', label: 'Prospect', color: '#6c757d', icon: 'bi-funnel' },
      { key: 'entrant', label: 'Entrant', color: '#0dcaf0', icon: 'bi-box-arrow-in-right' },
      { key: 'nominee', label: 'Nominee', color: '#0d6efd', icon: 'bi-star' },
      { key: 'shortlisted', label: 'Shortlisted', color: '#ffc107', icon: 'bi-list-check' },
      { key: 'winner', label: 'Winner', color: '#198754', icon: 'bi-trophy' },
      { key: 'sponsor', label: 'Sponsor', color: '#6f42c1', icon: 'bi-cash-stack' },
      { key: 'past_winner', label: 'Past Winner', color: '#fd7e14', icon: 'bi-award' }
    ];

    const orgs = STATE.filteredOrganisations.filter(o => (o.status || 'prospect') !== 'archived');

    kanbanEl.innerHTML = `
      <div class="d-flex gap-2 overflow-auto pb-3" style="min-height: 500px;">
        ${stages.map(stage => {
          const stageOrgs = orgs.filter(o => (o.status || 'prospect') === stage.key);
          return `
            <div class="kanban-column flex-shrink-0" style="width: 220px; min-width: 220px;"
              data-status="${stage.key}"
              ondragover="event.preventDefault(); this.classList.add('kanban-drag-over')"
              ondragleave="this.classList.remove('kanban-drag-over')"
              ondrop="orgsModule.handleKanbanDrop(event, '${stage.key}'); this.classList.remove('kanban-drag-over')">
              <div class="card h-100 border-0 shadow-sm">
                <div class="card-header py-2 text-white" style="background: ${stage.color};">
                  <div class="d-flex justify-content-between align-items-center">
                    <span class="fw-semibold small"><i class="bi ${stage.icon} me-1"></i>${stage.label}</span>
                    <span class="badge bg-white text-dark">${stageOrgs.length}</span>
                  </div>
                </div>
                <div class="card-body p-2" style="max-height: 450px; overflow-y: auto;">
                  ${(() => {
                    if (stageOrgs.length === 0) return '<p class="text-muted small text-center py-3">No organisations</p>';
                    const isExpanded = this._kanbanExpandedColumns.has(stage.key);
                    const limit = isExpanded ? stageOrgs.length : 30;
                    const visible = stageOrgs.slice(0, limit);
                    const remaining = stageOrgs.length - limit;
                    return visible.map(org => `
                      <div class="card mb-2 kanban-card" draggable="true"
                        ondragstart="event.dataTransfer.setData('text/plain', '${org.id}')"
                        style="cursor: grab; border-left: 3px solid ${stage.color};">
                        <div class="card-body p-2">
                          <div class="d-flex align-items-center mb-1">
                            ${org.logo_url ? `<img src="${org.logo_url}" class="me-1 rounded" style="width:24px;height:17px;object-fit:contain;">` : ''}
                            <a href="javascript:void(0);" class="small fw-semibold text-primary text-decoration-none text-truncate"
                              onclick="orgsModule.openCompanyProfile('${org.id}', '${utils.escapeHtml(org.company_name || '').replace(/'/g, "\\'")}')"
                              style="max-width: 150px;">${utils.escapeHtml(org.company_name || 'N/A')}</a>
                          </div>
                          <div class="text-muted" style="font-size: 0.65rem;">${utils.escapeHtml(org.sector || '-')} &middot; ${utils.escapeHtml(org.county || '-')}</div>
                          ${org.tier ? `<span class="badge" style="font-size:0.55rem;background:${{'Bronze':'#CD7F32','Silver':'#C0C0C0','Gold':'#FFD700','Platinum':'#E5E4E2'}[org.tier] || '#ccc'}">${org.tier}</span>` : ''}
                        </div>
                      </div>
                    `).join('') + (remaining > 0
                      ? `<button class="btn btn-sm btn-outline-secondary w-100 mt-1" onclick="orgsModule.expandKanbanColumn('${stage.key}')"><i class="bi bi-chevron-down me-1"></i>Show ${remaining} more</button>`
                      : (isExpanded && stageOrgs.length > 30
                        ? `<button class="btn btn-sm btn-outline-secondary w-100 mt-1" onclick="orgsModule.collapseKanbanColumn('${stage.key}')"><i class="bi bi-chevron-up me-1"></i>Show less</button>`
                        : ''));
                  })()}
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  async handleKanbanDrop(event, newStatus) {
    event.preventDefault();
    const orgId = event.dataTransfer.getData('text/plain');
    if (!orgId) return;
    await this.quickUpdateStatus(orgId, newStatus);
    this.renderKanbanBoard();
    await this.calculateDashboardStats();
  },

  expandKanbanColumn(status) {
    this._kanbanExpandedColumns.add(status);
    this.renderKanbanBoard();
  },

  collapseKanbanColumn(status) {
    this._kanbanExpandedColumns.delete(status);
    this.renderKanbanBoard();
  },

  // ============================================
  // FEATURE 6: DASHBOARD KPIs & CONVERSION FUNNEL (enhanced)
  // ============================================
  calculateEngagementScore(org) {
    let score = 0;
    const daysSinceUpdate = org.updated_at ? Math.floor((Date.now() - new Date(org.updated_at).getTime()) / 86400000) : 999;
    if (daysSinceUpdate < 7) score += 40;
    else if (daysSinceUpdate < 30) score += 25;
    else if (daysSinceUpdate < 90) score += 10;

    if (org.email) score += 10;
    if (org.contact_name) score += 10;
    if (org.logo_url) score += 10;
    if (org.website) score += 5;
    if (org.description) score += 5;
    if (org.awards_count > 0) score += 20;
    if (org.tier) score += 10;
    return Math.min(score, 100);
  },

  getOrgHealthIndicator(org) {
    const daysSinceUpdate = org.updated_at ? Math.floor((Date.now() - new Date(org.updated_at).getTime()) / 86400000) : 999;
    const hasEmail = !!org.email;
    const hasContact = !!org.contact_name;
    const engagement = this.calculateEngagementScore(org);

    if (daysSinceUpdate > 180 || (!hasEmail && !hasContact)) return { color: 'danger', label: 'At Risk', icon: 'bi-exclamation-triangle-fill' };
    if (daysSinceUpdate > 90 || engagement < 30) return { color: 'warning', label: 'Needs Attention', icon: 'bi-exclamation-circle' };
    return { color: 'success', label: 'Healthy', icon: 'bi-check-circle-fill' };
  },

  // ============================================
  // FEATURE 8: THREADED NOTES / COMMENTS
  // ============================================
  async getThreadedNotes(orgId) {
    try {
      const { data, error } = await STATE.client.from('organisation_notes')
        .select('*').eq('organisation_id', orgId)
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (e) { return []; }
  },

  async addThreadedNote(orgId) {
    const content = document.getElementById('newNoteContent')?.value.trim();
    if (!content) { utils.showToast('Enter a note', 'warning'); return; }
    try {
      const userEmail = STATE.client?.auth?.getUser ? (await STATE.client.auth.getUser())?.data?.user?.email : 'admin';
      const { error } = await STATE.client.from('organisation_notes').insert([{
        organisation_id: orgId, content, author: userEmail || 'admin'
      }]);
      if (error) throw error;
      this._logAudit(orgId, 'note_added', '', `Note added: ${content.substring(0, 50)}`);
      utils.showToast('Note added', 'success');
      const org = STATE.allOrganisations.find(o => o.id === orgId);
      if (org) this.openCompanyProfile(orgId, org.company_name);
    } catch (e) { utils.showToast('Error: ' + e.message, 'error'); }
  },

  async deleteThreadedNote(noteId, orgId) {
    if (!confirm('Delete this note?')) return;
    try {
      await STATE.client.from('organisation_notes').delete().eq('id', noteId);
      utils.showToast('Note deleted', 'success');
      const org = STATE.allOrganisations.find(o => o.id === orgId);
      if (org) this.openCompanyProfile(orgId, org.company_name);
    } catch (e) { utils.showToast('Error: ' + e.message, 'error'); }
  },

  async togglePinNote(noteId, pinned, orgId) {
    try {
      await STATE.client.from('organisation_notes').update({ pinned: !pinned }).eq('id', noteId);
      const org = STATE.allOrganisations.find(o => o.id === orgId);
      if (org) this.openCompanyProfile(orgId, org.company_name);
    } catch (e) { utils.showToast('Error: ' + e.message, 'error'); }
  },

  renderThreadedNotes(notes, orgId) {
    if (notes.length === 0) return '<p class="text-muted small mb-0">No notes yet. Add one below.</p>';
    return `<div class="list-group list-group-flush" style="max-height: 300px; overflow-y: auto;">
      ${notes.map(n => `<div class="list-group-item px-0 py-2 border-0 ${n.pinned ? 'bg-warning-subtle' : ''}">
        <div class="d-flex align-items-start">
          ${n.pinned ? '<i class="bi bi-pin-fill text-warning me-2 mt-1"></i>' : '<i class="bi bi-chat-left-text text-muted me-2 mt-1"></i>'}
          <div class="flex-grow-1">
            <div class="small">${utils.escapeHtml(n.content)}</div>
            <div class="text-muted" style="font-size: 0.7rem;">
              <i class="bi bi-person me-1"></i>${utils.escapeHtml(n.author || 'Unknown')}
              &middot; ${this._timeAgo(new Date(n.created_at))}
            </div>
          </div>
          <div class="btn-group btn-group-sm">
            <button class="btn btn-sm btn-outline-warning py-0" onclick="orgsModule.togglePinNote('${n.id}', ${n.pinned}, '${orgId}')" title="${n.pinned ? 'Unpin' : 'Pin'}"><i class="bi bi-pin"></i></button>
            <button class="btn btn-sm btn-outline-danger py-0" onclick="orgsModule.deleteThreadedNote('${n.id}', '${orgId}')"><i class="bi bi-trash"></i></button>
          </div>
        </div>
      </div>`).join('')}
    </div>`;
  },

  // ============================================
  // FEATURE 9: SPONSORSHIP PACKAGE MANAGEMENT
  // ============================================
  async getSponsorshipPackages(orgId) {
    try {
      const { data, error } = await STATE.client.from('sponsorship_packages')
        .select('*').eq('organisation_id', orgId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (e) { return []; }
  },

  async addSponsorshipPackage(orgId) {
    const pkgName = document.getElementById('spkgName')?.value.trim();
    const tier = document.getElementById('spkgTier')?.value;
    const amount = parseFloat(document.getElementById('spkgAmount')?.value) || 0;
    const startDate = document.getElementById('spkgStartDate')?.value || null;
    const endDate = document.getElementById('spkgEndDate')?.value || null;
    const renewalDate = document.getElementById('spkgRenewalDate')?.value || null;
    const schedule = document.getElementById('spkgSchedule')?.value || 'one_time';
    const benefitsRaw = document.getElementById('spkgBenefits')?.value.trim() || '';
    const benefits = benefitsRaw ? benefitsRaw.split('\n').filter(b => b.trim()) : [];

    if (!pkgName) { utils.showToast('Enter package name', 'warning'); return; }
    try {
      const { error } = await STATE.client.from('sponsorship_packages').insert([{
        organisation_id: orgId, package_name: pkgName, tier, amount,
        start_date: startDate, end_date: endDate, renewal_date: renewalDate,
        payment_schedule: schedule, benefits: JSON.stringify(benefits), status: 'active'
      }]);
      if (error) throw error;
      utils.showToast('Package added', 'success');
      const org = STATE.allOrganisations.find(o => o.id === orgId);
      if (org) this.openCompanyProfile(orgId, org.company_name);
    } catch (e) { utils.showToast('Error: ' + e.message, 'error'); }
  },

  async deleteSponsorshipPackage(pkgId, orgId) {
    if (!confirm('Delete this sponsorship package?')) return;
    try {
      await STATE.client.from('sponsorship_packages').delete().eq('id', pkgId);
      utils.showToast('Package deleted', 'success');
      const org = STATE.allOrganisations.find(o => o.id === orgId);
      if (org) this.openCompanyProfile(orgId, org.company_name);
    } catch (e) { utils.showToast('Error: ' + e.message, 'error'); }
  },

  renderSponsorshipPackages(packages, orgId) {
    if (packages.length === 0) return '<p class="text-muted small mb-0">No sponsorship packages</p>';
    const statusColors = { active: 'success', expired: 'danger', pending: 'warning', cancelled: 'secondary' };
    return packages.map(pkg => {
      let benefits = [];
      try { benefits = typeof pkg.benefits === 'string' ? JSON.parse(pkg.benefits) : (pkg.benefits || []); } catch (e) { benefits = []; }
      const isExpiring = pkg.renewal_date && new Date(pkg.renewal_date) < new Date(Date.now() + 30 * 86400000);
      return `<div class="card mb-2 ${isExpiring ? 'border-warning' : ''}">
        <div class="card-body p-2">
          <div class="d-flex justify-content-between align-items-start">
            <div>
              <h6 class="mb-1 small fw-bold">${utils.escapeHtml(pkg.package_name)}
                ${pkg.tier ? `<span class="badge bg-warning-subtle text-warning ms-1">${utils.escapeHtml(pkg.tier)}</span>` : ''}
                <span class="badge bg-${statusColors[pkg.status] || 'secondary'} ms-1">${pkg.status}</span>
              </h6>
              <div class="small text-muted">
                £${parseFloat(pkg.amount || 0).toLocaleString()} &middot; ${pkg.payment_schedule || 'one-time'}
                ${pkg.start_date ? ` &middot; ${new Date(pkg.start_date).toLocaleDateString('en-GB')}` : ''}
                ${pkg.end_date ? ` - ${new Date(pkg.end_date).toLocaleDateString('en-GB')}` : ''}
              </div>
              ${isExpiring ? `<div class="text-warning small fw-semibold mt-1"><i class="bi bi-exclamation-triangle me-1"></i>Renewal: ${new Date(pkg.renewal_date).toLocaleDateString('en-GB')}</div>` : ''}
              ${benefits.length > 0 ? `<div class="mt-1">${benefits.map(b => `<span class="badge bg-light text-dark me-1 mb-1" style="font-size:0.65rem;">${utils.escapeHtml(b)}</span>`).join('')}</div>` : ''}
            </div>
            <button class="btn btn-sm btn-outline-danger py-0" onclick="orgsModule.deleteSponsorshipPackage('${pkg.id}','${orgId}')"><i class="bi bi-trash"></i></button>
          </div>
        </div>
      </div>`;
    }).join('');
  },

  // ============================================
  // FEATURE 10: MAP VIEW FOR REGIONAL ANALYSIS
  // ============================================
  showMapView() {
    const regions = {};
    const counties = {};
    STATE.filteredOrganisations.forEach(org => {
      const r = org.region || 'Unknown';
      const c = org.county || 'Unknown';
      regions[r] = (regions[r] || 0) + 1;
      counties[c] = (counties[c] || 0) + 1;
    });

    const maxRegionCount = Math.max(...Object.values(regions), 1);
    const sortedRegions = Object.entries(regions).sort((a, b) => b[1] - a[1]);
    const sortedCounties = Object.entries(counties).sort((a, b) => b[1] - a[1]).slice(0, 25);

    const getHeatColor = (count) => {
      const intensity = Math.floor((count / maxRegionCount) * 255);
      return `rgb(${255 - intensity}, ${Math.floor(intensity * 0.6)}, ${Math.floor(intensity * 0.3)})`;
    };

    const html = `
      <div class="row">
        <div class="col-md-6">
          <h6 class="fw-semibold mb-3"><i class="bi bi-geo-alt me-2"></i>Regional Distribution</h6>
          <div style="max-height: 400px; overflow-y: auto;">
            ${sortedRegions.map(([region, count]) => {
              const pct = ((count / STATE.filteredOrganisations.length) * 100).toFixed(1);
              return `<div class="d-flex align-items-center mb-2 cursor-pointer" onclick="document.getElementById('orgsRegionFilter').value='${utils.escapeHtml(region)}'; orgsModule.filterOrganisations(); bootstrap.Modal.getInstance(document.getElementById('dynamicOrgModal'))?.hide();" style="cursor:pointer;">
                <div class="me-2" style="width: 20px; height: 20px; border-radius: 4px; background: ${getHeatColor(count)};"></div>
                <div class="flex-grow-1 small fw-semibold">${utils.escapeHtml(region)}</div>
                <div class="text-end">
                  <span class="badge bg-primary">${count}</span>
                  <span class="text-muted small ms-1">(${pct}%)</span>
                </div>
              </div>`;
            }).join('')}
          </div>
        </div>
        <div class="col-md-6">
          <h6 class="fw-semibold mb-3"><i class="bi bi-pin-map me-2"></i>Top Counties/Cities</h6>
          <div style="max-height: 400px; overflow-y: auto;">
            ${sortedCounties.map(([county, count]) => {
              const pct = ((count / STATE.filteredOrganisations.length) * 100).toFixed(1);
              const barWidth = (count / sortedCounties[0][1]) * 100;
              return `<div class="mb-2">
                <div class="d-flex justify-content-between small">
                  <span class="fw-semibold">${utils.escapeHtml(county)}</span>
                  <span>${count} (${pct}%)</span>
                </div>
                <div class="progress" style="height: 6px;">
                  <div class="progress-bar bg-info" style="width: ${barWidth}%"></div>
                </div>
              </div>`;
            }).join('')}
          </div>
        </div>
      </div>
      <div class="mt-3 pt-3 border-top">
        <h6 class="fw-semibold mb-2"><i class="bi bi-bar-chart me-2"></i>Coverage Summary</h6>
        <div class="row text-center">
          <div class="col-3">
            <div class="fw-bold text-primary fs-5">${sortedRegions.length}</div>
            <div class="text-muted small">Regions</div>
          </div>
          <div class="col-3">
            <div class="fw-bold text-info fs-5">${sortedCounties.length}</div>
            <div class="text-muted small">Counties</div>
          </div>
          <div class="col-3">
            <div class="fw-bold text-success fs-5">${sortedRegions[0] ? sortedRegions[0][0] : '-'}</div>
            <div class="text-muted small">Top Region</div>
          </div>
          <div class="col-3">
            <div class="fw-bold text-warning fs-5">${sortedRegions.length > 0 ? sortedRegions[sortedRegions.length - 1][0] : '-'}</div>
            <div class="text-muted small">Least Covered</div>
          </div>
        </div>
      </div>
    `;

    this._showDynamicModal('Map View - Regional Analysis', html, 'bi-map', 'modal-lg');
  },

  // ============================================
  // QUICK WIN: KEYBOARD SHORTCUTS
  // ============================================
  _keyboardShortcutsEnabled: false,
  _selectedRowIndex: -1,

  initKeyboardShortcuts() {
    if (this._keyboardShortcutsEnabled) return;
    this._keyboardShortcutsEnabled = true;

    document.addEventListener('keydown', (e) => {
      // Only active when organisations tab is visible
      const orgsTab = document.getElementById('organisations');
      if (!orgsTab || !orgsTab.classList.contains('active')) return;
      // Don't intercept when typing in inputs
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      const rows = document.querySelectorAll('#orgsTableBody tr');
      if (rows.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this._selectedRowIndex = Math.min(this._selectedRowIndex + 1, rows.length - 1);
        this._highlightRow(rows);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this._selectedRowIndex = Math.max(this._selectedRowIndex - 1, 0);
        this._highlightRow(rows);
      } else if (e.key === 'Enter' && this._selectedRowIndex >= 0) {
        e.preventDefault();
        const row = rows[this._selectedRowIndex];
        const link = row?.querySelector('a.text-primary');
        if (link) link.click();
      } else if (e.key === 'Escape') {
        // Close any open modal
        const openModal = document.querySelector('.modal.show');
        if (openModal) {
          bootstrap.Modal.getInstance(openModal)?.hide();
        } else {
          this._selectedRowIndex = -1;
          this._highlightRow(rows);
        }
      } else if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        document.getElementById('orgsSearchBox')?.focus();
      }
    });
  },

  _highlightRow(rows) {
    rows.forEach((row, i) => {
      row.style.outline = i === this._selectedRowIndex ? '2px solid #0d6efd' : '';
      row.style.outlineOffset = i === this._selectedRowIndex ? '-2px' : '';
      if (i === this._selectedRowIndex) row.scrollIntoView({ block: 'nearest' });
    });
  },

  // ============================================
  // QUICK WIN: DUPLICATE DETECTION ON ADD/IMPORT
  // ============================================
  checkDuplicateOnEntry(companyName) {
    if (!companyName || companyName.length < 3) return null;
    const dupes = this.findDuplicates(companyName);
    if (dupes.length > 0) {
      return dupes.map(d => d.company_name).slice(0, 5);
    }
    return null;
  },

  // ============================================
  // QUICK WIN: LAST CONTACTED COLUMN HELPER
  // ============================================
  async loadLastContactedDates() {
    try {
      const { data } = await STATE.client.from('organisation_comms_log')
        .select('organisation_id, created_at')
        .order('created_at', { ascending: false });
      const lastContacted = {};
      (data || []).forEach(r => {
        if (!lastContacted[r.organisation_id]) {
          lastContacted[r.organisation_id] = r.created_at;
        }
      });
      this._lastContactedMap = lastContacted;
    } catch (e) {
      this._lastContactedMap = {};
    }
  },

  _lastContactedMap: {},

  getLastContacted(orgId) {
    return this._lastContactedMap[orgId] || null;
  },

  // ============================================
  // SHARED DYNAMIC MODAL HELPER
  // ============================================
  // ============================================
  // SUPABASE REALTIME SUBSCRIPTIONS
  // ============================================
  _realtimeChannel: null,
  _realtimeDebounce: null,

  _subscribeToRealtimeChanges() {
    // Unsubscribe from any existing channel
    if (this._realtimeChannel) {
      STATE.client.removeChannel(this._realtimeChannel);
    }

    try {
      this._realtimeChannel = STATE.client
        .channel('orgs-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'organisations' }, (payload) => {
          this._handleRealtimeEvent(payload);
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('Organisations realtime: subscribed');
          }
        });
    } catch (e) {
      console.warn('Realtime subscription failed:', e.message);
    }
  },

  _handleRealtimeEvent(payload) {
    const { eventType, new: newRow, old: oldRow } = payload;

    if (eventType === 'INSERT' && newRow) {
      // Check if we already have this org (from our own insert)
      const exists = STATE.allOrganisations.find(o => o.id === newRow.id);
      if (!exists) {
        STATE.allOrganisations.push({ ...newRow, awards_count: 0 });
        this._debouncedRealtimeRefresh('New organisation added by another user');
      }
    } else if (eventType === 'UPDATE' && newRow) {
      const org = STATE.allOrganisations.find(o => o.id === newRow.id);
      if (org) {
        // Only trigger toast if this wasn't our own update (compare updated_at)
        const wasExternal = org.updated_at && newRow.updated_at && org.updated_at !== newRow.updated_at;
        Object.assign(org, newRow);
        const fOrg = STATE.filteredOrganisations.find(o => o.id === newRow.id);
        if (fOrg) Object.assign(fOrg, newRow);
        if (wasExternal) {
          this._debouncedRealtimeRefresh(`${newRow.company_name || 'Organisation'} updated`);
        }
      }
    } else if (eventType === 'DELETE' && oldRow) {
      STATE.allOrganisations = STATE.allOrganisations.filter(o => o.id !== oldRow.id);
      STATE.filteredOrganisations = STATE.filteredOrganisations.filter(o => o.id !== oldRow.id);
      this._debouncedRealtimeRefresh('Organisation removed');
    }
  },

  _debouncedRealtimeRefresh(message) {
    // Debounce to avoid hammering the UI during bulk operations
    clearTimeout(this._realtimeDebounce);
    this._realtimeDebounce = setTimeout(() => {
      this.renderOrganisations();
      this.calculateDashboardStats();
      // Show a subtle notification
      this._showRealtimeNotification(message);
    }, 1000);
  },

  _showRealtimeNotification(message) {
    document.getElementById('realtimeNotif')?.remove();
    const notifHtml = `<div id="realtimeNotif" class="position-fixed top-0 end-0 m-3 p-2 bg-info text-white rounded shadow-sm small d-flex align-items-center gap-2" style="z-index:9999; animation: fadeIn 0.3s;">
      <i class="bi bi-broadcast"></i>${utils.escapeHtml(message)}
    </div>`;
    document.body.insertAdjacentHTML('beforeend', notifHtml);
    setTimeout(() => document.getElementById('realtimeNotif')?.remove(), 4000);
  },

  // ============================================
  // SHARED DYNAMIC MODAL HELPER
  // ============================================
  _showDynamicModal(title, bodyHtml, icon, sizeClass) {
    document.getElementById('dynamicOrgModal')?.remove();
    const modalHtml = `<div class="modal fade" id="dynamicOrgModal" tabindex="-1">
      <div class="modal-dialog ${sizeClass || ''}"><div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title"><i class="bi ${icon || 'bi-info-circle'} me-2"></i>${title}</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">${bodyHtml}</div>
        <div class="modal-footer"><button class="btn btn-secondary" data-bs-dismiss="modal">Close</button></div>
      </div></div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    new bootstrap.Modal(document.getElementById('dynamicOrgModal')).show();
  }
};

// Export to window for global access
window.orgsModule = orgsModule;

/* ==================================================== */
/* ORGANISATIONS MODULE - ENHANCED VERSION */
/* ==================================================== */

const orgsModule = {
  _loading: false,

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

  // Pagination state
  _currentPage: 1,
  _pageSize: 50,

  // Server-side pagination state
  _serverPagination: false,
  _srvPagination: { page: 1, totalPages: 1, count: 0, pageSize: 50 },
  _srvFetchId: 0,

  // Column visibility state (persistent via localStorage)
  _columnVisibility: (() => {
    try {
      const saved = localStorage.getItem('orgsColumnVisibility');
      if (saved) return JSON.parse(saved);
      // Default: hide low-priority columns so the table fits on screen
      return { tags: false, county_city: false, lastContacted: false, health: false, updated: false };
    } catch (e) {
      return {};
    }
  })(),

  /**
   * Load all organisations from database
   * ENHANCED: Now calculates dashboard stats
   */
  async loadOrganisations() {
    if (this._loading) return;
    this._loading = true;
    try {
      utils.showLoading();
      utils.showSkeletonLoading('orgsTableBody', 10);

      // Populate filter dropdowns from constants
      this._populateFiltersFromConstants();

      // Initialize keyboard shortcuts
      this.initKeyboardShortcuts();

      // Wire sub-nav Bootstrap tabs
      this._initSubNavTabs();

      // Initialize inline validation for Add Company form when modal is shown
      const addOrgModalEl = document.getElementById('addNewOrgModal');
      if (addOrgModalEl && !addOrgModalEl._inlineValidationInit) {
        addOrgModalEl._inlineValidationInit = true;
        addOrgModalEl.addEventListener('shown.bs.modal', () => {
          utils.initInlineValidation('addCompanyForm');
        });
      }

      // Subscribe to realtime changes
      this._subscribeToRealtimeChanges();

      // Show overdue follow-up alert on page load
      this._showFollowUpAlert();

      // Restore filter state from localStorage
      const lsFilters = (() => {
        try {
          return JSON.parse(localStorage.getItem('orgsFilters') || '{}');
        } catch (e) {
          return {};
        }
      })();
      if (lsFilters.year) document.getElementById('orgsYearFilter').value = lsFilters.year;
      if (lsFilters.sector) document.getElementById('orgsSectorFilter').value = lsFilters.sector;
      if (lsFilters.country) document.getElementById('orgsCountryFilter').value = lsFilters.country;
      if (lsFilters.areaId) document.getElementById('orgsAreaFilter').value = lsFilters.areaId;
      if (lsFilters.status) document.getElementById('orgsStatusFilter').value = lsFilters.status;
      if (lsFilters.search) document.getElementById('orgsSearchBox').value = lsFilters.search;

      // Enable server-side pagination and fetch first page with active filters
      this._serverPagination = true;
      await this._srvFetchPage(1);

      // Calculate dashboard stats AFTER first page is loaded
      await this.calculateDashboardStats();

      this._initLocationFilters(lsFilters.country || '', lsFilters.regionId || '', lsFilters.areaId || '');
      this.populateSectorFilter();
      this.populateSectorSuggestions();
      utils.populateYearFilterFromDB('orgsYearFilter', { selectCurrent: true });
      utils.trackDataLoad('organisations');
    } catch (error) {
      console.error('Error loading organisations:', error);
      console.error('Error details:', error.details, error.hint, error.message);
      utils.showErrorWithRetry(error, 'loading organisations', () => this.loadOrganisations());
      utils.showEmptyState('orgsTableBody', 10, 'Failed to load organisations', 'bi-exclamation-triangle');
    } finally {
      utils.hideLoading();
      this._loading = false;
    }
  },

  // ============================================
  // State for advanced filters
  // ============================================
  _filterMissingField: null,

  // ============================================
  // Calculate dashboard statistics (Enhanced)
  // ============================================
  /**
   * Calculate and render dashboard KPI stats for organisations (counts, pipeline, alerts).
   * @returns {Promise<void>}
   */
  async calculateDashboardStats() {
    try {
      const totalCount = this._srvPagination?.count || STATE.allOrganisations.length;

      // Count organisations with award assignments (already computed during load)
      const activeNominees = STATE.allOrganisations.filter((o) => o.awards_count > 0).length;

      // New this month
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const newThisMonth = STATE.allOrganisations.filter((org) => {
        const created = new Date(org.created_at);
        return created >= monthStart;
      }).length;

      // Missing data indicators
      const missingEmail = STATE.allOrganisations.filter((o) => !o.email).length;
      const missingLogo = STATE.allOrganisations.filter((o) => !o.logo_url).length;

      // Pipeline counts (exclude archived)
      const statusCounts = {
        prospect: 0,
        entrant: 0,
        nominee: 0,
        shortlisted: 0,
        winner: 0,
        sponsor: 0,
        past_winner: 0,
      };
      STATE.allOrganisations.forEach((org) => {
        const s = org.status || 'prospect';
        if (statusCounts[s] !== undefined) statusCounts[s]++;
      });

      // Find top sector
      const sectorCounts = {};
      STATE.allOrganisations.forEach((org) => {
        if (org.sector) {
          sectorCounts[org.sector] = (sectorCounts[org.sector] || 0) + 1;
        }
      });

      const topSectorEntry = Object.entries(sectorCounts).sort((a, b) => b[1] - a[1])[0];
      const topSector = topSectorEntry ? topSectorEntry[0] : '-';

      // Update dashboard UI
      const set = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
      };
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
      const setConv = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val + '%';
      };
      setConv('orgsConvProspectEntrant', convRates.prospect_to_entrant || 0);
      setConv('orgsConvEntrantNominee', convRates.entrant_to_nominee || 0);
      setConv('orgsConvNomineeShortlisted', convRates.nominee_to_shortlisted || 0);
      setConv('orgsConvShortlistedWinner', convRates.shortlisted_to_winner || 0);

      // Enhanced KPI calculations (Feature 6)
      const sponsorCount = statusCounts.sponsor || 0;
      set('orgsSponsorCount', sponsorCount);

      // At-risk: stale (180+ days) with no recent activity
      const atRisk = STATE.allOrganisations.filter((o) => {
        const days = o.updated_at ? Math.floor((Date.now() - new Date(o.updated_at).getTime()) / 86400000) : 999;
        return days > 180 && (o.status || 'prospect') !== 'archived';
      }).length;
      set('orgsAtRiskCount', atRisk);

      // Average engagement score
      const scores = STATE.allOrganisations
        .filter((o) => (o.status || 'prospect') !== 'archived')
        .map((o) => this.calculateEngagementScore(o));
      const avgEngagement = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      set('orgsAvgEngagement', avgEngagement + '%');

      // Revenue by tier
      const tierRevenue = {};
      STATE.allOrganisations.forEach((org) => {
        if (org.tier) tierRevenue[org.tier] = (tierRevenue[org.tier] || 0) + 1;
      });
      const topTier = Object.entries(tierRevenue).sort((a, b) => b[1] - a[1])[0];
      set('orgsTopTier', topTier ? `${topTier[0]} (${topTier[1]})` : '-');

      // Load overdue follow-ups for the dashboard widget
      await this.loadOverdueFollowUps();
    } catch (error) {
      console.error('Error calculating dashboard stats:', error);
    }
  },

  /**
   * Populate filter dropdowns with unique values (Enhanced)
   */
  populateFilters() {
    // Sector, region, and county filters are populated from DB
    // via populateSectorFilter() and _initLocationFilters().
    // This method handles tag filter and saved presets.

    // Populate tag filter
    const allTags = new Set();
    STATE.allOrganisations.forEach((o) => {
      if (o.tags && Array.isArray(o.tags)) {
        o.tags.forEach((t) => allTags.add(t));
      }
    });
    const tagSelect = document.getElementById('orgsTagFilter');
    if (tagSelect) {
      tagSelect.innerHTML =
        '<option value="">All Tags</option>' +
        [...allTags]
          .sort()
          .map((t) => `<option value="${utils.escapeHtml(t)}">${utils.escapeHtml(t)}</option>`)
          .join('');
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
      if (saved.country) {
        const el = document.getElementById('orgsCountryFilter');
        if (el) el.value = saved.country;
      }
      locationModule.populateRegionDropdown(
        'orgsRegionFilter',
        saved.country || '',
        'All Regions',
        saved.regionId || ''
      );
      if (saved.regionId) {
        const el = document.getElementById('orgsRegionFilter');
        if (el) el.value = saved.regionId;
      }
      locationModule.populateAreaDropdown(
        'orgsAreaFilter',
        saved.country || '',
        'All',
        saved.areaId || '',
        saved.regionId || ''
      );
      if (saved.areaId) {
        const el = document.getElementById('orgsAreaFilter');
        if (el) el.value = saved.areaId;
      }
      if (saved.status) {
        const el = document.getElementById('orgsStatusFilter');
        if (el) el.value = saved.status;
      }
      if (saved.search) {
        const el = document.getElementById('orgsSearchBox');
        if (el) el.value = saved.search;
      }
    } catch (e) {
      /* ignore */
    }
  },

  /**
   * Initialise country + area filter dropdowns using locationModule cache.
   * Also populates Add Company and CSV import area dropdowns.
   * @param {string} [country]  - pre-selected country
   * @param {string} [areaId]   - pre-selected area UUID
   */
  async _initLocationFilters(country = '', regionId = '', areaId = '') {
    try {
      await locationModule.loadAreas();
      locationModule.populateCountryDropdown('orgsCountryFilter', 'All');
      if (country) {
        const el = document.getElementById('orgsCountryFilter');
        if (el) el.value = country;
      }
      locationModule.populateRegionDropdown('orgsRegionFilter', country, 'All Regions', regionId);
      locationModule.populateAreaDropdown('orgsAreaFilter', country, 'All', areaId, regionId);

      // Also populate the Add Company and CSV area dropdowns (grouped by country)
      this._populateFormAreaDropdowns();
    } catch (e) {
      console.warn('Could not init org location filters:', e.message);
    }
  },

  /**
   * Populate the Add Company and CSV import area dropdowns from locationModule cache.
   */
  _populateFormAreaDropdowns() {
    const areas = locationModule._cachedAreas || [];
    if (!areas.length) return;

    const grouped = { England: [], Scotland: [], Wales: [] };
    areas.forEach((a) => {
      if (grouped[a.country]) grouped[a.country].push(a);
    });

    const optgroupHtml = Object.keys(grouped)
      .filter((c) => grouped[c].length > 0)
      .map(
        (c) =>
          `<optgroup label="${utils.escapeHtml(c)}">${grouped[c]
            .map((a) => `<option value="${a.id}">${utils.escapeHtml(a.display_name)}</option>`)
            .join('')}</optgroup>`
      )
      .join('');

    const addSelect = document.getElementById('newCompanyArea');
    if (addSelect) {
      addSelect.innerHTML = '<option value="">-- Select Area --</option>' + optgroupHtml;
    }

    // CSV import's area select stores the area's display name (not its UUID),
    // since executeCSVImport() writes it straight into organisations.catchment_area
    // as free text — a separate option list, keyed by name, keeps that contract.
    const csvOptgroupHtml = Object.keys(grouped)
      .filter((c) => grouped[c].length > 0)
      .map(
        (c) =>
          `<optgroup label="${utils.escapeHtml(c)} Areas">${grouped[c]
            .map(
              (a) => `<option value="${utils.escapeHtml(a.display_name)}">${utils.escapeHtml(a.display_name)}</option>`
            )
            .join('')}</optgroup>`
      )
      .join('');
    const csvSelect = document.getElementById('csvCountySelect');
    if (csvSelect) {
      csvSelect.innerHTML = '<option value="">-- Select Area --</option>' + csvOptgroupHtml;
    }
  },

  /**
   * Called when the country filter changes — repopulates area dropdown and re-filters.
   */
  onCountryFilterChange() {
    const country = document.getElementById('orgsCountryFilter')?.value || '';
    const regionEl = document.getElementById('orgsRegionFilter');
    if (regionEl) regionEl.value = '';
    locationModule.populateRegionDropdown('orgsRegionFilter', country, 'All Regions');
    locationModule.populateAreaDropdown('orgsAreaFilter', country, 'All');
    this.filterOrganisations();
  },

  onRegionFilterChange() {
    const country = document.getElementById('orgsCountryFilter')?.value || '';
    const regionId = document.getElementById('orgsRegionFilter')?.value || '';
    const areaEl = document.getElementById('orgsAreaFilter');
    if (areaEl) areaEl.value = '';
    locationModule.populateAreaDropdown('orgsAreaFilter', country, 'All', '', regionId);
    this.filterOrganisations();
  },

  /**
   * Called when the country field in Add Company modal changes.
   */
  onAddCompanyCountryChange() {
    const country = document.getElementById('newCompanyCountry')?.value || '';
    locationModule.populateAreaDropdown('newCompanyArea', country, '-- Select Area --');
  },

  /**
   * Populate filter dropdowns from known constants
   */
  _populateFiltersFromConstants() {
    const sectorSelect = document.getElementById('orgsSectorFilter');
    if (sectorSelect) {
      sectorSelect.innerHTML =
        '<option value="">All</option>' +
        SECTORS.map(
          (s) => `<option value="${utils.escapeHtml(s)}">${utils.escapeHtml(utils.toTitleCase(s))}</option>`
        ).join('');
    }
    // Location filters are populated via _initLocationFilters()
  },

  /**
   * Build server-side filters from current DOM filter state
   */
  _buildOrgServerFilters() {
    const filters = {};
    const status = document.getElementById('orgsStatusFilter')?.value;
    const sector = document.getElementById('orgsSectorFilter')?.value;
    const areaId = document.getElementById('orgsAreaFilter')?.value;
    const country = document.getElementById('orgsCountryFilter')?.value;

    // Note: year is not a column on organisations — it is derived from linked
    // awards during enrichment, so year filtering is applied post-fetch in _srvFetchPage.
    if (status && status !== 'all') filters.status = status;
    if (sector) filters.sector = sector;
    if (areaId) {
      filters.area_id = areaId;
    } else if (country) {
      filters.country = country;
    }
    return filters;
  },

  /**
   * Fetch a specific page of organisations from the server
   */
  async _srvFetchPage(page) {
    const fetchId = ++this._srvFetchId;
    const filters = this._buildOrgServerFilters();
    const search = document.getElementById('orgsSearchBox')?.value?.trim();

    const sortCol = this.sortField || 'company_name';
    const sortAsc = this.sortDirection === 'asc';

    const result = await apiClient.select('organisations', {
      filters,
      search: search ? { term: search, columns: ['company_name', 'contact_name', 'email'] } : undefined,
      sort: { column: sortCol, ascending: sortAsc },
      page,
      pageSize: this._pageSize,
    });

    if (fetchId !== this._srvFetchId) return;

    let pageData = result.data || [];

    // Enrich page data with award assignments (sets org.year from linked awards)
    await this._enrichOrgPageData(pageData);

    // Year filter is applied post-fetch because year is derived from linked awards,
    // not stored directly on the organisations table.
    const year = document.getElementById('orgsYearFilter')?.value;
    if (year) {
      pageData = pageData.filter((org) => !org.year || String(org.year) === String(year));
    }

    STATE.allOrganisations = pageData;
    STATE.filteredOrganisations = pageData;
    this._srvPagination = {
      page: result.page,
      totalPages: result.totalPages,
      count: result.count,
      pageSize: result.pageSize,
    };
    this._currentPage = 1; // client-side pagination within the server page is not needed

    this.renderOrganisations();
  },

  /**
   * Enrich a page of organisation records with award/county/region data
   */
  async _enrichOrgPageData(orgs) {
    if (!orgs.length) return;
    const orgIds = orgs.map((o) => o.id).filter(Boolean);

    try {
      // Batch lookup assignments for orgs on this page (include status for V17-L9 winner check)
      const { data: assignments } = await apiClient.select('award_assignments', {
        select: 'organisation_id, award_id, status',
        filters: { organisation_id: { op: 'in', value: orgIds } },
        pageSize: 1000,
      });

      // Collect unique award IDs and track actual winner assignments (V17-L9)
      const orgAwardMap = {};
      const orgAwardsCount = {};
      const orgActualWins = {}; // V17-L9: set to true if any assignment has status='winner'
      (assignments || []).forEach((a) => {
        if (!orgAwardMap[a.organisation_id]) orgAwardMap[a.organisation_id] = a.award_id;
        orgAwardsCount[a.organisation_id] = (orgAwardsCount[a.organisation_id] || 0) + 1;
        if (a.status === 'winner') orgActualWins[a.organisation_id] = true;
      });

      // Fetch award details for enrichment
      const awardIds = [...new Set(Object.values(orgAwardMap))];
      const awardMap = {};
      if (awardIds.length > 0) {
        const { data: awardData } = await apiClient.select('awards', {
          select: 'id, area_id, country, sector, year',
          filters: { id: { op: 'in', value: awardIds } },
          pageSize: 1000,
        });
        (awardData || []).forEach((a) => {
          awardMap[a.id] = a;
        });
      }

      // Attach enriched data
      orgs.forEach((org) => {
        const awardId = orgAwardMap[org.id];
        const award = awardMap[awardId];
        // Use org's own area_id/country if set, otherwise fall back to linked award
        if (!org.area_id && award?.area_id) org.area_id = award.area_id;
        if (!org.country && award?.country) org.country = award.country;
        org.sector = award?.sector || org.sector || null;
        org.year = award?.year || org.year || null;
        org.awards_count = orgAwardsCount[org.id] || 0;
        // V17-L9: ground-truth winner flag from award_assignments
        org._hasActualWins = !!orgActualWins[org.id];
      });
    } catch (err) {
      console.warn('Failed to enrich org data:', err.message);
    }
  },

  /**
   * Navigate to a specific page (called from pagination controls)
   */
  async _srvGoToPage(page) {
    page = Math.max(1, Math.min(page, this._srvPagination.totalPages));
    if (page === this._srvPagination.page) return;
    try {
      utils.showLoading();
      await this._srvFetchPage(page);
    } catch (error) {
      console.error('Error navigating orgs page:', error);
      utils.showToast('Error loading page: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Filter organisations based on all filters (Enhanced)
   */
  filterOrganisations() {
    const year = document.getElementById('orgsYearFilter')?.value || '';
    const sector = document.getElementById('orgsSectorFilter')?.value || '';
    const areaId = document.getElementById('orgsAreaFilter')?.value || '';
    const country = document.getElementById('orgsCountryFilter')?.value || '';
    const regionId = document.getElementById('orgsRegionFilter')?.value || '';
    const status = document.getElementById('orgsStatusFilter')?.value || '';
    const search = document.getElementById('orgsSearchBox')?.value.toLowerCase().trim() || '';
    const tier = document.getElementById('orgsTierFilter')?.value || '';
    const tag = document.getElementById('orgsTagFilter')?.value || '';
    const logoFilter = document.getElementById('orgsLogoFilter')?.value || '';
    const dateFilter = document.getElementById('orgsDateFilter')?.value || '';
    const missingField = this._filterMissingField || '';

    // Save filters to localStorage
    try {
      localStorage.setItem(
        'orgsFilters',
        JSON.stringify({ year, sector, country, regionId, areaId, status, search, tier, tag, logoFilter, dateFilter })
      );
    } catch (e) {
      /* ignore */
    }

    // Server-side pagination: send filters to server and re-fetch page 1
    if (this._serverPagination) {
      this._srvFetchPage(1).catch((err) => {
        console.error('Error filtering organisations:', err);
        utils.showToast('Error filtering organisations: ' + err.message, 'error');
      });
      return;
    }

    // Client-side fallback (used by tests and when data is pre-loaded)
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

    STATE.filteredOrganisations = STATE.allOrganisations.filter((org) => {
      const orgStatus = org.status || 'prospect';

      // Hide archived unless explicitly filtering for them
      if (!showArchived && orgStatus === 'archived') return false;

      // Year filter — show orgs assigned to the selected year AND unassigned orgs (no year).
      // Only hide orgs explicitly assigned to a different year.
      if (year && org.year && String(org.year) !== String(year)) return false;

      // Status filter (skip if 'all')
      if (status && status !== 'all' && orgStatus !== status) return false;

      // Sector filter
      if (sector && org.sector !== sector) return false;

      // Area filter (most specific — subsumes region and country)
      if (areaId && org.area_id !== areaId) return false;

      // Region filter (only when no specific area selected)
      if (regionId && !areaId) {
        const area = locationModule.getAreaById(org.area_id);
        if (!area || area.region_id !== regionId) return false;
      }

      // Country filter (only when no area or region selected)
      if (country && !areaId && !regionId && org.country !== country) return false;

      // Tier filter
      if (tier && (org.tier || '') !== tier) return false;

      // Tag filter (single dropdown)
      if (tag && !(org.tags && org.tags.includes(tag))) return false;

      // Multi-tag filter (AND logic)
      if (this._selectedTagFilters && this._selectedTagFilters.length > 0) {
        if (!this._selectedTagFilters.every((t) => org.tags && org.tags.includes(t))) return false;
      }

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
          org.company_name,
          org.contact_name,
          org.email,
          org.website,
          org.notes,
          org.county,
          org.sector,
          org.county_city,
          org.catchment_area,
          org.address,
          orgStatus,
          org.tier,
          tagStr,
          org.contact_phone,
        ].map((f) => (f || '').toLowerCase());

        if (!searchFields.some((f) => f.includes(search))) {
          return false;
        }
      }

      return true;
    });

    // If search query is active and no exact matches found, try fuzzy search
    if (search && STATE.filteredOrganisations.length === 0) {
      STATE.filteredOrganisations = utils.fuzzyFilter(STATE.allOrganisations, search, [
        'company_name',
        'contact_name',
        'email',
      ]);
      // Also apply non-search filters to fuzzy results
      if (year)
        STATE.filteredOrganisations = STATE.filteredOrganisations.filter(
          (o) => !o.year || String(o.year) === String(year)
        );
      if (status && status !== 'all')
        STATE.filteredOrganisations = STATE.filteredOrganisations.filter((o) => (o.status || 'prospect') === status);
      if (sector) STATE.filteredOrganisations = STATE.filteredOrganisations.filter((o) => o.sector === sector);
      if (areaId) STATE.filteredOrganisations = STATE.filteredOrganisations.filter((o) => o.area_id === areaId);
      if (country && !areaId)
        STATE.filteredOrganisations = STATE.filteredOrganisations.filter((o) => o.country === country);
      if (tier) STATE.filteredOrganisations = STATE.filteredOrganisations.filter((o) => (o.tier || '') === tier);
    }

    // Clear the missing field filter after applying it once
    this._filterMissingField = null;

    // Reset to page 1 when filters change
    this._currentPage = 1;

    this.renderOrganisations();
    utils.renderFilterChips('orgsActiveFilters', [
      { label: 'Year', fieldId: 'orgsYearFilter', clearAction: 'orgsModule.clearFilter' },
      { label: 'Status', fieldId: 'orgsStatusFilter', clearAction: 'orgsModule.clearFilter' },
      { label: 'Sector', fieldId: 'orgsSectorFilter', clearAction: 'orgsModule.clearFilter' },
      { label: 'Country', fieldId: 'orgsCountryFilter', clearAction: 'orgsModule.clearFilter' },
      { label: 'Region', fieldId: 'orgsRegionFilter', clearAction: 'orgsModule.clearFilter' },
      { label: 'Area', fieldId: 'orgsAreaFilter', clearAction: 'orgsModule.clearFilter' },
      { label: 'Tier', fieldId: 'orgsTierFilter', clearAction: 'orgsModule.clearFilter' },
      { label: 'Tag', fieldId: 'orgsTagFilter', clearAction: 'orgsModule.clearFilter' },
      { label: 'Logo', fieldId: 'orgsLogoFilter', clearAction: 'orgsModule.clearFilter' },
      { label: 'Date', fieldId: 'orgsDateFilter', clearAction: 'orgsModule.clearFilter' },
      { label: 'Search', fieldId: 'orgsSearchBox', clearAction: 'orgsModule.clearFilter' },
    ]);
  },

  clearFilter(fieldId) {
    const el = document.getElementById(fieldId);
    if (!el) return;
    el.value = '';
    if (fieldId === 'orgsCountryFilter') {
      const regionEl = document.getElementById('orgsRegionFilter');
      if (regionEl) regionEl.value = '';
      locationModule.populateRegionDropdown('orgsRegionFilter', '', 'All Regions');
      locationModule.populateAreaDropdown('orgsAreaFilter', '', 'All');
    } else if (fieldId === 'orgsRegionFilter') {
      const country = document.getElementById('orgsCountryFilter')?.value || '';
      const areaEl = document.getElementById('orgsAreaFilter');
      if (areaEl) areaEl.value = '';
      locationModule.populateAreaDropdown('orgsAreaFilter', country, 'All');
    }
    this.filterOrganisations();
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

    // Server-side: data is already one page; client-side: slice locally
    let pageOrgs, totalFiltered;
    if (this._serverPagination) {
      pageOrgs = STATE.filteredOrganisations;
      totalFiltered = this._srvPagination.count;
      const from = (this._srvPagination.page - 1) * this._srvPagination.pageSize + 1;
      const to = Math.min(this._srvPagination.page * this._srvPagination.pageSize, totalFiltered);
      if (count) count.textContent = String(totalFiltered);
      if (showing) showing.textContent = pageOrgs.length > 0 ? `${from}-${to}` : '0';
      if (total) total.textContent = String(totalFiltered);
    } else {
      totalFiltered = STATE.filteredOrganisations.length;
      const totalPages = Math.max(1, Math.ceil(totalFiltered / this._pageSize));
      if (this._currentPage > totalPages) this._currentPage = totalPages;
      if (this._currentPage < 1) this._currentPage = 1;
      const startIdx = (this._currentPage - 1) * this._pageSize;
      const endIdx = Math.min(startIdx + this._pageSize, totalFiltered);
      pageOrgs = STATE.filteredOrganisations.slice(startIdx, endIdx);
      if (count) count.textContent = totalFiltered;
      if (showing) showing.textContent = pageOrgs.length > 0 ? `${startIdx + 1}-${endIdx}` : '0';
      if (total) total.textContent = STATE.allOrganisations.length;
    }
    const orgsCountLabel = document.getElementById('orgsCountLabel');
    if (orgsCountLabel) orgsCountLabel.textContent = utils.pluralize(totalFiltered, 'organisation');
    if (lastRefresh) {
      const now = new Date();
      lastRefresh.textContent = 'just now';
      lastRefresh.title = now.toLocaleTimeString('en-GB');
      clearInterval(lastRefresh._relTimer);
      lastRefresh._relTimer = setInterval(() => {
        const secs = Math.round((Date.now() - now.getTime()) / 1000);
        lastRefresh.textContent =
          secs < 60
            ? `${secs}s ago`
            : secs < 3600
              ? `${Math.floor(secs / 60)}m ago`
              : `${Math.floor(secs / 3600)}h ago`;
      }, 15000);
    }
    utils.renderRowCount('orgsRowCount', pageOrgs.length, totalFiltered, 'organisations');

    // Column visibility helper
    const isColVisible = (col) => this._columnVisibility[col] !== false;

    // Dynamic phone column header
    const phoneHeaderEl = document.getElementById('phoneColHeader');
    if (phoneHeaderEl) phoneHeaderEl.style.display = this._showPhoneColumn ? '' : 'none';

    // Apply column visibility to table headers
    const colVisMap = {
      sector: 2,
      county: 3,
      contact: 4,
      email: 5,
      tier: 6,
      tags: 7,
      county_city: 8,
      status: 9,
      awards: 10,
      // phone is at th[11], handled separately — skip to 12
      updated: 12,
      lastContacted: 13,
      health: 14,
    };
    const thead = tbody.closest('table')?.querySelector('thead tr');
    if (thead) {
      const ths = thead.querySelectorAll('th');
      Object.entries(colVisMap).forEach(([col, idx]) => {
        if (ths[idx]) ths[idx].style.display = isColVisible(col) ? '' : 'none';
      });
    }

    const visibleColCount =
      2 + Object.keys(colVisMap).filter((c) => isColVisible(c)).length + (this._showPhoneColumn ? 1 : 0) + 1;

    if (totalFiltered === 0) {
      const hasActiveFilters = !!(
        document.getElementById('orgsYearFilter')?.value ||
        document.getElementById('orgsSectorFilter')?.value ||
        document.getElementById('orgsCountryFilter')?.value ||
        document.getElementById('orgsRegionFilter')?.value ||
        document.getElementById('orgsAreaFilter')?.value ||
        document.getElementById('orgsStatusFilter')?.value ||
        document.getElementById('orgsSearchBox')?.value
      );
      utils.showEnhancedEmptyState('orgsTableBody', visibleColCount, {
        icon: 'bi-building',
        message: hasActiveFilters ? 'No organisations match your filters' : 'No organisations yet',
        description: hasActiveFilters
          ? 'Try clearing your filters or search terms'
          : 'Add your first organisation to get started',
        isFiltered: hasActiveFilters,
        clearAction: hasActiveFilters ? 'orgsModule.resetFilters' : '',
        actionLabel: hasActiveFilters ? '' : 'Add Organisation',
        actionAction: hasActiveFilters ? '' : 'orgsModule.openAddOrgModal',
      });
      this._renderPaginationControls(0, 1);
      return;
    }

    const cv = (col) => (isColVisible(col) ? '' : 'display:none;');

    tbody.innerHTML = pageOrgs
      .map((org) => {
        const isSelected = this.selectedOrgs.has(org.id);
        const awardsCount = org.awards_count || 0;
        const escapedName = (org.company_name || '')
          .replace(/<[^>]*>/g, '')
          .replace(/'/g, '&#39;')
          .replace(/"/g, '&quot;');
        const tierColors = { Bronze: '#CD7F32', Silver: '#C0C0C0', Gold: '#FFD700', Platinum: '#E5E4E2' };
        const tierColor = tierColors[org.tier] || '';
        const updatedDate = org.updated_at || org.created_at;

        return `
      <tr class="fade-in ${isSelected ? 'table-active' : ''}">
        <td class="text-center">
          <input type="checkbox" class="form-check-input"
                 ${isSelected ? 'checked' : ''}
                 data-on-change="orgsModule.toggleOrgSelection" data-id="${org.id}">
        </td>
        <td>
          <div class="d-flex align-items-center">
            ${
              org.logo_url
                ? `<img src="${org.logo_url}" alt="${utils.escapeHtml(org.company_name)}"
                   class="me-2 rounded" style="width: 40px; height: 28px; object-fit: contain; border: 1px solid #e0e0e0;">`
                : `<div class="me-2 d-flex align-items-center justify-content-center rounded"
                   style="width: 40px; height: 28px; background: #f5f5f5; border: 1px solid #e0e0e0;">
                <i class="bi bi-building text-muted" style="font-size: 0.8rem;"></i>
              </div>`
            }
            <a class="text-primary text-decoration-none fw-semibold"
               style="cursor: pointer;"
               data-action="orgsModule.openCompanyProfile" data-args='${JSON.stringify([org.id, escapedName])}'>
              ${utils.highlightMatch(org.company_name || 'N/A', document.getElementById('orgsSearchBox')?.value)}
            </a>
          </div>
        </td>
        <td style="${cv('sector')}cursor: pointer;" data-on-dblclick="orgsModule.startInlineEdit" data-args='${JSON.stringify([org.id, 'sector', org.sector || ''])}' title="Double-click to edit">
          <span class="badge bg-info-subtle text-info small">
            ${utils.escapeHtml(utils.toTitleCase(org.sector) || '-')}
          </span>
        </td>
        <td style="${cv('county')}">
          <span class="badge bg-primary-subtle text-primary small">
            ${utils.escapeHtml(org.county || '-')}
          </span>
        </td>
        <td class="small" style="${cv('contact')}cursor: pointer;" data-on-dblclick="orgsModule.startInlineEdit" data-args='${JSON.stringify([org.id, 'contact', org.contact_name || ''])}' title="Double-click to edit">
          ${utils.escapeHtml(org.contact_name ? (org.contact_name.length > 18 ? org.contact_name.substring(0, 18) + '...' : org.contact_name) : '-')}
        </td>
        <td class="small org-email-cell" style="${cv('email')}cursor: pointer;" data-on-dblclick="orgsModule.startInlineEdit" data-args='${JSON.stringify([org.id, 'email', org.email || ''])}' title="Double-click to edit">
          ${
            org.email
              ? `<a href="mailto:${org.email}" class="text-decoration-none" title="${utils.escapeHtml(org.email)}">
              ${org.email.length > 22 ? utils.escapeHtml(org.email.substring(0, 22)) + '...' : utils.escapeHtml(org.email)}
            </a>`
              : '-'
          }
        </td>
        <td class="text-center" style="${cv('tier')}">
          ${
            org.tier
              ? `<span class="badge" style="background: ${tierColor}; color: ${org.tier === 'Gold' || org.tier === 'Silver' || org.tier === 'Platinum' ? '#000' : '#fff'}; font-size: 0.7rem;">
              ${utils.escapeHtml(org.tier)}
            </span>`
              : '<span class="text-muted small">-</span>'
          }
        </td>
        <td style="${cv('tags')}">
          ${
            org.tags && org.tags.length > 0
              ? org.tags
                  .slice(0, 3)
                  .map(
                    (t) =>
                      `<span class="badge bg-secondary me-1" style="font-size: 0.65rem;">${utils.escapeHtml(t)}</span>`
                  )
                  .join('') +
                (org.tags.length > 3
                  ? `<span class="text-muted" style="font-size: 0.65rem;">+${org.tags.length - 3}</span>`
                  : '')
              : '<span class="text-muted small">-</span>'
          }
        </td>
        <td style="${cv('county_city')}">
          <span class="badge bg-success-subtle text-success small">
            ${utils.escapeHtml(org.area_id ? locationModule.getAreaName(org.area_id) : org.country || org.county_city || '-')}
          </span>${org.area_id ? locationModule.sizeBadgeHtml(org.area_id) : ''}
        </td>
        <td class="text-center" style="${cv('status')}">
          <select class="form-select form-select-sm border-0 p-0 text-center"
                  style="font-size: 0.75rem; background-position: right 0.25rem center; padding-right: 1.2rem !important; cursor: pointer;"
                  data-on-change="orgsModule.quickUpdateStatus" data-id="${org.id}"
                  title="Click to change status">
            ${this._getStatusOptions(org.status || 'prospect')
              .map(
                (s) =>
                  `<option value="${s.value}" ${(org.status || 'prospect') === s.value ? 'selected' : ''}>${s.label}</option>`
              )
              .join('')}
          </select>
          ${
            // V17-L9: Show ground-truth "Previous Winner" badge when org has actual winner
            // assignments but the manual status field doesn't reflect it
            org._hasActualWins && org.status !== 'winner' && org.status !== 'past_winner'
              ? '<span class="badge bg-warning text-dark d-block mt-1" style="font-size:0.6rem;" title="Has won an award based on judging records"><i class="bi bi-award me-1"></i>Prev. Winner</span>'
              : ''
          }
        </td>
        ${this._showPhoneColumn ? `<td class="small">${utils.escapeHtml(org.contact_phone || '-')}</td>` : ''}
        <td class="text-center" style="${cv('awards')}">
          ${
            awardsCount > 0
              ? `<span class="badge bg-warning text-dark">${awardsCount}</span>`
              : `<span class="text-muted">-</span>`
          }
        </td>
        <td class="text-center small text-muted" style="${cv('updated')}" title="${updatedDate ? new Date(updatedDate).toLocaleDateString('en-GB') : 'N/A'}">
          ${updatedDate ? this._timeAgo(new Date(updatedDate)) : '-'}
        </td>
        <td class="text-center small text-muted" style="${cv('lastContacted')}" title="Last contacted">
          ${(() => {
            const lc = this.getLastContacted(org.id);
            return lc ? this._timeAgo(new Date(lc)) : '<span class="text-muted">-</span>';
          })()}
        </td>
        <td class="text-center" style="${cv('health')}">
          ${(() => {
            const h = this.getOrgHealthIndicator(org);
            return `<i class="bi ${h.icon} text-${h.color}" title="${h.label}" aria-label="Health: ${h.label}" style="font-size: 0.85rem;"></i>`;
          })()}
        </td>
        <td class="text-center">
          <div class="btn-group btn-group-sm">
            <button class="btn btn-sm btn-outline-secondary"
                    data-action="orgsModule.openCompanyProfile" data-args='${JSON.stringify([org.id, escapedName])}'
                    title="View Profile">
              <i class="bi bi-eye"></i>
            </button>
            ${
              (org.status || 'prospect') === 'archived'
                ? `<button class="btn btn-sm btn-outline-success"
                      data-action="orgsModule.restoreOrganisation" data-args='${JSON.stringify([org.id, escapedName])}'
                      title="Restore"><i class="bi bi-arrow-counterclockwise"></i></button>`
                : `<button class="btn btn-sm btn-outline-danger"
                      data-action="orgsModule.deleteOrganisation" data-args='${JSON.stringify([org.id, escapedName])}'
                      title="Archive"><i class="bi bi-archive"></i></button>`
            }
          </div>
        </td>
      </tr>
    `;
      })
      .join('');

    this.updateSortIndicators();

    // Use server-side pagination controls when in server mode
    if (this._serverPagination) {
      // Create pagination container if needed
      let pagEl = document.getElementById('orgsPagination');
      if (!pagEl) {
        pagEl = document.createElement('div');
        pagEl.id = 'orgsPagination';
        const footer = document.querySelector('#orgTableContainer .card-footer');
        if (footer) footer.appendChild(pagEl);
      }
      utils.renderServerPagination('orgsPagination', this._srvPagination, 'orgsModule._srvGoToPage');
    } else {
      const totalPages = Math.max(1, Math.ceil(totalFiltered / this._pageSize));
      this._renderPaginationControls(totalFiltered, totalPages);
    }
  },
  /**
   * Open company profile modal
   * @param {string} orgId - Organisation ID
   * @param {string} companyName - Company name for display
   */

  async openCompanyProfile(orgId, companyName) {
    utils.trackRecentlyViewed('organisation', orgId, companyName);
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

    // Show print button
    const printBtn = document.getElementById('printProfileBtn');
    if (printBtn) {
      printBtn.style.display = '';
      printBtn.onclick = () => this.printCompanyProfile(orgId);
    }

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
    const _backdrop = document.querySelector('.modal-backdrop');

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
      // Use already-loaded org data from STATE
      const org = STATE.allOrganisations.find((o) => o.id === orgId);
      if (!org) throw new Error('Organisation not found');

      // Fetch related awards through award_assignments using explicit FK
      const assignmentsResult = await apiClient.select('award_assignments', {
        select: 'status, awards:award_years!award_assignments_award_id_fkey (*)',
        filters: { organisation_id: orgId },
        pageSize: 1000,
      });
      const assignments = assignmentsResult.data;

      // Extract and sort awards, using assignment status instead of award status
      const awards = (assignments || [])
        .filter((a) => a.awards)
        .map((a) => ({
          ...a.awards,
          status: a.status, // Use assignment status (nominated/shortlisted/winner)
          package_type: 'bronze', // Default package type
          enhanced_profile: false, // Default enhanced profile
        }))
        .sort((a, b) => (b.year || 0) - (a.year || 0));

      // Fetch media gallery items tagged to this organisation
      let taggedMedia = [];
      try {
        const mediaResult = await apiClient.select('media_gallery', {
          select: '*',
          filters: { organisation_id: orgId },
          sort: { column: 'created_at', ascending: false },
          pageSize: 1000,
        });
        taggedMedia = mediaResult.data;
      } catch (mediaError) {
        console.error('Error loading tagged media:', mediaError);
      }

      // Fetch company images for marketing
      let companyImages = [];
      try {
        const imagesResult = await apiClient.select('organisation_images', {
          select: '*',
          filters: { organisation_id: orgId },
          sort: { column: 'display_order', ascending: true },
          pageSize: 1000,
        });
        companyImages = imagesResult.data;
      } catch (imagesError) {
        console.error('Error loading company images:', imagesError);
      }

      // Fetch invoices for this organisation
      let invoices = [];
      try {
        const invoicesResult = await apiClient.select('invoices', {
          select: '*',
          filters: { organisation_id: orgId },
          sort: { column: 'created_at', ascending: false },
          pageSize: 1000,
        });
        invoices = invoicesResult.data;
      } catch (invoicesError) {
        console.error('Error loading invoices:', invoicesError);
      }

      const invoicesSummary = {
        count: (invoices || []).length,
        totalAmount: (invoices || []).reduce((sum, inv) => sum + parseFloat(inv.total_amount || 0), 0),
        paidAmount: (invoices || []).reduce((sum, inv) => sum + parseFloat(inv.paid_amount || 0), 0),
        balanceDue: (invoices || []).reduce((sum, inv) => sum + parseFloat(inv.balance_due || 0), 0),
      };

      // Fetch entries with public voting enabled for this organisation
      let votingEntries = [];
      try {
        const entriesResult = await apiClient.select('entries', {
          select: '*, award_years (award_name, year)',
          filters: { organisation_id: orgId, allow_public_voting: true },
          sort: { column: 'created_at', ascending: false },
          pageSize: 1000,
        });
        votingEntries = entriesResult.data;
      } catch (entriesError) {
        console.error('Error loading voting entries:', entriesError);
      }

      // Render profile
      contentDiv.innerHTML = `
        <div class="row">
          <div class="col-md-4 mb-3">
            <h6 class="text-muted mb-2"><i class="bi bi-image me-2"></i>Company Logo</h6>
            <div class="card">
              <div class="card-body text-center">
                ${
                  org.logo_url
                    ? `<img src="${org.logo_url}" alt="${utils.escapeHtml(org.company_name)}"
                    class="mb-3" style="width: 250px; height: 170px; object-fit: contain; border: 1px solid #dee2e6; border-radius: 4px; background: #f8f9fa;">`
                    : `<div class="text-muted mb-3" style="width: 250px; height: 170px; display: flex; align-items: center; justify-content: center; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px;">
                    <i class="bi bi-image" style="font-size: 3rem;"></i>
                  </div>`
                }
                <input type="file" id="logoUploadInput" class="form-control form-control-sm mb-2"
                  accept="image/*" data-on-file-change="orgsModule.validateAndUploadLogo" data-id="${org.id}">
                <button type="button" class="btn btn-sm btn-outline-primary w-100 mb-2"
                  data-action="orgsModule.openLogoGalleryModal" data-id="${org.id}">
                  <i class="bi bi-images me-1"></i>Choose from Media Gallery
                </button>
                ${
                  org.website
                    ? `<button type="button" class="btn btn-sm btn-outline-success w-100 mb-2"
                    data-action="orgsModule.fetchLogoFromWebsite" data-id="${org.id}">
                    <i class="bi bi-globe me-1"></i>Fetch from Website
                  </button>`
                    : ''
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
                    ${
                      org.website
                        ? `<a href="${org.website.startsWith('http://') || org.website.startsWith('https://') ? org.website : 'https://' + org.website}" target="_blank" rel="noopener noreferrer">
                        ${utils.escapeHtml(org.website)} <i class="bi bi-box-arrow-up-right small"></i>
                      </a>`
                        : 'N/A'
                    }
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
                  <strong>Location:</strong>
                  <span class="view-mode" id="viewRegion">
                    <span class="badge bg-success-subtle text-success">${utils.escapeHtml(org.area_id ? locationModule.getAreaName(org.area_id) : org.country || org.county_city || 'N/A')}${org.area_id ? locationModule.sizeBadgeHtml(org.area_id) : ''}</span>
                  </span>
                  <select class="form-select form-select-sm edit-mode" id="editRegion" style="display: none;">
                    <option value="">Select Area</option>
                    ${(locationModule._cachedAreas || []).map((a) => `<option value="${a.id}" ${org.area_id === a.id ? 'selected' : ''}>${utils.escapeHtml(a.display_name)}</option>`).join('')}
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
                <hr class="my-2">
                <button class="btn btn-sm btn-outline-info w-100" data-action="orgsModule.companiesHouseLookup" data-id="${org.id}">
                  <i class="bi bi-bank me-1"></i>Companies House Lookup
                </button>
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
                  ${['prospect', 'entrant', 'nominee', 'shortlisted', 'winner', 'sponsor', 'past_winner']
                    .map(
                      (s) => `
                    <button class="btn btn-sm ${org.status === s ? 'btn-primary' : 'btn-outline-secondary'}"
                      data-action="orgsModule.updateOrgStatus" data-args='${JSON.stringify([org.id, s])}'>
                      ${s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ')}
                    </button>
                  `
                    )
                    .join('')}
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
                    data-on-keyenter="orgsModule.addThreadedNote" data-id="${org.id}">
                  <button class="btn btn-primary" data-action="orgsModule.addThreadedNote" data-id="${org.id}"><i class="bi bi-send"></i></button>
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
                      ${['1-10', '11-50', '51-200', '201-500', '500+'].map((s) => `<option value="${s}" ${org.company_size === s ? 'selected' : ''}>${s}</option>`).join('')}
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
                      ${['Bronze', 'Silver', 'Gold', 'Platinum'].map((t) => `<option value="${t}" ${org.tier === t ? 'selected' : ''}>${t}</option>`).join('')}
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
                    ${
                      org.tags && org.tags.length > 0
                        ? org.tags
                            .map(
                              (t) =>
                                `<span class="badge bg-secondary me-1 mb-1">${utils.escapeHtml(t)} <a href="#" class="text-white ms-1" data-action="orgsModule.removeTag" data-args='${JSON.stringify([org.id, utils.escapeHtml(t).replace(/'/g, '&#39;')])}'><i class="bi bi-x-circle-fill"></i></a></span>`
                            )
                            .join('')
                        : '<span class="text-muted small">No tags</span>'
                    }
                  </div>
                  <div class="input-group input-group-sm mt-2">
                    <input type="text" class="form-control" id="newTagInput" placeholder="Add tag..." data-on-keyenter="orgsModule.addTag" data-id="${org.id}">
                    <button class="btn btn-outline-primary" data-action="orgsModule.addTag" data-id="${org.id}"><i class="bi bi-plus"></i></button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        ${
          invoicesSummary.count > 0
            ? `<div class="mt-4">
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
                      data-action="orgsModule.viewOrganisationInvoices" data-args='${JSON.stringify([org.id, utils.escapeHtml(org.company_name).replace(/'/g, '&#39;')])}'>
                      <i class="bi bi-file-earmark-text me-2"></i>View All Invoices
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>`
            : ''
        }

        <div class="mt-4">
          <h6 class="text-muted mb-3"><i class="bi bi-trophy me-2"></i>Award History (${awards.length})</h6>
          ${
            awards.length === 0
              ? '<div class="alert alert-info">No awards found for this organisation.</div>'
              : `<div class="table-responsive">
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
                  ${awards
                    .map(
                      (award) => `
                    <tr>
                      <td><span class="badge bg-primary-subtle text-primary">${award.year}</span></td>
                      <td>
                        <a href="#"
                           class="text-decoration-none fw-semibold text-primary"
                           data-action="assignmentsModule.openAssignmentsModal" data-args='${JSON.stringify([award.id, utils.escapeHtml(utils.formatAwardName(award)).replace(/'/g, '&#39;')])}'>
                          ${utils.escapeHtml(utils.formatAwardName(award))}
                        </a>
                      </td>
                      <td><span class="badge bg-info-subtle text-info">${utils.escapeHtml(utils.toTitleCase(award.sector))}</span></td>
                      <td>${utils.getStatusBadge(award.status)}</td>
                      <td>
                        ${
                          ['bronze', 'silver', 'gold'].includes(award.package_type)
                            ? `<a href="#"
                              data-action="orgsModule.openCompanyProfile" data-args='${JSON.stringify([org.id, utils.escapeHtml(org.company_name).replace(/'/g, '&#39;')])}'>
                              ${orgsModule.getPackageBadge(award.package_type)}
                           </a>`
                            : '<span class="text-muted">-</span>'
                        }
                      </td>
                      <td class="text-center">
                        ${
                          award.enhanced_profile
                            ? '<i class="bi bi-star-fill text-warning" title="Enhanced Profile" style="font-size: 1.2rem;"></i>'
                            : '<i class="bi bi-star text-muted" title="Standard Profile" style="font-size: 1.2rem; opacity: 0.3;"></i>'
                        }
                      </td>
                    </tr>
                  `
                    )
                    .join('')}
                </tbody>
              </table>
            </div>`
          }
        </div>

        ${
          votingEntries && votingEntries.length > 0
            ? `<div class="mt-4">
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
                      ${votingEntries
                        .map((entry) => {
                          const votingUrl = `${window.location.origin}/vote.html?entry=${encodeURIComponent(entry.entry_number)}`;
                          const safeVotingUrl = utils.escapeHtml(votingUrl);
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
                                <input type="text" class="form-control" value="${safeVotingUrl}" readonly id="votingUrl_${entry.id}">
                                <button class="btn btn-outline-primary" type="button"
                                  data-action="utils.copyToClipboard" data-args='${JSON.stringify([safeVotingUrl, 'Voting link copied!'])}'>
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
                        })
                        .join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>`
            : ''
        }

        <!-- Enhanced Winner Profile Section -->
        <div class="mt-4">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="text-muted mb-0"><i class="bi bi-star-fill me-2"></i>Enhanced Winner Profile</h6>
            <div class="btn-group btn-group-sm" role="group">
              <button type="button"
                class="btn ${org.winner_profile_status === 'published' ? 'btn-success' : 'btn-outline-success'}"
                data-action="orgsModule.setWinnerProfileStatus" data-args='${JSON.stringify([org.id, 'published'])}'>
                <i class="bi bi-check-circle me-1"></i>Published
              </button>
              <button type="button"
                class="btn ${org.winner_profile_status === 'draft' || !org.winner_profile_status ? 'btn-secondary' : 'btn-outline-secondary'}"
                data-action="orgsModule.setWinnerProfileStatus" data-args='${JSON.stringify([org.id, 'draft'])}'>
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
                  <button type="button" class="btn btn-primary" data-action="orgsModule.saveWinnerProfile" data-id="${org.id}">
                    <i class="bi bi-save me-2"></i>Save Profile
                  </button>
                  <button type="button" class="btn btn-secondary" data-action="orgsModule.cancelWinnerProfile" data-args='${JSON.stringify([org.id, utils.escapeHtml(org.company_name || '').replace(/'/g, '&#39;')])}'>
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
            <button type="button" class="btn btn-sm btn-primary" data-action="orgsModule.openUploadImagesModal" data-id="${org.id}">
              <i class="bi bi-cloud-upload me-1"></i>Upload Images
            </button>
          </div>
          ${
            !companyImages || companyImages.length === 0
              ? '<div class="alert alert-info"><i class="bi bi-info-circle me-2"></i>No marketing images uploaded yet. Click "Upload Images" to add photos for email campaigns.</div>'
              : `<div class="row g-3">
              ${companyImages
                .map(
                  (img) => `
                <div class="col-md-3">
                  <div class="card h-100">
                    <img src="${img.file_url}" class="card-img-top" alt="${utils.escapeHtml(img.title || 'Company Image')}"
                      style="height: 180px; object-fit: cover; cursor: pointer;"
                      data-action="orgsModule.viewImageFull" data-args='${JSON.stringify([utils.escapeHtml(img.file_url), utils.escapeHtml(img.title || 'Company Image')])}'>
                    <div class="card-body p-2">
                      <p class="card-text small mb-1 fw-semibold">${utils.escapeHtml(img.title || 'Untitled')}</p>
                      ${img.caption ? `<p class="card-text small text-muted mb-2">${utils.escapeHtml(img.caption)}</p>` : ''}
                      <button class="btn btn-sm btn-outline-danger w-100"
                        data-action="orgsModule.deleteCompanyImage" data-args='${JSON.stringify([img.id, org.id])}'>
                        <i class="bi bi-trash me-1"></i>Delete
                      </button>
                    </div>
                  </div>
                </div>
              `
                )
                .join('')}
            </div>`
          }
        </div>

        <!-- Tagged Media Gallery Section -->
        <div class="mt-4">
          <h6 class="text-muted mb-3"><i class="bi bi-images me-2"></i>Tagged Media Gallery (${(taggedMedia || []).length})</h6>
          ${
            !taggedMedia || taggedMedia.length === 0
              ? '<div class="alert alert-info">No media tagged to this organisation yet. Upload photos/videos in the Media Gallery tab and tag them to this company.</div>'
              : `<div class="row g-3">
              ${taggedMedia
                .map((media) => {
                  const isImage = media.file_type?.startsWith('image/');
                  const isYouTube = media.file_type === 'video/youtube';
                  const eventName = media.events?.event_name || 'Unknown Event';
                  const eventYear = media.events?.year || media.events?.event_date?.substring(0, 4) || '';

                  return `
                  <div class="col-md-3">
                    <div class="card h-100">
                      ${
                        isImage
                          ? `<img src="${media.file_url}" class="card-img-top" alt="${utils.escapeHtml(media.title || 'Media')}" style="height: 150px; object-fit: cover;">`
                          : isYouTube
                            ? `<div class="card-img-top" style="height: 150px; position: relative;">
                          <img src="https://img.youtube.com/vi/${media.file_url}/mqdefault.jpg"
                            alt="${utils.escapeHtml(media.title || 'YouTube Video')}"
                            style="width: 100%; height: 100%; object-fit: cover;">
                          <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);">
                            <i class="bi bi-youtube text-danger" style="font-size: 2.5rem; filter: drop-shadow(0 0 10px rgba(0,0,0,0.5));"></i>
                          </div>
                        </div>`
                            : `<div class="card-img-top d-flex align-items-center justify-content-center bg-dark" style="height: 150px;">
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
                })
                .join('')}
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
            <button class="btn btn-sm btn-primary mt-2" data-action="orgsModule.addContact" data-id="orgId"><i class="bi bi-plus me-1"></i>Add Contact</button>
          </div></div>
        </div>

        <!-- Unified Activity Timeline (Feature 2) -->
        <div class="mt-4">
          <h6 class="text-muted mb-3"><i class="bi bi-clock-history me-2"></i>Activity Timeline
            <span class="badge bg-light text-muted ms-1" style="font-size: 0.6rem;">emails, notes, awards, invoices, status changes</span>
            <button class="btn btn-sm btn-outline-primary ms-2" data-action="orgsModule.showAddActivityNote" data-id="orgId"><i class="bi bi-plus me-1"></i>Add Note</button>
            <button class="btn btn-sm btn-outline-info ms-1" data-action="orgsModule.showFieldLevelAudit" data-id="orgId"><i class="bi bi-clock-history me-1"></i>Change History</button>
            <button class="btn btn-sm btn-outline-secondary ms-1" data-action="orgsModule.generateShareLink" data-id="orgId"><i class="bi bi-share me-1"></i>Share</button>
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
                  <div class="col-4"><input type="date" class="form-control form-control-sm" id="followUpDate" min="${new Date().toISOString().split('T')[0]}"></div>
                  <div class="col-3"><input type="text" class="form-control form-control-sm" id="followUpNote" placeholder="Reminder note..."></div>
                  <div class="col-3"><input type="email" class="form-control form-control-sm" id="followUpAssignee" placeholder="Assign to (email)"></div>
                  <div class="col-2"><button class="btn btn-sm btn-primary w-100" data-action="orgsModule.addFollowUp" data-id="orgId"><i class="bi bi-plus"></i></button></div>
                </div>
              </div></div>
            </div>
          </div>
          <div class="mt-2 d-flex gap-2">
            <button class="btn btn-sm btn-outline-primary" data-action="orgsModule.openEmailTemplate" data-id="orgId"><i class="bi bi-envelope me-1"></i>Email Templates</button>
            <button class="btn btn-sm btn-outline-success" data-action="orgsModule.openSMSTemplate" data-id="orgId"><i class="bi bi-chat-dots me-1"></i>SMS / WhatsApp</button>
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
              <div class="col-md-4"><button class="btn btn-sm btn-primary" data-action="orgsModule.uploadDocument" data-id="orgId"><i class="bi bi-cloud-upload me-1"></i>Upload</button></div>
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
              <div class="col-md-4"><button class="btn btn-sm btn-primary" data-action="orgsModule.addCustomField" data-id="orgId"><i class="bi bi-plus me-1"></i>Add Field</button></div>
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
                  ${STATE.allOrganisations
                    .filter((o) => o.id !== orgId)
                    .slice(0, 100)
                    .map((o) => `<option value="${utils.escapeHtml(o.company_name)}">`)
                    .join('')}
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
                  <option value="competitor">Competitor</option>
                  <option value="supplier">Supplier</option>
                </select>
              </div>
              <div class="col-md-4"><button class="btn btn-sm btn-primary" data-action="orgsModule.addRelationship" data-id="orgId"><i class="bi bi-link me-1"></i>Link</button></div>
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
            <button class="btn btn-sm btn-primary" data-action="orgsModule.composeEmailFromProfile" data-id="orgId" ${!org.email ? 'disabled' : ''}>
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
                <button class="btn btn-sm btn-primary mt-2" data-action="orgsModule.addSponsorshipPackage" data-id="orgId"><i class="bi bi-plus me-1"></i>Add Package</button>
              </div>
            </details>
          </div></div>
        </div>

        <!-- Data Completeness Score (Area 9) -->
        <div class="mt-4">
          <h6 class="text-muted mb-3"><i class="bi bi-speedometer2 me-2"></i>Data Completeness</h6>
          <div class="card"><div class="card-body">
            ${(() => {
              const _cs = this.calculateCompletenessScore(org);
              return `
            <div class="d-flex align-items-center gap-3">
              <div class="progress flex-grow-1" style="height: 24px;">
                <div class="progress-bar ${_cs >= 70 ? 'bg-success' : _cs >= 40 ? 'bg-warning' : 'bg-danger'}" style="width: ${_cs}%">
                  ${_cs}%
                </div>
              </div>
              <span class="fw-bold">${_cs}%</span>
            </div>
            <small class="text-muted mt-1 d-block">Based on: name, email, contact, phone, website, logo, sector, region, address, description</small>`;
            })()}
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
          ${followUps
            .map((f) => {
              const isOverdue = !f.done && new Date(f.date) < new Date();
              const fId = f.id || f.orgId;
              return `<div class="list-group-item px-0 py-2 border-0 d-flex align-items-center ${f.done ? 'text-muted' : ''}">
              <i class="bi ${f.done ? 'bi-check-circle text-success' : isOverdue ? 'bi-exclamation-circle text-danger' : 'bi-clock text-warning'} me-2"></i>
              <div class="flex-grow-1">
                <div class="small ${f.done ? 'text-decoration-line-through' : 'fw-semibold'}">${utils.escapeHtml(f.note || 'Follow up')}</div>
                <div class="text-muted" style="font-size: 0.7rem;">${new Date(f.date).toLocaleDateString('en-GB')} ${isOverdue && !f.done ? '<span class="text-danger">OVERDUE</span>' : ''}</div>
              </div>
              ${!f.done ? `<button class="btn btn-sm btn-outline-success me-1" data-action="orgsModule.completeFollowUp" data-args='${JSON.stringify([orgId, fId])}'><i class="bi bi-check"></i></button>` : ''}
              <button class="btn btn-sm btn-outline-danger" data-action="orgsModule.deleteFollowUp" data-args='${JSON.stringify([orgId, fId])}'><i class="bi bi-x"></i></button>
            </div>`;
            })
            .join('')}
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
          ${docs
            .map(
              (
                d
              ) => `<a href="${d.file_url}" target="_blank" class="list-group-item list-group-item-action d-flex align-items-center py-2 px-0 border-0">
            <i class="bi bi-file-earmark me-2 text-primary"></i>
            <div class="flex-grow-1">
              <div class="small fw-semibold">${utils.escapeHtml(d.title || 'Document')}</div>
              <div class="text-muted" style="font-size: 0.7rem;">${d.file_size ? Math.round(d.file_size / 1024) + ' KB' : ''} ${d.created_at ? '&middot; ' + new Date(d.created_at).toLocaleDateString('en-GB') : ''}</div>
            </div>
            <i class="bi bi-box-arrow-up-right text-muted"></i>
          </a>`
            )
            .join('')}
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
        cfEl.innerHTML = entries
          .map(
            ([name, value]) => `
          <div class="d-flex align-items-center mb-1">
            <span class="small fw-semibold me-2" style="width: 120px;">${utils.escapeHtml(name)}:</span>
            <span class="small flex-grow-1">${utils.escapeHtml(value)}</span>
            <button class="btn btn-sm btn-outline-danger py-0" data-action="orgsModule.removeCustomField" data-args='${JSON.stringify([orgId, utils.escapeHtml(name).replace(/'/g, '&#39;')])}'><i class="bi bi-x"></i></button>
          </div>
        `
          )
          .join('');
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

    // V17-M12: Validate file size (max 2 MB)
    if (file.size > 2 * 1024 * 1024) {
      utils.showToast('Logo file must be under 2 MB', 'error');
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
          await apiClient.upload('organisation-logos', fileName, file, {
            cacheControl: '3600',
            upsert: false,
          });

          // Get public URL
          const { data: urlData } = apiClient.getPublicUrl('organisation-logos', fileName);

          // Update organisation record with logo URL
          await apiClient.update('organisations', orgId, { logo_url: urlData.publicUrl });

          utils.showToast('Logo uploaded successfully!', 'success');

          // Reload the profile to show new logo
          const org = STATE.allOrganisations.find((o) => o.id === orgId);
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

      img.src = /** @type {string} */ (e.target.result);
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

      await apiClient.update('organisations', orgId, { winner_profile_status: status });

      utils.showToast(`Winner profile ${status === 'published' ? 'published' : 'saved as draft'}!`, 'success');

      // Reload the profile to show updated status
      const org = STATE.allOrganisations.find((o) => o.id === orgId);
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
    const intro = document.getElementById('winnerIntro')?.value?.trim() || '';
    const videoId = document.getElementById('winnerVideoId')?.value?.trim() || '';
    const voteUrl = document.getElementById('winnerVoteUrl')?.value?.trim() || '';
    const profileData = {
      winner_intro: intro || null,
      winner_video_id: videoId || null,
      winner_vote_url: voteUrl || null,
    };

    try {
      utils.showLoading();

      await apiClient.update('organisations', orgId, profileData);
    } catch (error) {
      console.warn('DB update for winner profile failed, using localStorage:', error);
      localStorage.setItem(`bta_winner_profile_${orgId}`, JSON.stringify(profileData));
    }

    // Update local state
    const org = STATE.allOrganisations.find((o) => o.id === orgId);
    if (org) {
      Object.assign(org, profileData);
    }

    utils.showToast('Winner profile saved successfully!', 'success');

    if (org) {
      await this.openCompanyProfile(orgId, org.company_name);
    }

    utils.hideLoading();
  },

  /**
   * Cancel winner profile editing
   * @param {string} orgId - Organisation ID
   * @param {string} companyName - Company name
   */
  async cancelWinnerProfile(orgId, companyName) {
    if (
      await utils.confirmDialog({
        title: 'Discard Changes',
        message: 'Discard changes to winner profile?',
        confirmText: 'Discard',
      })
    ) {
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
      const mediaResult = await apiClient.select('media_gallery', {
        select: '*',
        sort: { column: 'created_at', ascending: false },
        pageSize: 1000,
      });
      const allMedia = mediaResult.data;

      // Filter images only (no videos) and check dimensions
      const imageMedia = (allMedia || []).filter((m) => m.file_url && m.file_url.match(/\.(jpg|jpeg|png|gif|webp)$/i));

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
      let checkedCount = 0; // eslint-disable-line no-unused-vars

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
          ${validLogos
            .map(
              (media) => `
            <div class="col-md-3">
              <div class="card h-100 logo-option" style="cursor: pointer;"
                   data-action="orgsModule.setLogoFromGallery" data-args='${JSON.stringify([orgId, utils.escapeHtml(media.file_url), media.id])}'>
                <img src="${media.file_url}" class="card-img-top"
                     alt="${utils.escapeHtml(media.title || 'Logo')}"
                     style="height: 170px; object-fit: contain; background: #f8f9fa;">
                <div class="card-body p-2">
                  <p class="card-text small mb-0 text-center">${utils.escapeHtml(media.title || 'Untitled')}</p>
                  <p class="card-text small text-muted text-center mb-0">250 x 170 px</p>
                </div>
              </div>
            </div>
          `
            )
            .join('')}
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
   * @param {string} _mediaId - Media ID
   */
  async setLogoFromGallery(orgId, fileUrl, _mediaId) {
    try {
      utils.showLoading();

      // Update organisation record with logo URL
      await apiClient.update('organisations', orgId, { logo_url: fileUrl });

      utils.showToast('Logo updated successfully!', 'success');

      // Close the modal
      const modal = bootstrap.Modal.getInstance(document.getElementById('selectLogoModal'));
      if (modal) modal.hide();

      // Reload the profile to show new logo
      const org = STATE.allOrganisations.find((o) => o.id === orgId);
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
   * @param {string} [_companyName] - Company name (optional)
   */
  async fetchLogoFromWebsite(orgId, websiteUrl, _companyName) {
    try {
      // If no websiteUrl provided, look it up from state
      if (!websiteUrl) {
        const org = STATE.allOrganisations.find((o) => o.id === orgId);
        if (!org || !org.website) {
          utils.showToast('Please add a website URL first', 'warning');
          return;
        }
        websiteUrl = org.website;
        _companyName = org.company_name; // eslint-disable-line no-unused-vars
      }

      utils.showLoading('Fetching logo...');

      // Clean up the website URL to get the domain
      let cleanUrl = websiteUrl.trim();
      if (!cleanUrl.startsWith('http')) cleanUrl = 'https://' + cleanUrl;
      const domain = new URL(cleanUrl).hostname.replace(/^www\./, '');

      // Try multiple logo services in order
      const logoServices = [
        // Clearbit Logo API (best quality, but may not have all companies)
        `https://logo.clearbit.com/${domain}`,
        // Google's favicon service (good fallback)
        `https://www.google.com/s2/favicons?sz=128&domain=${domain}`,
        // DuckDuckGo icon service
        `https://icons.duckduckgo.com/ip3/${domain}.ico`,
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
      await apiClient.update('organisations', orgId, { logo_url: logoUrl });

      utils.showToast('Logo fetched successfully from website!', 'success');

      // Reload the profile to show new logo
      const org = STATE.allOrganisations.find((o) => o.id === orgId);
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
    const invalidFiles = files.filter((f) => !validTypes.includes(f.type));

    if (invalidFiles.length > 0) {
      utils.showToast(`${invalidFiles.length} file(s) are not valid images and will be skipped`, 'warning');
    }

    const validFiles = files.filter((f) => validTypes.includes(f.type));
    if (validFiles.length === 0) {
      utils.showToast('No valid images to upload', 'error');
      return;
    }

    try {
      await utils.protectModalDuringSave('uploadCompanyImagesModal', async () => {
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
            await apiClient.upload('media-gallery', fileName, file);

            // Get public URL
            const { data: urlData } = apiClient.getPublicUrl('media-gallery', fileName);

            // Insert record into organisation_images table
            await apiClient.insert('organisation_images', {
              organisation_id: this.currentOrgIdForImages,
              file_url: urlData.publicUrl,
              title: title || file.name,
              caption: caption || null,
              display_order: successCount,
            });

            successCount++;
          } catch (error) {
            console.error(`Error uploading ${file.name}:`, error);
            errorCount++;
          }
        }

        // Close modal
        bootstrap.Modal.getInstance(document.getElementById('uploadCompanyImagesModal'))?.hide();

        if (errorCount === 0) {
          utils.showToast(`${successCount} image(s) uploaded successfully!`, 'success');
        } else {
          utils.showToast(`${successCount} succeeded, ${errorCount} failed. Check console for details.`, 'warning');
        }

        // Reload the profile to show new images
        const org = STATE.allOrganisations.find((o) => o.id === this.currentOrgIdForImages);
        if (org) {
          await this.openCompanyProfile(this.currentOrgIdForImages, org.company_name);
        }
      });
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
    if (
      !(await utils.confirmDialog({
        title: 'Delete Image',
        message: 'Are you sure you want to delete this image? This action cannot be undone.',
      }))
    ) {
      return;
    }

    try {
      utils.showLoading();

      // Get image details to delete from storage
      const imageResult = await apiClient.select('organisation_images', {
        select: 'file_url',
        filters: { id: imageId },
        pageSize: 1,
      });
      const image = imageResult.data?.[0];

      // Delete from database
      await apiClient.delete('organisation_images', imageId);

      // Extract file path from URL and delete from storage
      if (image && image.file_url) {
        const urlParts = image.file_url.split('/storage/v1/object/public/media-gallery/');
        if (urlParts.length > 1) {
          try {
            await apiClient.storageDelete('media-gallery', [urlParts[1]]);
          } catch (storageErr) {
            console.warn('Storage cleanup failed:', storageErr);
          }
        }
      }

      utils.showToast('Image deleted successfully!', 'success');

      // Reload the profile
      const org = STATE.allOrganisations.find((o) => o.id === orgId);
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
    const titleEl = document.getElementById('viewImageFullTitle');
    if (titleEl) titleEl.textContent = title;
    const contentEl = document.getElementById('viewImageFullContent');
    if (contentEl) {
      contentEl.innerHTML = `
        <img src="${imageUrl}" alt="${utils.escapeHtml(title)}" class="img-fluid" style="max-height: 70vh;">
      `;
    }
    modal.show();
  },

  /**
   * Enable edit mode for organisation profile
   * @param {string} _orgId - Organisation ID
   */
  enableEditMode(_orgId) {
    // Hide view elements and show edit elements
    document.querySelectorAll('.view-mode').forEach((el) => (el.style.display = 'none'));
    document.querySelectorAll('.edit-mode').forEach((el) => (el.style.display = 'block'));

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
      await utils.protectModalDuringSave('companyProfileModal', async () => {
        utils.showLoading();

        // Collect updated data from form fields
        const updatedData = {
          contact_name: document.getElementById('editContactName').value.trim(),
          email: document.getElementById('editEmail').value.trim(),
          contact_phone: document.getElementById('editPhone').value.trim(),
          website: document.getElementById('editWebsite').value.trim(),
          area_id: document.getElementById('editRegion').value || null,
          address: document.getElementById('editAddress').value.trim(),
          catchment_area: document.getElementById('editCatchmentArea').value.trim(),
          // Extended fields
          description: document.getElementById('editDescription')?.value.trim() || null,
          achievements: document.getElementById('editAchievements')?.value.trim() || null,
          company_size: document.getElementById('editCompanySize')?.value || null,
          employee_count: document.getElementById('editEmployeeCount')?.value
            ? parseInt(document.getElementById('editEmployeeCount').value)
            : null,
          year_founded: document.getElementById('editYearFounded')?.value
            ? parseInt(document.getElementById('editYearFounded').value)
            : null,
          annual_revenue: document.getElementById('editAnnualRevenue')?.value
            ? parseFloat(document.getElementById('editAnnualRevenue').value)
            : null,
          tier: document.getElementById('editTier')?.value || null,
          linkedin_url: document.getElementById('editLinkedin')?.value.trim() || null,
          twitter_url: document.getElementById('editTwitter')?.value.trim() || null,
          facebook_url: document.getElementById('editFacebook')?.value.trim() || null,
          instagram_url: document.getElementById('editInstagram')?.value.trim() || null,
        };

        // Update in database
        await apiClient.update('organisations', orgId, updatedData);

        // Update local state
        const orgIndex = STATE.allOrganisations.findIndex((o) => o.id === orgId);
        if (orgIndex !== -1) {
          STATE.allOrganisations[orgIndex] = {
            ...STATE.allOrganisations[orgIndex],
            ...updatedData,
          };
        }

        // Update filtered organisations
        const filteredIndex = STATE.filteredOrganisations.findIndex((o) => o.id === orgId);
        if (filteredIndex !== -1) {
          STATE.filteredOrganisations[filteredIndex] = {
            ...STATE.filteredOrganisations[filteredIndex],
            ...updatedData,
          };
        }

        // Update current editing org
        this.currentEditingOrg = { ...this.currentEditingOrg, ...updatedData };
        this.originalOrgData = { ...this.currentEditingOrg };

        utils.showToast('Organisation updated successfully', 'success');

        // Refresh the profile view
        await this.openCompanyProfile(orgId, this.currentEditingOrg.company_name);

        // Refresh the organisations table and stats
        this.renderOrganisations();
        this.calculateDashboardStats();
      });
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
      const invoicesResult = await apiClient.select('invoices', {
        select: '*, invoice_line_items (*)',
        filters: { organisation_id: orgId },
        sort: { column: 'created_at', ascending: false },
        pageSize: 1000,
      });
      const invoices = invoicesResult.data;

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
                ${invoices
                  .map(
                    (invoice) => `
                  <tr>
                    <td><strong>${utils.escapeHtml(invoice.invoice_number)}</strong></td>
                    <td>${invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString('en-GB') : 'N/A'}</td>
                    <td>
                      <span class="badge bg-info-subtle text-info">
                        ${this.formatInvoiceType(invoice.invoice_type)}
                      </span>
                      ${
                        invoice.package_type && ['bronze', 'silver', 'gold'].includes(invoice.package_type)
                          ? `<br>${this.getPackageBadge(invoice.package_type)}`
                          : ''
                      }
                    </td>
                    <td>
                      <small class="text-muted">
                        ${
                          invoice.invoice_line_items && invoice.invoice_line_items.length > 0
                            ? invoice.invoice_line_items
                                .map((item) => `${item.quantity}x ${utils.escapeHtml(item.item_name)}`)
                                .join('<br>')
                            : invoice.description || 'N/A'
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
                `
                  )
                  .join('')}
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
      other: 'Other',
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
      refunded: '<span class="badge bg-secondary">Refunded</span>',
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
      gold: '<span class="badge" style="background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%); color: #000;"><i class="bi bi-award-fill me-1"></i>Gold</span>',
      silver:
        '<span class="badge" style="background: linear-gradient(135deg, #C0C0C0 0%, #808080 100%); color: #000;"><i class="bi bi-award-fill me-1"></i>Silver</span>',
      bronze:
        '<span class="badge" style="background: linear-gradient(135deg, #CD7F32 0%, #8B4513 100%); color: #fff;"><i class="bi bi-award-fill me-1"></i>Bronze</span>',
      'non-attendee': '<span class="badge bg-secondary"><i class="bi bi-x-circle me-1"></i>Non-Attendee</span>',
    };
    return packages[packageType] || packages['bronze'];
  },

  // ============================================
  // STATUS BADGE
  // ============================================
  getStatusBadge(status) {
    const badges = {
      prospect: '<span class="badge bg-secondary">Prospect</span>',
      entrant: '<span class="badge bg-info">Entrant</span>',
      nominee: '<span class="badge bg-primary">Nominee</span>',
      shortlisted: '<span class="badge bg-warning text-dark">Shortlisted</span>',
      winner: '<span class="badge bg-success">Winner</span>',
      sponsor: '<span class="badge bg-danger">Sponsor</span>',
      past_winner: '<span class="badge bg-dark">Past Winner</span>',
    };
    return badges[status] || badges['prospect'];
  },

  // ============================================
  // SAVE NEW COMPANY
  // ============================================
  /**
   * Validate and submit the Add Company form to create a new organisation record.
   * @returns {Promise<void>}
   */
  async saveNewCompany() {
    const form = document.getElementById('addCompanyForm');
    if (!form.checkValidity()) {
      form.classList.add('was-validated');
      form.reportValidity();
      return;
    }
    form.classList.remove('was-validated');

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
      if (
        !(await utils.confirmDialog({
          title: 'Potential Duplicates',
          message: `Potential duplicates found:<br>${dupeList}<br><br>Add "${companyName}" anyway?`,
          confirmText: 'Add Anyway',
          danger: false,
        }))
      ) {
        return;
      }
    }

    const selectedAreaId = document.getElementById('newCompanyArea')?.value || null;
    const selectedCountry = document.getElementById('newCompanyCountry')?.value || null;

    const companyData = {
      company_name: companyName,
      sector: document.getElementById('newCompanySector').value,
      contact_name: document.getElementById('newContactName').value.trim() || null,
      contact_phone: document.getElementById('newContactPhone').value.trim() || null,
      email: email || null,
      website: website,
      area_id: selectedAreaId || null,
      country: selectedCountry || null,
      address: document.getElementById('newCompanyAddress').value.trim() || null,
      catchment_area: document.getElementById('newCompanyCatchment')?.value.trim() || null,
      status: 'prospect',
    };

    try {
      await utils.protectModalDuringSave('addNewOrgModal', async () => {
        utils.showLoading();

        await apiClient.insert('organisations', companyData);

        utils.showToast('Organisation added successfully', 'success');
        bootstrap.Modal.getInstance(document.getElementById('addNewOrgModal'))?.hide();
        form.reset();
        await this.loadOrganisations();
        if (typeof updateTabCounts === 'function') updateTabCounts();
        if (typeof dashboardModule !== 'undefined' && dashboardModule._initGettingStartedBanner) {
          dashboardModule._initGettingStartedBanner(
            typeof STATE !== 'undefined' ? (STATE.allAwards || []).length : 0,
            typeof STATE !== 'undefined' ? (STATE.allOrganisations || []).length : 0
          );
        }
      });
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
      STATE.filteredOrganisations.forEach((org) => this.selectedOrgs.add(org.id));
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
      countEl.textContent = String(this.selectedOrgs.size);
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

    utils.saveSortState('organisations', this.sortField, this.sortDirection);
    this.updateSortIndicators();

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
        case 'county_city':
          valA = (a.county_city || '').toLowerCase();
          valB = (b.county_city || '').toLowerCase();
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
          const tierOrder = { Platinum: 4, Gold: 3, Silver: 2, Bronze: 1 };
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

    this._currentPage = 1;
    this.renderOrganisations();
  },

  /**
   * Update sort direction indicators in column headers
   */
  updateSortIndicators() {
    document.querySelectorAll('#organisations [data-sort-icon]').forEach((icon) => {
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
   * Fetch all distinct sectors from the database and populate the sector filter dropdown.
   * Merges hardcoded SECTORS constant with actual data so the filter includes every sector
   * that exists in the organisations table (matching how the Awards tab works).
   */
  async populateSectorFilter() {
    try {
      // Fetch sectors from both organisations and awards tables for complete coverage
      const [{ data: orgData }, { data: awardData }] = await Promise.all([
        apiClient.select('organisations', { select: 'sector', pageSize: 1000 }),
        apiClient.select('awards', { select: 'sector', pageSize: 1000 }),
      ]);
      const dbSectors = [...(orgData || []).map((o) => o.sector), ...(awardData || []).map((a) => a.sector)].filter(
        Boolean
      );
      const allSectors = [...new Set(dbSectors)].sort();

      const sectorSelect = document.getElementById('orgsSectorFilter');
      if (sectorSelect) {
        const current = sectorSelect.value;
        sectorSelect.innerHTML =
          '<option value="">All</option>' +
          allSectors
            .map((s) => `<option value="${utils.escapeHtml(s)}">${utils.escapeHtml(utils.toTitleCase(s))}</option>`)
            .join('');
        if (current) sectorSelect.value = current;
      }
    } catch (e) {
      console.warn('Could not load sector filter from DB:', e.message);
    }
  },

  /**
   * Populate sector suggestions datalist for add/edit forms
   */
  populateSectorSuggestions() {
    const datalist = document.getElementById('sectorSuggestions');
    if (!datalist) return;
    const existingSectors = [...new Set(STATE.allOrganisations.map((o) => o.sector).filter(Boolean))];
    const allSectors = [...new Set([...SECTORS, ...existingSectors])].sort();
    datalist.innerHTML = allSectors.map((s) => `<option value="${utils.escapeHtml(s)}">`).join('');
  },

  /**
   * Reset all filters to default
   */
  resetFilters() {
    document.getElementById('orgsSearchBox').value = '';
    document.getElementById('orgsYearFilter').value = '';
    document.getElementById('orgsSectorFilter').value = '';
    document.getElementById('orgsCountryFilter').value = '';
    locationModule.populateRegionDropdown('orgsRegionFilter', '', 'All Regions');
    locationModule.populateAreaDropdown('orgsAreaFilter', '', 'All');
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
    this._selectedTagFilters = [];
    try {
      localStorage.removeItem('orgsFilters');
    } catch (e) {
      /* ignore */
    }
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
    try {
      const csv = [
        'Organisation Name,Sector,Area,Region,Contact Name,Email,Phone,Website,Status,Tier,Tags,Awards Count,Address,Catchment Area,Description,Engagement Score,Health Status,Last Contacted',
        ...data.map((org) => {
          const engagement = this.calculateEngagementScore(org);
          const health = this.getOrgHealthIndicator(org);
          const lastContacted = this.getLastContacted(org.id);
          return [
            `"${(org.company_name || '').replace(/"/g, '""')}"`,
            `"${(org.sector || '').replace(/"/g, '""')}"`,
            `"${(org.county || '').replace(/"/g, '""')}"`,
            `"${(org.county_city || '').replace(/"/g, '""')}"`,
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
            `"${lastContacted ? new Date(lastContacted).toLocaleDateString('en-GB') : 'Never'}"`,
          ].join(',');
        }),
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `organisations-export-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      utils.showToast(`Exported ${data.length} organisations`, 'success');
    } catch (err) {
      console.error('Organisation CSV export failed:', err);
      utils.showToast('Export failed: ' + err.message, 'error');
    }
  },

  // ============================================
  // BULK EMAIL CAMPAIGN
  // ============================================
  /**
   * Open a bulk email compose modal for all selected organisations.
   * @returns {Promise<void>}
   */
  async bulkEmail() {
    if (this.selectedOrgs.size === 0) {
      utils.showToast('No organisations selected', 'warning');
      return;
    }

    const selectedData = STATE.allOrganisations.filter((org) => this.selectedOrgs.has(org.id));

    // Fetch contact-level emails for all selected orgs
    let contactEmails;
    try {
      contactEmails = await this._getContactEmails(Array.from(this.selectedOrgs));
    } catch (e) {
      utils.showToast('Failed to load contacts: ' + e.message, 'error');
      return;
    }
    const contactsByOrg = {};
    contactEmails.forEach((c) => {
      if (!c.email) return;
      if (!contactsByOrg[c.organisation_id]) contactsByOrg[c.organisation_id] = [];
      contactsByOrg[c.organisation_id].push(c);
    });

    const withEmail = selectedData.filter((o) => o.email || contactsByOrg[o.id]?.length > 0);
    const withoutEmail = selectedData.filter((o) => !o.email && !contactsByOrg[o.id]?.length);
    const totalContactEmails = Object.values(contactsByOrg).reduce((sum, arr) => sum + arr.length, 0);
    this._bulkEmailContacts = contactsByOrg;

    const templates = this._emailTemplates;

    const html = `
      <div class="row g-3">
        <div class="col-12">
          <div class="alert alert-info small py-2 mb-2">
            <i class="bi bi-people me-1"></i><strong>${withEmail.length}</strong> org(s) with email
            ${totalContactEmails > 0 ? ` &middot; <span class="text-success">${totalContactEmails} additional contact email(s)</span>` : ''}
            ${withoutEmail.length > 0 ? ` &middot; <span class="text-warning">${withoutEmail.length} without any email (skipped)</span>` : ''}
          </div>
          <div class="form-check form-switch mb-2">
            <input class="form-check-input" type="checkbox" id="includeContactEmails" checked>
            <label class="form-check-label small" for="includeContactEmails">Include contact-level emails</label>
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
          <select class="form-select form-select-sm" id="bulkEmailTemplate" data-on-change="orgsModule._populateBulkEmailFromTemplate">
            <option value="">-- Custom email --</option>
            ${templates.map((t) => `<option value="${t.id}">${utils.escapeHtml(t.name)}</option>`).join('')}
          </select>
        </div>
        <div class="col-12">
          <label class="form-label small fw-semibold">Subject</label>
          <input type="text" class="form-control form-control-sm" id="bulkEmailSubject" placeholder="Enter subject...">
        </div>
        <div class="col-12">
          <label class="form-label small fw-semibold">Body</label>
          <textarea class="form-control form-control-sm" id="bulkEmailBody" rows="6" placeholder="Enter message..."></textarea>
          <!-- H9: Merge tags reference panel -->
          <div class="mt-2 p-2 bg-light rounded border small">
            <strong class="text-muted d-block mb-1"><i class="bi bi-braces me-1"></i>Available merge tags — click to insert:</strong>
            <div class="d-flex flex-wrap gap-1">
              ${[
                '{company_name}',
                '{contact_name}',
                '{award_name}',
                '{award_year}',
                '{entry_number}',
                '{invoice_number}',
                '{event_date}',
                '{unsubscribe_link}',
              ]
                .map(
                  (tag) =>
                    `<code class="badge bg-secondary u-pointer" data-action="orgsModule.insertMergeTag" data-id="${tag}">${tag}</code>`
                )
                .join('')}
            </div>
          </div>
        </div>
        <div class="col-12">
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-outline-info" data-action="orgsModule._previewBulkEmail"><i class="bi bi-eye me-1"></i>Preview</button>
            <button class="btn btn-sm btn-primary ms-auto" data-action="orgsModule._sendBulkEmail"><i class="bi bi-send me-1"></i>Send Campaign</button>
          </div>
        </div>
        <div class="col-12" id="bulkEmailPreview" style="display:none;"></div>
      </div>`;

    this._showDynamicModal(`Email Campaign (${withEmail.length} recipients)`, html, 'bi-megaphone', 'modal-lg');
  },

  insertMergeTag(tag) {
    const ta = document.getElementById('bulkEmailBody');
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    ta.value = ta.value.slice(0, start) + tag + ta.value.slice(end);
    ta.selectionStart = ta.selectionEnd = start + tag.length;
    ta.focus();
  },

  _populateBulkEmailFromTemplate() {
    const templateId = document.getElementById('bulkEmailTemplate')?.value;
    if (!templateId) return;
    const template = this._emailTemplates.find((t) => t.id === templateId);
    if (template) {
      document.getElementById('bulkEmailSubject').value = template.subject;
      document.getElementById('bulkEmailBody').value = template.body;
    }
  },

  _previewBulkEmail() {
    const subject = document.getElementById('bulkEmailSubject')?.value.trim();
    const body = document.getElementById('bulkEmailBody')?.value.trim();
    if (!subject || !body) {
      utils.showToast('Enter subject and body first', 'warning');
      return;
    }

    const selectedData = STATE.allOrganisations.filter((org) => this.selectedOrgs.has(org.id) && org.email);
    const sample = selectedData[0];
    if (!sample) return;

    const previewSubject = subject
      .replace(/{company_name}/g, sample.company_name || '')
      .replace(/{contact_name}/g, sample.contact_name || 'Sir/Madam');
    const previewBody = body
      .replace(/{company_name}/g, sample.company_name || '')
      .replace(/{contact_name}/g, sample.contact_name || 'Sir/Madam');

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

    if (!subject || !body) {
      utils.showToast('Enter subject and body', 'warning');
      return;
    }

    const selectedData = STATE.allOrganisations.filter((org) => this.selectedOrgs.has(org.id) && org.email);
    const includeContacts = document.getElementById('includeContactEmails')?.checked;
    const contactsByOrg = this._bulkEmailContacts || {};

    // Build full email list
    const allEmails = selectedData.map((o) => o.email);
    if (includeContacts) {
      Object.values(contactsByOrg).forEach((contacts) => {
        contacts.forEach((c) => {
          if (c.email && !allEmails.includes(c.email)) allEmails.push(c.email);
        });
      });
    }

    if (allEmails.length === 0) {
      utils.showToast('No recipients with email addresses', 'warning');
      return;
    }

    if (
      !(await utils.confirmDialog({
        title: 'Send Email',
        message: `Send email to ${allEmails.length} recipient(s) via ${method === 'bcc' ? 'BCC' : 'individual emails'}?`,
        confirmText: 'Send',
        danger: false,
      }))
    )
      return;

    if (method === 'bcc') {
      // BCC mode: single mailto with all addresses in BCC
      const emails = allEmails.join(',');
      const bccSubject = subject.replace(/{company_name}/g, '').replace(/{contact_name}/g, '');
      const bccBody = body.replace(/{company_name}/g, '').replace(/{contact_name}/g, '');
      window.open(
        `mailto:?bcc=${encodeURIComponent(emails)}&subject=${encodeURIComponent(bccSubject)}&body=${encodeURIComponent(bccBody)}`
      );
    } else {
      // Individual mode: open first mailto, log all
      const first = selectedData[0];
      const personalSubject = subject
        .replace(/{company_name}/g, first.company_name || '')
        .replace(/{contact_name}/g, first.contact_name || 'Sir/Madam');
      const personalBody = body
        .replace(/{company_name}/g, first.company_name || '')
        .replace(/{contact_name}/g, first.contact_name || 'Sir/Madam');
      window.open(
        `mailto:${encodeURIComponent(first.email)}?subject=${encodeURIComponent(personalSubject)}&body=${encodeURIComponent(personalBody)}`
      );
      if (selectedData.length > 1) {
        utils.showToast(
          `Opened email for ${first.company_name}. ${selectedData.length - 1} more will be logged.`,
          'info'
        );
      }
    }

    // Log all communications to Supabase
    try {
      const templateId = document.getElementById('bulkEmailTemplate')?.value || 'custom';
      const _performedBy = await this._getCurrentUserEmail();
      const commsRecords = selectedData.map((org) => ({
        organisation_id: org.id,
        template_id: templateId,
        template_name: `Campaign: ${subject.substring(0, 50)}`,
        subject,
        channel: 'email',
        direction: 'outbound',
      }));
      // Insert in batches of 50
      for (let i = 0; i < commsRecords.length; i += 50) {
        await apiClient.insert('organisation_comms_log', commsRecords.slice(i, i + 50));
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
  bulkExport(format) {
    if (this.selectedOrgs.size === 0) {
      utils.showToast('No organisations selected', 'warning');
      return;
    }

    const originalFiltered = STATE.filteredOrganisations;
    STATE.filteredOrganisations = STATE.allOrganisations.filter((org) => this.selectedOrgs.has(org.id));
    if (format === 'excel') {
      this.exportToExcel();
    } else if (format === 'pdf') {
      this.exportToPDF();
    } else {
      this.exportToCSV();
    }
    STATE.filteredOrganisations = originalFiltered;
  },

  // ============================================
  // UPDATE COMPANY STATUS
  // ============================================
  // QUICK INLINE STATUS UPDATE
  // ============================================
  /**
   * Update an organisation's status inline without opening a full profile.
   * @param {string} orgId - Organisation ID
   * @param {string} newStatus - New status value
   * @returns {Promise<void>}
   */
  async quickUpdateStatus(orgId, newStatus) {
    try {
      const org = STATE.allOrganisations.find((o) => o.id === orgId);
      const oldStatus = org?.status || 'prospect';

      await apiClient.update('organisations', orgId, { status: newStatus });

      // Update local state
      if (org) org.status = newStatus;
      const filteredOrg = STATE.filteredOrganisations.find((o) => o.id === orgId);
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
  /**
   * Soft-delete (archive) an organisation after confirmation.
   * @param {string} orgId - Organisation ID
   * @param {string} companyName - Company name for the confirmation dialog
   * @returns {Promise<void>}
   */
  async deleteOrganisation(orgId, companyName) {
    if (
      !(await utils.confirmDialog({
        title: 'Archive Organisation',
        message: `Archive "${companyName}"? This will hide it from the main list but keep all data intact. You can restore it later from the "Show Archived" filter.`,
        confirmText: 'Archive',
      }))
    ) {
      return;
    }

    try {
      utils.showLoading();

      await apiClient.update('organisations', orgId, { status: 'archived' });

      // Log the action
      this._logAudit(orgId, 'archived', companyName, 'Organisation archived');

      utils.showToast(`"${companyName}" archived successfully`, 'success');

      // Update local state
      const org = STATE.allOrganisations.find((o) => o.id === orgId);
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

  /**
   * Restore an archived organisation back to prospect status.
   * @param {string} orgId - Organisation ID
   * @param {string} companyName - Company name for the success toast
   * @returns {Promise<void>}
   */
  async restoreOrganisation(orgId, companyName) {
    try {
      await apiClient.update('organisations', orgId, { status: 'prospect' });

      this._logAudit(orgId, 'restored', companyName, 'Organisation restored from archive');

      const org = STATE.allOrganisations.find((o) => o.id === orgId);
      if (org) org.status = 'prospect';

      utils.showToast(`"${companyName}" restored`, 'success');
      this.filterOrganisations();
    } catch (error) {
      console.error('Error restoring:', error);
      utils.showToast('Error restoring: ' + error.message, 'error');
    }
  },

  /**
   * Permanently delete an organisation and all its data after double confirmation.
   * @param {string} orgId - Organisation ID
   * @param {string} companyName - Company name shown in confirmation dialogs
   * @returns {Promise<void>}
   */
  async permanentDelete(orgId, companyName) {
    if (
      !(await utils.confirmDialog({
        title: 'Permanent Delete',
        message: `PERMANENTLY delete "${companyName}" and all associated data? This CANNOT be undone.`,
      }))
    )
      return;
    if (
      !(await utils.confirmDialog({
        title: 'Final Confirmation',
        message: `Final confirmation: Delete "${companyName}" forever?`,
      }))
    )
      return;

    try {
      utils.showLoading();

      // Save to trash before permanently deleting
      const org = STATE.allOrganisations.find((o) => o.id === orgId);
      if (org) utils.softDelete('organisations', org);

      // Delete all child records to prevent orphaned data
      await Promise.all([
        apiClient.deleteByFilters('award_assignments', { organisation_id: orgId }),
        apiClient.deleteByFilters('organisation_contacts', { organisation_id: orgId }),
        apiClient.deleteByFilters('organisation_notes', { organisation_id: orgId }),
        apiClient.deleteByFilters('organisation_follow_ups', { organisation_id: orgId }),
        apiClient.deleteByFilters('organisation_images', { organisation_id: orgId }),
        apiClient.deleteByFilters('organisation_custom_fields', { organisation_id: orgId }),
        apiClient.deleteByFilters('organisation_documents', { organisation_id: orgId }),
        apiClient.deleteByFilters('crm_communications', { organisation_id: orgId }),
        apiClient.deleteByFilters('crm_deals', { organisation_id: orgId }),
        apiClient.deleteByFilters('crm_meetings', { organisation_id: orgId }),
        apiClient.deleteByFilters('invoices', { organisation_id: orgId }),
        apiClient.deleteByFilters('payments', { organisation_id: orgId }),
      ]);
      await apiClient.delete('organisations', orgId);

      STATE.allOrganisations = STATE.allOrganisations.filter((o) => o.id !== orgId);
      STATE.filteredOrganisations = STATE.filteredOrganisations.filter((o) => o.id !== orgId);
      this.selectedOrgs.delete(orgId);

      utils.showToast(
        `"${companyName}" permanently deleted. <a href="#" data-action="utils.undoLastDelete" data-id="organisations" data-prevent-default="true">Undo</a>`,
        'info'
      );
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
  /**
   * Bulk archive all selected organisations after confirmation.
   * @returns {Promise<void>}
   */
  async bulkDelete() {
    if (this.selectedOrgs.size === 0) {
      utils.showToast('No organisations selected', 'warning');
      return;
    }

    const count = this.selectedOrgs.size;
    if (
      !(await utils.confirmDialog({
        title: 'Bulk Archive',
        message: `Archive ${count} organisation(s)? They will be hidden from the main list but can be restored later.`,
        confirmText: 'Archive',
      }))
    ) {
      return;
    }

    try {
      utils.showLoading();
      const orgIds = Array.from(this.selectedOrgs);

      await apiClient.updateByFilters('organisations', { 'id@in': orgIds }, { status: 'archived' });

      // Update local state
      orgIds.forEach((id) => {
        const org = STATE.allOrganisations.find((o) => o.id === id);
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
  /**
   * Change the status of all selected organisations to a new value.
   * @param {string} newStatus - Status to apply to all selected organisations
   * @returns {Promise<void>}
   */
  async bulkStatusChange(newStatus) {
    if (this.selectedOrgs.size === 0) {
      utils.showToast('No organisations selected', 'warning');
      return;
    }

    const count = this.selectedOrgs.size;
    if (
      !(await utils.confirmDialog({
        title: 'Change Status',
        message: `Change status of ${count} organisation(s) to "${newStatus.replace('_', ' ')}"?`,
        confirmText: 'Update',
        danger: false,
      }))
    )
      return;

    try {
      utils.showLoading();
      const orgIds = Array.from(this.selectedOrgs);

      // C7: capture previous statuses for undo
      const previousStatuses = orgIds.map((id) => ({
        id,
        status: STATE.allOrganisations.find((o) => o.id === id)?.status || 'prospect',
      }));

      await apiClient.updateByFilters('organisations', { 'id@in': orgIds }, { status: newStatus });

      orgIds.forEach((id) => {
        const org = STATE.allOrganisations.find((o) => o.id === id);
        if (org) org.status = newStatus;
        const fOrg = STATE.filteredOrganisations.find((o) => o.id === id);
        if (fOrg) fOrg.status = newStatus;
      });

      // C7: push to undo stack
      utils.pushUndo('organisations', {
        description: `Bulk status → ${newStatus} (${count} org${count > 1 ? 's' : ''})`,
        undoFn: async () => {
          for (const { id, status } of previousStatuses) {
            await apiClient.update('organisations', id, { status });
            const o = STATE.allOrganisations.find((x) => x.id === id);
            if (o) o.status = status;
          }
          this.renderOrganisations();
        },
        redoFn: async () => {
          await apiClient.updateByFilters('organisations', { 'id@in': orgIds }, { status: newStatus });
          orgIds.forEach((id) => {
            const o = STATE.allOrganisations.find((x) => x.id === id);
            if (o) o.status = newStatus;
          });
          this.renderOrganisations();
        },
      });

      utils.showToast(
        `${count} org(s) updated to ${newStatus.replace('_', ' ')} — <a href="#" data-action="utils.undo" data-args='["organisations"]' data-prevent-default="true">Undo</a>`,
        'success',
        null,
        6000
      );
      this.renderOrganisations();
    } catch (error) {
      console.error('Error bulk status change:', error);
      utils.showToast('Error: ' + error.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Update an organisation's status and refresh its profile view.
   * @param {string} orgId - Organisation ID
   * @param {string} newStatus - New status value
   * @returns {Promise<void>}
   */
  async updateOrgStatus(orgId, newStatus) {
    try {
      await apiClient.update('organisations', orgId, { status: newStatus });

      // Update local state
      const org = STATE.allOrganisations.find((o) => o.id === orgId);
      if (org) org.status = newStatus;

      const filteredOrg = STATE.filteredOrganisations.find((o) => o.id === orgId);
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
    prospect: { next: ['entrant', 'sponsor'], label: 'Prospect' },
    entrant: { next: ['nominee', 'prospect'], label: 'Entrant' },
    nominee: { next: ['shortlisted', 'entrant'], label: 'Nominee' },
    shortlisted: { next: ['winner', 'nominee'], label: 'Shortlisted' },
    winner: { next: ['past_winner'], label: 'Winner' },
    past_winner: { next: ['entrant', 'prospect'], label: 'Past Winner' },
    sponsor: { next: ['prospect'], label: 'Sponsor' },
    archived: { next: ['prospect'], label: 'Archived' },
  },

  _getStatusOptions(currentStatus) {
    const flow = this._statusFlow[currentStatus];
    if (!flow) return [{ value: currentStatus, label: currentStatus }];

    // Show current + valid next statuses
    const options = [{ value: currentStatus, label: flow.label + ' (current)' }];
    (flow.next || []).forEach((s) => {
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
      await apiClient.insert('org_audit_log', {
        org_id: orgId,
        company_name: companyName,
        action,
        details,
        performed_by: performedBy,
      });
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

  /**
   * Fetch the audit log entries for an organisation (or all orgs if orgId is null).
   * @param {string|null} orgId - Organisation ID, or null for global log
   * @returns {Promise<Array>} Array of audit log entry objects
   */
  async getAuditLog(orgId) {
    try {
      const filters = {};
      if (orgId) filters.org_id = orgId;
      const result = await apiClient.select('org_audit_log', {
        select: '*',
        filters,
        sort: { column: 'created_at', ascending: false },
        pageSize: 50,
      });
      return (result.data || []).map((e) => ({ ...e, timestamp: e.created_at }));
    } catch (e) {
      console.warn('Failed to read audit log from Supabase:', e.message);
      return [];
    }
  },

  /**
   * Render the audit log as an HTML string for display in the profile panel.
   * @param {string} orgId - Organisation ID
   * @returns {Promise<string>} HTML string of audit log entries
   */
  async renderAuditLog(orgId) {
    const log = await this.getAuditLog(orgId);
    if (log.length === 0) return '<p class="text-muted small">No activity recorded yet</p>';

    return `<div class="list-group list-group-flush" style="max-height: 300px; overflow-y: auto;">
      ${log
        .slice(0, 50)
        .map((entry) => {
          const date = new Date(entry.timestamp || entry.created_at);
          const timeAgo = this._timeAgo(date);
          const icons = {
            status_change: 'bi-arrow-repeat text-primary',
            archived: 'bi-archive text-warning',
            restored: 'bi-arrow-counterclockwise text-success',
            created: 'bi-plus-circle text-success',
            email_sent: 'bi-envelope text-info',
            note_added: 'bi-sticky text-secondary',
            csv_import: 'bi-file-earmark-arrow-up text-primary',
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
        })
        .join('')}
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
    return (str || '')
      .toLowerCase()
      .replace(/\b(ltd|limited|plc|inc|llp|llc|&|and|the|co|company)\b/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  },

  findDuplicates(companyName) {
    const normalised = this._normaliseForMatch(companyName);
    if (!normalised || normalised.length < 3) return [];

    return STATE.allOrganisations.filter((org) => {
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
    const m = a.length,
      n = b.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] =
          a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[m][n];
  },

  showDuplicateCheck() {
    const dupeMap = new Map();

    STATE.allOrganisations.forEach((org) => {
      const norm = this._normaliseForMatch(org.company_name);
      if (!norm) return;
      if (!dupeMap.has(norm)) dupeMap.set(norm, []);
      dupeMap.get(norm).push(org);
    });

    const duplicateGroups = Array.from(dupeMap.values()).filter((group) => group.length > 1);

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
          ${group
            .map(
              (org) => `<tr>
            <td class="small">${utils.escapeHtml(org.company_name)}</td>
            <td class="small">${utils.escapeHtml(org.email || '-')}</td>
            <td><span class="badge bg-secondary">${org.status || 'prospect'}</span></td>
            <td class="text-center">${org.awards_count || 0}</td>
            <td><button class="btn btn-sm btn-outline-danger" data-action="orgsModule.deleteOrganisation" data-args='${JSON.stringify([org.id, utils.escapeHtml(org.company_name).replace(/'/g, '&#39;')])}'>Archive</button></td>
          </tr>`
            )
            .join('')}
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
      body: `Dear {contact_name},\n\nWe are delighted to inform you that {company_name} has been shortlisted for the British Trade Awards.\n\nThe awards ceremony will take place shortly, and we will be in touch with further details.\n\nKind regards,\nBritish Trade Awards Team`,
    },
    {
      id: 'winner_notify',
      name: 'Winner Announcement',
      subject: 'You are a Winner - British Trade Awards!',
      body: `Dear {contact_name},\n\nCongratulations! We are thrilled to announce that {company_name} has won at the British Trade Awards!\n\nPlease find attached your winner's pack with logos, press release template, and trophy collection details.\n\nKind regards,\nBritish Trade Awards Team`,
    },
    {
      id: 'entry_invite',
      name: 'Entry Invitation',
      subject: 'British Trade Awards - Invitation to Enter',
      body: `Dear {contact_name},\n\nWe would like to invite {company_name} to enter the British Trade Awards this year.\n\nEntries are now open and close on [DATE]. You can enter online at [URL].\n\nKind regards,\nBritish Trade Awards Team`,
    },
    {
      id: 'feedback_request',
      name: 'Feedback Request',
      subject: 'British Trade Awards - We value your feedback',
      body: `Dear {contact_name},\n\nThank you for participating in the British Trade Awards. We would love to hear your feedback to help us improve.\n\nPlease take a moment to complete our short survey: [SURVEY_URL]\n\nKind regards,\nBritish Trade Awards Team`,
    },
    {
      id: 'sponsor_inquiry',
      name: 'Sponsorship Inquiry',
      subject: 'Sponsorship Opportunities - British Trade Awards',
      body: `Dear {contact_name},\n\nWe are reaching out to {company_name} regarding sponsorship opportunities for the upcoming British Trade Awards.\n\nWe have several packages available, including category sponsorship and headline sponsorship.\n\nWould you be available for a brief call to discuss?\n\nKind regards,\nBritish Trade Awards Team`,
    },
  ],

  openEmailTemplate(orgId) {
    const org = STATE.allOrganisations.find((o) => o.id === orgId) || {};
    const templates = this._emailTemplates;

    const html = `<div class="list-group">
      ${templates
        .map((t) => {
          const subject = t.subject
            .replace(/{company_name}/g, org.company_name || '')
            .replace(/{contact_name}/g, org.contact_name || 'Sir/Madam');
          const body = t.body
            .replace(/{company_name}/g, org.company_name || '')
            .replace(/{contact_name}/g, org.contact_name || 'Sir/Madam');
          return `<a href="mailto:${org.email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}"
                   class="list-group-item list-group-item-action"
                   data-action="orgsModule._logComms" data-args='${JSON.stringify([orgId, t.id, utils.escapeHtml(org.company_name || '').replace(/'/g, '&#39;')])}'>
          <div class="d-flex justify-content-between align-items-center">
            <div>
              <h6 class="mb-1">${t.name}</h6>
              <small class="text-muted">${t.subject}</small>
            </div>
            <i class="bi bi-envelope text-primary"></i>
          </div>
        </a>`;
        })
        .join('')}
    </div>`;

    this._showDynamicModal(`Email ${utils.escapeHtml(org.company_name || '')}`, html, 'bi-envelope');
  },

  // ============================================
  // COMMUNICATION HISTORY (Supabase-backed)
  // ============================================
  async _logComms(orgId, templateId, companyName) {
    try {
      const template = this._emailTemplates.find((t) => t.id === templateId);
      await apiClient.insert('organisation_comms_log', {
        organisation_id: orgId,
        template_id: templateId,
        template_name: template?.name || templateId,
      });

      this._logAudit(orgId, 'email_sent', companyName, `Email sent: ${template?.name || templateId}`);
    } catch (e) {
      console.warn('Failed to write comms log to Supabase:', e.message);
    }
  },

  /**
   * Fetch communication history entries for an organisation.
   * @param {string} orgId - Organisation ID
   * @returns {Promise<Array>} Array of communication log entry objects
   */
  async getCommsHistory(orgId) {
    try {
      const filters = {};
      if (orgId) filters.organisation_id = orgId;
      const result = await apiClient.select('organisation_comms_log', {
        select: '*',
        filters,
        sort: { column: 'created_at', ascending: false },
        pageSize: 50,
      });
      return (result.data || []).map((e) => ({ ...e, timestamp: e.created_at, templateName: e.template_name }));
    } catch (e) {
      console.warn('Failed to read comms history from Supabase:', e.message);
      return [];
    }
  },

  /**
   * Render communications history as an HTML string for display in the profile panel.
   * @param {string} orgId - Organisation ID
   * @returns {Promise<string>} HTML string of communication history
   */
  async renderCommsHistory(orgId) {
    const history = await this.getCommsHistory(orgId);
    if (history.length === 0) return '<p class="text-muted small">No communications recorded yet</p>';

    return `<div class="list-group list-group-flush" style="max-height: 250px; overflow-y: auto;">
      ${history
        .map((entry) => {
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
        })
        .join('')}
    </div>`;
  },

  // ============================================
  // TAG MANAGEMENT
  // ============================================
  /**
   * Add a tag from the tag input field to an organisation.
   * @param {string} orgId - Organisation ID
   * @returns {Promise<void>}
   */
  async addTag(orgId) {
    const input = document.getElementById('newTagInput');
    const tag = (input?.value || '').trim();
    if (!tag) return;

    try {
      const org = STATE.allOrganisations.find((o) => o.id === orgId);
      const currentTags = org?.tags || [];

      if (currentTags.includes(tag)) {
        utils.showToast('Tag already exists', 'warning');
        return;
      }

      const newTags = [...currentTags, tag];
      await apiClient.update('organisations', orgId, { tags: newTags });

      if (org) org.tags = newTags;
      input.value = '';
      utils.showToast(`Tag "${tag}" added`, 'success');
      await this.openCompanyProfile(orgId, org?.company_name || '');
    } catch (error) {
      console.error('Error adding tag:', error);
      utils.showToast('Error adding tag: ' + error.message, 'error');
    }
  },

  /**
   * Remove a tag from an organisation.
   * @param {string} orgId - Organisation ID
   * @param {string} tag - Tag string to remove
   * @returns {Promise<void>}
   */
  async removeTag(orgId, tag) {
    try {
      const org = STATE.allOrganisations.find((o) => o.id === orgId);
      const newTags = (org?.tags || []).filter((t) => t !== tag);

      await apiClient.update('organisations', orgId, { tags: newTags });

      if (org) org.tags = newTags;
      utils.showToast(`Tag "${tag}" removed`, 'success');
      await this.openCompanyProfile(orgId, org?.company_name || '');
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
               data-on-keyenter="orgsModule.saveInlineEdit" data-on-keyescape="orgsModule.cancelInlineEdit" data-args='${JSON.stringify([orgId, field])}'
               style="font-size: 0.8rem;">
        <button class="btn btn-success btn-sm" data-action="orgsModule.saveInlineEdit" data-args='${JSON.stringify([orgId, field])}'><i class="bi bi-check"></i></button>
        <button class="btn btn-outline-secondary btn-sm" data-action="orgsModule.cancelInlineEdit" data-id="${orgId}"><i class="bi bi-x"></i></button>
      </div>
    `;

    // Store original HTML for cancel
    td.dataset.originalHtml = originalHtml;
    const input = td.querySelector('input');
    if (input) input.focus();
  },

  // Last inline edit for undo support
  _lastInlineEdit: null,

  /**
   * Persist an inline field edit for an organisation and update local state.
   * @param {string} orgId - Organisation ID
   * @param {string} field - Display field key being edited
   * @returns {Promise<void>}
   */
  async saveInlineEdit(orgId, field) {
    const input = document.getElementById(`inlineEdit_${field}`);
    if (!input) return;

    const newValue = input.value.trim();

    // Map display field to DB field
    const fieldMap = { contact: 'contact_name', email: 'email', sector: 'sector' };
    const dbField = fieldMap[field] || field;

    // Capture old value for undo
    const org = STATE.allOrganisations.find((o) => o.id === orgId);
    const oldValue = org ? org[dbField] || '' : '';

    try {
      await apiClient.update('organisations', orgId, { [dbField]: newValue || null });
    } catch (error) {
      console.warn('DB update for inline edit failed, using localStorage:', error);
      const key = `bta_org_edits_${orgId}`;
      const stored = JSON.parse(localStorage.getItem(key) || '{}');
      stored[dbField] = newValue || null;
      localStorage.setItem(key, JSON.stringify(stored));
    }

    // Update local state
    if (org) org[dbField] = newValue || null;
    const fOrg = STATE.filteredOrganisations.find((o) => o.id === orgId);
    if (fOrg) fOrg[dbField] = newValue || null;

    // Store for undo
    this._lastInlineEdit = { orgId, dbField, oldValue, newValue };

    // Log the diff to audit trail
    this._logAuditWithDiff(orgId, 'field_changed', org?.company_name || '', dbField, oldValue, newValue);

    this.renderOrganisations();
    this._showUndoToast(field);
  },

  _showUndoToast(field) {
    // Remove existing undo toast
    document.getElementById('undoToast')?.remove();
    const toastHtml = `<div id="undoToast" class="toast show position-fixed bottom-0 end-0 m-3" style="z-index:9999;" role="alert">
      <div class="toast-body d-flex align-items-center gap-2 bg-dark text-white rounded shadow">
        <i class="bi bi-pencil-square"></i>
        <span class="small">${utils.escapeHtml(field)} updated</span>
        <button class="btn btn-sm btn-warning ms-2 py-0 px-2" data-action="orgsModule.undoLastInlineEdit"><i class="bi bi-arrow-counterclockwise me-1"></i>Undo</button>
        <button type="button" class="btn-close btn-close-white ms-1" data-action="utils.removeClosestToast"></button>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', toastHtml);
    // Auto-dismiss after 8 seconds
    setTimeout(() => document.getElementById('undoToast')?.remove(), 8000);
  },

  /**
   * Revert the most recent inline field edit to its previous value.
   * @returns {Promise<void>}
   */
  async undoLastInlineEdit() {
    const edit = this._lastInlineEdit;
    if (!edit) {
      utils.showToast('Nothing to undo', 'warning');
      return;
    }

    try {
      await apiClient.update('organisations', edit.orgId, { [edit.dbField]: edit.oldValue || null });

      const org = STATE.allOrganisations.find((o) => o.id === edit.orgId);
      if (org) org[edit.dbField] = edit.oldValue || null;
      const fOrg = STATE.filteredOrganisations.find((o) => o.id === edit.orgId);
      if (fOrg) fOrg[edit.dbField] = edit.oldValue || null;

      this._lastInlineEdit = null;
      document.getElementById('undoToast')?.remove();
      this.renderOrganisations();
      utils.showToast('Edit undone', 'success');
    } catch (e) {
      utils.showToast('Undo failed: ' + e.message, 'error');
    }
  },

  // cancelInlineEdit is defined below with full delegation support

  // ============================================
  // BULK FIELD UPDATES
  // ============================================
  /**
   * Set a single field to a specified value for all selected organisations.
   * @param {string} field - Database field name to update
   * @param {string} value - New value to assign
   * @returns {Promise<void>}
   */
  async bulkUpdateField(field, value) {
    if (this.selectedOrgs.size === 0) {
      utils.showToast('No organisations selected', 'warning');
      return;
    }

    const count = this.selectedOrgs.size;
    const displayValue = value || '(empty)';
    if (
      !(await utils.confirmDialog({
        title: 'Bulk Update Field',
        message: `Set ${field} to "${displayValue}" for ${count} organisation(s)?`,
        confirmText: 'Update',
        danger: false,
      }))
    )
      return;

    try {
      utils.showLoading();
      const orgIds = Array.from(this.selectedOrgs);

      await apiClient.updateByFilters('organisations', { 'id@in': orgIds }, { [field]: value || null });

      orgIds.forEach((id) => {
        const org = STATE.allOrganisations.find((o) => o.id === id);
        if (org) org[field] = value || null;
        const fOrg = STATE.filteredOrganisations.find((o) => o.id === id);
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
      const existingSectors = [...new Set(STATE.allOrganisations.map((o) => o.sector).filter(Boolean))];
      const allSectors = [...new Set([...SECTORS, ...existingSectors])].sort();
      options = allSectors
        .map((s) => `<option value="${s}">${utils.escapeHtml(utils.toTitleCase(s))}</option>`)
        .join('');
    } else if (field === 'county_city') {
      options = REGIONS.map((r) => `<option value="${r}">${utils.escapeHtml(r)}</option>`).join('');
    } else if (field === 'tier') {
      options = ['Bronze', 'Silver', 'Gold', 'Platinum'].map((t) => `<option value="${t}">${t}</option>`).join('');
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
              <button class="btn btn-primary btn-sm" data-action="orgsModule._applyBulkFieldUpdate" data-id="${field}">Apply</button>
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
  /**
   * Attempt to auto-fetch logos for all selected organisations that have websites but no logo.
   * @returns {Promise<void>}
   */
  async bulkFetchLogos() {
    const selected = Array.from(this.selectedOrgs);
    const orgs = STATE.allOrganisations.filter((o) => selected.includes(o.id) && o.website && !o.logo_url);

    if (orgs.length === 0) {
      utils.showToast('No selected organisations with websites and missing logos', 'warning');
      return;
    }

    if (
      !(await utils.confirmDialog({
        title: 'Fetch Logos',
        message: `Fetch logos for ${orgs.length} organisations with websites but no logo?`,
        confirmText: 'Fetch Logos',
        danger: false,
      }))
    )
      return;

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
          `https://icons.duckduckgo.com/ip3/${domain}.ico`,
        ];

        let logoUrl = null;
        for (const serviceUrl of logoServices) {
          try {
            const response = await fetch(serviceUrl, { method: 'HEAD' });
            if (response.ok) {
              logoUrl = serviceUrl;
              break;
            }
          } catch (e) {
            continue;
          }
        }

        if (logoUrl) {
          await apiClient.update('organisations', org.id, { logo_url: logoUrl });
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
      if (i < orgs.length - 1) await new Promise((r) => setTimeout(r, 300));
    }

    utils.hideLoading();
    utils.showToast(
      `Logos fetched: ${successCount} success, ${failCount} failed`,
      successCount > 0 ? 'success' : 'warning'
    );
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
    company_name: 'company_name',
    'company name': 'company_name',
    companyname: 'company_name',
    name: 'company_name',
    'business name': 'company_name',
    organisation: 'company_name',
    sector: 'sector',
    industry: 'sector',
    category: 'sector',
    county: 'county',
    'county/city': 'county',
    location: 'county',
    city: 'county',
    region: 'county_city',
    area: 'county_city',
    contact_name: 'contact_name',
    'contact name': 'contact_name',
    contact: 'contact_name',
    email: 'email',
    'email address': 'email',
    'e-mail': 'email',
    phone: 'contact_phone',
    contact_phone: 'contact_phone',
    telephone: 'contact_phone',
    tel: 'contact_phone',
    website: 'website',
    url: 'website',
    web: 'website',
    site: 'website',
    address: 'address',
    'postal address': 'address',
    catchment_area: 'catchment_area',
    'catchment area': 'catchment_area',
    catchment: 'catchment_area',
    // Contact-specific fields for multi-contact import
    'first name': 'contact_first_name',
    first_name: 'contact_first_name',
    firstname: 'contact_first_name',
    'last name': 'contact_last_name',
    last_name: 'contact_last_name',
    lastname: 'contact_last_name',
    surname: 'contact_last_name',
    'job title': 'contact_job_title',
    job_title: 'contact_job_title',
    title: 'contact_job_title',
    role: 'contact_job_title',
    position: 'contact_job_title',
    mobile: 'contact_mobile',
    'mobile phone': 'contact_mobile',
    mobile_phone: 'contact_mobile',
    cell: 'contact_mobile',
  },

  _dbFields: [
    'company_name',
    'sector',
    'county_city',
    'contact_name',
    'email',
    'contact_phone',
    'website',
    'address',
    'catchment_area',
  ],
  _contactFields: ['contact_first_name', 'contact_last_name', 'contact_job_title', 'contact_mobile'],

  _getSelectedCounty() {
    const val = document.getElementById('csvCountySelect')?.value || '';
    if (!val) {
      utils.showToast('Please select an Area first', 'error');
      document.getElementById('csvCountySelect')?.focus();
      return null;
    }
    return val;
  },

  parseCSVFile(_value, event) {
    // data-on-change passes (el.value, event) — we need the element itself for .files
    const inputEl = event?.target || document.getElementById('csvFileInput');
    const file = inputEl?.files?.[0];
    if (!file) return;

    if (!this._getSelectedCounty()) {
      if (inputEl) inputEl.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      this._processCSVText(e.target.result);
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
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
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
      if (values.some((v) => v.trim())) {
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

    // V17-M11: Verify required column 'company_name' (or an alias) is present in headers
    const hasCompanyNameHeader = this._csvHeaders.some((h) => {
      const normalised = h.toLowerCase().trim();
      return this._columnAliases[normalised] === 'company_name';
    });
    if (!hasCompanyNameHeader) {
      utils.showToast(
        "CSV must include a 'company_name' column (or equivalent such as 'name', 'organisation', 'business name'). Please check your file and try again.",
        'error'
      );
      return;
    }

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
    container.innerHTML =
      `
      <div class="col-12 mb-2">
        <div class="alert alert-success py-2 mb-2">
          <i class="bi bi-geo-alt-fill me-1"></i>
          Importing for: <strong>${utils.escapeHtml(selectedCounty)}</strong>
          <small class="text-muted ms-2">(all imported orgs will be tagged to this county)</small>
        </div>
      </div>
    ` +
      this._csvHeaders
        .map((header, idx) => {
          const mapped = this._csvColumnMap[idx] || '';
          return `
        <div class="col-md-4 mb-2">
          <label class="form-label small fw-semibold mb-1">
            CSV: "${utils.escapeHtml(header)}"
            <span class="text-muted">(sample: ${utils.escapeHtml(this._csvData[0]?.[idx] || '')})</span>
          </label>
          <select class="form-select form-select-sm" data-on-change="orgsModule._updateColumnMap" data-id="${idx}">
            <option value="">-- Skip --</option>
            <optgroup label="Organisation Fields">
              ${this._dbFields.map((f) => `<option value="${f}" ${mapped === f ? 'selected' : ''}>${f.replace(/_/g, ' ')}</option>`).join('')}
            </optgroup>
            <optgroup label="Contact Fields">
              ${this._contactFields.map((f) => `<option value="${f}" ${mapped === f ? 'selected' : ''}>${f.replace(/^contact_/, '').replace(/_/g, ' ')}</option>`).join('')}
            </optgroup>
          </select>
        </div>
      `;
        })
        .join('');

    // Add apply mapping button
    container.innerHTML += `
      <div class="col-12 mt-2">
        <button class="btn btn-primary" data-action="orgsModule._applyMapping">
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
      utils.showToast('You must map at least the "Organisation Name" column', 'error');
      return;
    }

    // Build preview
    const existingNames = new Set(STATE.allOrganisations.map((o) => (o.company_name || '').toLowerCase()));

    let newCount = 0;
    let dupCount = 0;

    const previewRows = this._csvData.map((row) => {
      const record = {};
      Object.entries(this._csvColumnMap).forEach(([idx, field]) => {
        record[field] = row[parseInt(idx)] || '';
      });

      const isDuplicate = existingNames.has((record.company_name || '').toLowerCase());
      if (isDuplicate) dupCount++;
      else newCount++;

      return { record, isDuplicate };
    });

    // Show step 3
    document.getElementById('csvStep2').style.display = 'none';
    document.getElementById('csvStep3').style.display = 'block';

    const mappedFields = [...new Set(Object.values(this._csvColumnMap))];

    const csvPreviewCountEl = document.getElementById('csvPreviewCount');
    if (csvPreviewCountEl) csvPreviewCountEl.textContent = previewRows.length;
    const csvNewCountEl = document.getElementById('csvNewCount');
    if (csvNewCountEl) csvNewCountEl.textContent = `${newCount} new`;
    const csvDuplicateCountEl = document.getElementById('csvDuplicateCount');
    if (csvDuplicateCountEl) csvDuplicateCountEl.textContent = `${dupCount} duplicates`;

    const csvPreviewHeaderEl = document.getElementById('csvPreviewHeader');
    if (csvPreviewHeaderEl) {
      csvPreviewHeaderEl.innerHTML =
        '<th>#</th>' + mappedFields.map((f) => `<th>${f.replace(/_/g, ' ')}</th>`).join('') + '<th>Status</th>';
    }

    const csvPreviewBodyEl = document.getElementById('csvPreviewBody');
    if (csvPreviewBodyEl)
      csvPreviewBodyEl.innerHTML = previewRows
        .map((item, i) => {
          const issues = this._validateImportRow(item.record);
          return `<tr class="${item.isDuplicate ? 'table-warning' : ''} ${issues.length > 0 ? 'table-danger' : ''}">
        <td class="small">${i + 1}</td>
        ${mappedFields.map((f) => `<td class="small">${utils.escapeHtml(item.record[f] || '-')}</td>`).join('')}
        <td>
          ${
            item.isDuplicate
              ? '<span class="badge bg-warning text-dark">Duplicate</span>'
              : '<span class="badge bg-success">New</span>'
          }
          ${issues.length > 0 ? `<span class="badge bg-danger ms-1" title="${utils.escapeHtml(issues.join(', '))}">Issues: ${issues.length}</span>` : ''}
        </td>
      </tr>`;
        })
        .join('');

    // Enable import button
    const importBtn = document.getElementById('csvImportBtn');
    importBtn.disabled = false;
    document.getElementById('csvImportBtnCount').textContent = newCount > 0 ? `${newCount}` : `${previewRows.length}`;

    // Store preview for import
    this._csvPreviewRows = previewRows;
  },

  /**
   * Execute the pending CSV import, inserting or merging organisation records.
   * @returns {Promise<void>}
   */
  async executeCSVImport() {
    if (!this._csvPreviewRows || this._csvPreviewRows.length === 0) {
      utils.showToast('No data to import', 'warning');
      return;
    }

    // Only import non-duplicates by default, or ask
    const newRows = this._csvPreviewRows.filter((r) => !r.isDuplicate);
    const dupRows = this._csvPreviewRows.filter((r) => r.isDuplicate);

    let rowsToImport = newRows;
    let mergeRows = [];

    if (this._importMergeMode && dupRows.length > 0) {
      // Merge mode: update existing records with new data
      mergeRows = dupRows;
      rowsToImport = newRows;
      if (
        !(await utils.confirmDialog({
          title: 'Merge Import',
          message: `Merge mode: ${dupRows.length} existing record(s) will be updated, ${newRows.length} new record(s) will be inserted. Continue?`,
          confirmText: 'Import',
          danger: false,
        }))
      )
        return;
    } else if (dupRows.length > 0 && newRows.length > 0) {
      if (
        await utils.confirmDialog({
          title: 'Duplicates Found',
          message: `${dupRows.length} duplicate(s) found. Import only the ${newRows.length} new companies?<br><br>Click "Import New Only" to skip duplicates, or Cancel and re-run to import all.`,
          confirmText: 'Import New Only',
          danger: false,
        })
      ) {
        rowsToImport = newRows;
      } else {
        rowsToImport = this._csvPreviewRows;
      }
    } else if (newRows.length === 0) {
      if (
        !(await utils.confirmDialog({
          title: 'All Duplicates',
          message: `All ${dupRows.length} companies already exist. Import them anyway as duplicates?`,
          confirmText: 'Import Anyway',
          danger: false,
        }))
      ) {
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
      const records = rowsToImport.map((item) => {
        const rec = { status: 'prospect', catchment_area: selectedCounty };
        this._dbFields.forEach((field) => {
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
        try {
          await apiClient.insert('organisations', batch);
          successCount += batch.length;
        } catch (batchErr) {
          console.error('Batch import error:', batchErr);
          errorCount += batch.length;
        }
      }

      // Handle merge mode: update existing records
      if (mergeRows.length > 0) {
        for (const item of mergeRows) {
          try {
            const existingOrg = STATE.allOrganisations.find(
              (o) => (o.company_name || '').toLowerCase() === (item.record.company_name || '').toLowerCase()
            );
            if (existingOrg) {
              const updateData = {};
              this._dbFields.forEach((field) => {
                if (item.record[field] && item.record[field].trim()) {
                  updateData[field] = item.record[field].trim();
                }
              });
              if (Object.keys(updateData).length > 0) {
                await apiClient.update('organisations', existingOrg.id, updateData);
              }
            }
          } catch (e) {
            console.error('Merge error:', e);
          }
        }
      }

      // Import contacts from contact-specific CSV columns
      const hasContactFields = Object.values(this._csvColumnMap).some((f) => this._contactFields.includes(f));
      let contactCount = 0;
      if (hasContactFields) {
        /* selectAll: justified — re-mapping imported org names to IDs after bulk CSV import */
        const freshOrgs = await apiClient.selectAll('organisations', { select: 'id, company_name' });
        const orgNameMap = {};
        (freshOrgs || []).forEach((o) => {
          orgNameMap[(o.company_name || '').toLowerCase()] = o.id;
        });

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
              receive_emails: true,
            });
          }
        }

        if (contactRecords.length > 0) {
          for (let i = 0; i < contactRecords.length; i += 50) {
            try {
              await apiClient.insert('organisation_contacts', contactRecords.slice(i, i + 50));
              contactCount += contactRecords.slice(i, i + 50).length;
            } catch (e) {
              console.warn('Contact import batch error:', e.message);
            }
          }
        }
      }

      // Track imported counties in localStorage for dashboard
      try {
        const imported = JSON.parse(localStorage.getItem('csvImportedCounties') || '{}');
        imported[selectedCounty] = {
          count: (imported[selectedCounty]?.count || 0) + successCount,
          lastImport: new Date().toISOString(),
        };
        localStorage.setItem('csvImportedCounties', JSON.stringify(imported));
      } catch (e) {
        console.warn('Failed to track imported counties:', e.message);
      }

      // Log import history
      const fileInput = document.getElementById('csvFileInput');
      const filename = fileInput?.files?.[0]?.name || 'pasted-data.csv';
      this._logImportHistory(filename, successCount, selectedCounty);

      // Close modal
      bootstrap.Modal.getInstance(document.getElementById('csvImportModal'))?.hide();

      if (errorCount === 0) {
        const contactMsg = contactCount > 0 ? ` + ${contactCount} contacts` : '';
        utils.showToast(
          `Successfully imported ${successCount} organisations${contactMsg} for ${selectedCounty}!`,
          'success'
        );
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
  async _populateFilterPresets() {
    const presetSelect = document.getElementById('orgsFilterPreset');
    if (!presetSelect) return;
    let presets = {};
    try {
      const result = await apiClient.select('user_preferences', {
        select: 'value',
        filters: { key: 'orgsFilterPresets' },
        pageSize: 1,
      });
      const data = result.data;
      if (data?.[0]?.value) {
        presets = typeof data[0].value === 'string' ? JSON.parse(data[0].value) : data[0].value;
      }
    } catch (e) {
      // Fallback to localStorage
      try {
        presets = JSON.parse(localStorage.getItem('orgsFilterPresets') || '{}');
      } catch (parseErr) {
        /* ignore */
      }
    }
    presetSelect.innerHTML =
      '<option value="">-- Saved Views --</option>' +
      Object.keys(presets)
        .map((name) => `<option value="${utils.escapeHtml(name)}">${utils.escapeHtml(name)}</option>`)
        .join('');
  },

  /**
   * Prompt for a name and save the current filter/sort/column state as a preset.
   * @returns {Promise<void>}
   */
  async saveFilterPreset() {
    const name = prompt('Name this view preset:');
    if (!name || !name.trim()) return;
    try {
      // Load existing presets from Supabase first
      let presets = {};
      try {
        const result = await apiClient.select('user_preferences', {
          select: 'value',
          filters: { key: 'orgsFilterPresets' },
          pageSize: 1,
        });
        if (result.data?.[0]?.value) {
          presets = typeof result.data[0].value === 'string' ? JSON.parse(result.data[0].value) : result.data[0].value;
        }
      } catch (fetchErr) {
        presets = JSON.parse(localStorage.getItem('orgsFilterPresets') || '{}');
      }

      presets[name.trim()] = {
        year: document.getElementById('orgsYearFilter')?.value || '',
        sector: document.getElementById('orgsSectorFilter')?.value || '',
        country: document.getElementById('orgsCountryFilter')?.value || '',
        regionId: document.getElementById('orgsRegionFilter')?.value || '',
        areaId: document.getElementById('orgsAreaFilter')?.value || '',
        status: document.getElementById('orgsStatusFilter')?.value || '',
        search: document.getElementById('orgsSearchBox')?.value || '',
        tier: document.getElementById('orgsTierFilter')?.value || '',
        tag: document.getElementById('orgsTagFilter')?.value || '',
        logoFilter: document.getElementById('orgsLogoFilter')?.value || '',
        dateFilter: document.getElementById('orgsDateFilter')?.value || '',
        sort: { field: this.sortField, direction: this.sortDirection },
        columns: { ...this._columnVisibility },
        pageSize: this._pageSize,
        tagFilters: [...(this._selectedTagFilters || [])],
      };

      // Build synced saved views
      const savedViews = Object.fromEntries(
        Object.entries(presets).map(([k, v]) => [
          k,
          { filters: v, sort: v.sort, columns: v.columns, pageSize: v.pageSize, tagFilters: v.tagFilters },
        ])
      );

      try {
        await apiClient.upsert('user_preferences', {
          key: 'orgsFilterPresets',
          value: JSON.stringify(presets),
          user_email: STATE.currentUser?.email,
        });

        // Also keep saved views in sync in Supabase
        await apiClient.upsert('user_preferences', {
          key: 'orgsSavedViews',
          value: JSON.stringify(savedViews),
          user_email: STATE.currentUser?.email,
        });
      } catch (saveErr) {
        // Fallback to localStorage
        localStorage.setItem('orgsFilterPresets', JSON.stringify(presets));
        localStorage.setItem('orgsSavedViews', JSON.stringify(savedViews));
      }

      this._populateFilterPresets();
      document.getElementById('orgsFilterPreset').value = name.trim();
      utils.showToast(`View "${name.trim()}" saved`, 'success');
    } catch (e) {
      utils.showToast('Error saving preset', 'error');
    }
  },

  /**
   * Restore filters, sort, and column visibility from a named filter preset.
   * @param {string} name - Preset name to load
   * @returns {Promise<void>}
   */
  async loadFilterPreset(name) {
    if (!name) return;
    let presets = {};
    try {
      const result = await apiClient.select('user_preferences', {
        select: 'value',
        filters: { key: 'orgsFilterPresets' },
        pageSize: 1,
      });
      if (result.data?.[0]?.value) {
        presets = typeof result.data[0].value === 'string' ? JSON.parse(result.data[0].value) : result.data[0].value;
      }
    } catch (e) {
      // Fallback to localStorage
      try {
        presets = JSON.parse(localStorage.getItem('orgsFilterPresets') || '{}');
      } catch (parseErr) {
        return;
      }
    }

    const preset = presets[name];
    if (!preset) return;
    document.getElementById('orgsYearFilter').value = preset.year || '';
    document.getElementById('orgsSectorFilter').value = preset.sector || '';
    document.getElementById('orgsCountryFilter').value = preset.country || '';
    locationModule.populateRegionDropdown(
      'orgsRegionFilter',
      preset.country || '',
      'All Regions',
      preset.regionId || ''
    );
    if (preset.regionId) document.getElementById('orgsRegionFilter').value = preset.regionId;
    locationModule.populateAreaDropdown(
      'orgsAreaFilter',
      preset.country || '',
      'All',
      preset.areaId || '',
      preset.regionId || ''
    );
    if (preset.areaId) document.getElementById('orgsAreaFilter').value = preset.areaId;
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
    // Restore sort if saved
    if (preset.sort?.field) {
      this.sortField = preset.sort.field;
      this.sortDirection = preset.sort.direction || 'asc';
    }
    // Restore column visibility if saved
    if (preset.columns) {
      this._columnVisibility = { ...preset.columns };
      try {
        localStorage.setItem('orgsColumnVisibility', JSON.stringify(this._columnVisibility));
      } catch (e) {
        console.warn('Failed to save column visibility to localStorage:', e.message);
      }
    }
    // Restore page size if saved
    if (preset.pageSize) this._pageSize = preset.pageSize;
    // Restore tag filters if saved (clear if not present in preset)
    this._selectedTagFilters = preset.tagFilters ? [...preset.tagFilters] : [];
    this.filterOrganisations();
    utils.showToast(`View "${name}" loaded`, 'success');
  },

  /**
   * Delete the currently selected filter preset after confirmation.
   * @returns {Promise<void>}
   */
  async deleteFilterPreset() {
    const presetSelect = document.getElementById('orgsFilterPreset');
    const name = presetSelect?.value;
    if (!name) {
      utils.showToast('Select a preset to delete', 'warning');
      return;
    }
    if (!(await utils.confirmDialog({ title: 'Delete Preset', message: `Delete preset "${name}"?` }))) return;
    try {
      // Load existing presets from Supabase
      let presets = {};
      try {
        const result = await apiClient.select('user_preferences', {
          select: 'value',
          filters: { key: 'orgsFilterPresets' },
          pageSize: 1,
        });
        if (result.data?.[0]?.value) {
          presets = typeof result.data[0].value === 'string' ? JSON.parse(result.data[0].value) : result.data[0].value;
        }
      } catch (fetchErr) {
        presets = JSON.parse(localStorage.getItem('orgsFilterPresets') || '{}');
      }

      delete presets[name];

      try {
        await apiClient.upsert('user_preferences', {
          key: 'orgsFilterPresets',
          value: JSON.stringify(presets),
          user_email: STATE.currentUser?.email,
        });
      } catch (saveErr) {
        localStorage.setItem('orgsFilterPresets', JSON.stringify(presets));
      }

      this._populateFilterPresets();
      utils.showToast(`Preset "${name}" deleted`, 'success');
    } catch (e) {
      /* ignore */
    }
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
  /**
   * Fetch all contacts associated with an organisation.
   * @param {string} orgId - Organisation ID
   * @returns {Promise<Array>} Array of contact objects
   */
  async loadOrgContacts(orgId) {
    try {
      const result = await apiClient.select('organisation_contacts', {
        select: '*',
        filters: { organisation_id: orgId },
        sort: { column: 'is_primary', ascending: false },
        pageSize: 1000,
      });
      return result.data || [];
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
          ${contacts
            .map(
              (c) => `<tr>
            <td class="small">${utils.escapeHtml((c.first_name || '') + ' ' + (c.last_name || ''))}</td>
            <td class="small">${utils.escapeHtml(c.job_title || '-')}</td>
            <td class="small">${c.email ? `<a href="mailto:${c.email}">${utils.escapeHtml(c.email)}</a>` : '-'}</td>
            <td class="small">${utils.escapeHtml(c.phone || c.mobile || '-')}</td>
            <td class="text-center">${c.is_primary ? '<i class="bi bi-star-fill text-warning"></i>' : `<i class="bi bi-star text-muted" style="cursor:pointer" data-action="orgsModule.setPrimaryContact" data-args='${JSON.stringify([orgId, c.id])}'></i>`}</td>
            <td class="text-center">${c.receive_emails ? '<i class="bi bi-check-circle text-success"></i>' : `<i class="bi bi-x-circle text-muted" style="cursor:pointer" data-action="orgsModule.toggleContactEmails" data-args='${JSON.stringify([orgId, c.id, true])}'></i>`}</td>
            <td><button class="btn btn-sm btn-outline-danger" data-action="orgsModule.deleteContact" data-args='${JSON.stringify([orgId, c.id])}'><i class="bi bi-trash"></i></button></td>
          </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>`;
  },

  /**
   * Add a new contact to an organisation from the contact form fields.
   * @param {string} orgId - Organisation ID
   * @returns {Promise<void>}
   */
  async addContact(orgId) {
    const firstName = document.getElementById('newContactFirstName')?.value.trim();
    const lastName = document.getElementById('newContactLastName')?.value.trim();
    const jobTitle = document.getElementById('newContactJobTitle')?.value.trim();
    const email = document.getElementById('newContactEmailAddr')?.value.trim();
    const phone = document.getElementById('newContactPhoneNum')?.value.trim();
    const isPrimary = document.getElementById('newContactIsPrimary')?.checked || false;
    const receiveEmails = document.getElementById('newContactReceiveEmails')?.checked ?? true;

    if (!firstName && !lastName) {
      utils.showToast('Please enter a name', 'warning');
      return;
    }

    try {
      if (isPrimary) {
        await apiClient.updateByFilters('organisation_contacts', { organisation_id: orgId }, { is_primary: false });
      }
      await apiClient.insert('organisation_contacts', {
        organisation_id: orgId,
        first_name: firstName || null,
        last_name: lastName || null,
        job_title: jobTitle || null,
        email: email || null,
        phone: phone || null,
        is_primary: isPrimary,
        receive_emails: receiveEmails,
      });
      utils.showToast('Contact added', 'success');
      const org = STATE.allOrganisations.find((o) => o.id === orgId);
      if (org) await this.openCompanyProfile(orgId, org.company_name);
    } catch (e) {
      console.warn('Error adding contact:', e);
      utils.showToast('Error: ' + e.message, 'error');
    }
  },

  /**
   * Delete a contact from an organisation after confirmation.
   * @param {string} orgId - Organisation ID
   * @param {string} contactId - Contact record ID to delete
   * @returns {Promise<void>}
   */
  async deleteContact(orgId, contactId) {
    if (!(await utils.confirmDialog({ title: 'Delete Contact', message: 'Delete this contact?' }))) return;
    try {
      await apiClient.delete('organisation_contacts', contactId);
      utils.showToast('Contact deleted', 'success');
      const org = STATE.allOrganisations.find((o) => o.id === orgId);
      if (org) await this.openCompanyProfile(orgId, org.company_name);
    } catch (e) {
      utils.showToast('Error: ' + e.message, 'error');
    }
  },

  /**
   * Set a specific contact as the primary contact for an organisation.
   * @param {string} orgId - Organisation ID
   * @param {string} contactId - Contact record ID to make primary
   * @returns {Promise<void>}
   */
  async setPrimaryContact(orgId, contactId) {
    try {
      await apiClient.updateByFilters('organisation_contacts', { organisation_id: orgId }, { is_primary: false });
      await apiClient.update('organisation_contacts', contactId, { is_primary: true });
      utils.showToast('Primary contact updated', 'success');
      const org = STATE.allOrganisations.find((o) => o.id === orgId);
      if (org) await this.openCompanyProfile(orgId, org.company_name);
    } catch (e) {
      utils.showToast('Error: ' + e.message, 'error');
    }
  },

  /**
   * Toggle the email opt-in/opt-out flag for a specific contact.
   * @param {string} orgId - Organisation ID
   * @param {string} contactId - Contact record ID
   * @param {boolean} value - True to opt in, false to opt out
   * @returns {Promise<void>}
   */
  async toggleContactEmails(orgId, contactId, value) {
    try {
      await apiClient.update('organisation_contacts', contactId, { receive_emails: value });
      utils.showToast(value ? 'Will receive emails' : 'Opted out of emails', 'success');
      const org = STATE.allOrganisations.find((o) => o.id === orgId);
      if (org) await this.openCompanyProfile(orgId, org.company_name);
    } catch (e) {
      utils.showToast('Error: ' + e.message, 'error');
    }
  },

  // ============================================
  // AREA 5: CUSTOM FIELDS (Database-backed)
  // ============================================
  /**
   * Fetch all custom fields for an organisation as a key-value map.
   * @param {string} orgId - Organisation ID
   * @returns {Promise<Object>} Map of field names to values
   */
  async getCustomFields(orgId) {
    try {
      /* selectAll: justified — scoped to single organisation */
      const result = await apiClient.selectAll('organisation_custom_fields', {
        filters: { organisation_id: orgId },
        sort: { column: 'field_name', ascending: true },
      });
      const fields = {};
      (result || []).forEach((f) => {
        fields[f.field_name] = f.field_value;
      });
      return fields;
    } catch (e) {
      console.warn('Failed to read custom fields from Supabase:', e.message);
      return {};
    }
  },

  /**
   * Upsert a single custom field value for an organisation.
   * @param {string} orgId - Organisation ID
   * @param {string} fieldName - Custom field name
   * @param {string|null} fieldValue - Value to set, or null to delete
   * @returns {Promise<void>}
   */
  async saveCustomField(orgId, fieldName, fieldValue) {
    try {
      if (fieldValue) {
        // upsert not supported by apiClient — try update, fall back to insert
        try {
          await apiClient.updateByFilters(
            'organisation_custom_fields',
            { organisation_id: orgId, field_name: fieldName },
            { field_value: fieldValue }
          );
        } catch (_) {
          await apiClient.insert('organisation_custom_fields', {
            organisation_id: orgId,
            field_name: fieldName,
            field_value: fieldValue,
          });
        }
      } else {
        await apiClient.deleteByFilters('organisation_custom_fields', {
          organisation_id: orgId,
          field_name: fieldName,
        });
      }
      utils.showToast('Custom field saved', 'success');
    } catch (e) {
      utils.showToast('Error saving custom field: ' + e.message, 'error');
    }
  },

  /**
   * Add a custom field to an organisation from the custom field form inputs.
   * @param {string} orgId - Organisation ID
   * @returns {Promise<void>}
   */
  async addCustomField(orgId) {
    const name = document.getElementById('customFieldName')?.value.trim();
    const value = document.getElementById('customFieldValue')?.value.trim();
    if (!name) {
      utils.showToast('Enter a field name', 'warning');
      return;
    }
    await this.saveCustomField(orgId, name, value);
    const org = STATE.allOrganisations.find((o) => o.id === orgId);
    if (org) this.openCompanyProfile(orgId, org.company_name);
  },

  /**
   * Remove a custom field from an organisation.
   * @param {string} orgId - Organisation ID
   * @param {string} fieldName - Name of the field to remove
   * @returns {Promise<void>}
   */
  async removeCustomField(orgId, fieldName) {
    await this.saveCustomField(orgId, fieldName, null);
    const org = STATE.allOrganisations.find((o) => o.id === orgId);
    if (org) this.openCompanyProfile(orgId, org.company_name);
  },

  // ============================================
  // AREA 5: DOCUMENT ATTACHMENTS
  // ============================================
  /**
   * Upload a document file for an organisation and store the reference in the database.
   * @param {string} orgId - Organisation ID
   * @returns {Promise<void>}
   */
  async uploadDocument(orgId) {
    const fileInput = document.getElementById('docUploadInput');
    const docTitle = document.getElementById('docTitle')?.value.trim() || '';
    if (!fileInput?.files?.[0]) {
      utils.showToast('Select a file', 'warning');
      return;
    }

    const file = fileInput.files[0];
    try {
      utils.showLoading('Uploading document...');
      const timestamp = Date.now();
      const fileName = `documents/${orgId}/${timestamp}_${file.name}`;
      await apiClient.upload('media-gallery', fileName, file);
      const { data: urlData } = apiClient.getPublicUrl('media-gallery', fileName);

      // Store in organisation_documents or fallback to localStorage
      try {
        await apiClient.insert('organisation_documents', {
          organisation_id: orgId,
          file_url: urlData.publicUrl,
          title: docTitle || file.name,
          file_type: file.type,
          file_size: file.size,
        });
      } catch (dbErr) {
        console.warn('Failed to save document to Supabase:', dbErr.message);
      }

      utils.showToast('Document uploaded', 'success');
      const org = STATE.allOrganisations.find((o) => o.id === orgId);
      if (org) await this.openCompanyProfile(orgId, org.company_name);
    } catch (e) {
      utils.showToast('Error: ' + e.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Fetch all document attachments for an organisation.
   * @param {string} orgId - Organisation ID
   * @returns {Promise<Array>} Array of document objects
   */
  async getDocuments(orgId) {
    try {
      /* selectAll: justified — scoped to single organisation */
      const result = await apiClient.selectAll('organisation_documents', {
        filters: { organisation_id: orgId },
        sort: { column: 'created_at', ascending: false },
      });
      return result || [];
    } catch (e) {
      console.warn('Failed to read documents from Supabase:', e.message);
      return [];
    }
  },

  // ============================================
  // AREA 6: SCHEDULED FOLLOW-UPS (Database-backed)
  // ============================================
  /**
   * Fetch all scheduled follow-ups for an organisation (or all if orgId is omitted).
   * @param {string} [orgId] - Organisation ID; omit to fetch all follow-ups
   * @returns {Promise<Array>} Array of follow-up objects
   */
  async getFollowUps(orgId) {
    try {
      const filters = {};
      if (orgId) filters.organisation_id = orgId;
      /* selectAll: justified — scoped to single organisation (or bounded follow-up list) */
      const data = await apiClient.selectAll('organisation_follow_ups', {
        filters,
        sort: { column: 'follow_up_date', ascending: true },
      });
      return (data || []).map((f) => ({
        id: f.id,
        orgId: f.organisation_id,
        companyName: f.company_name,
        date: f.follow_up_date,
        note: f.note,
        done: f.completed,
        created: f.created_at,
      }));
    } catch (e) {
      console.warn('Failed to read follow-ups from Supabase:', e.message);
      return [];
    }
  },

  /**
   * Schedule a new follow-up for an organisation from the follow-up form.
   * @param {string} orgId - Organisation ID
   * @returns {Promise<void>}
   */
  async addFollowUp(orgId) {
    const date = document.getElementById('followUpDate')?.value;
    const note = document.getElementById('followUpNote')?.value.trim();
    const assignee = document.getElementById('followUpAssignee')?.value.trim() || null;
    if (!date) {
      utils.showToast('Select a date', 'warning');
      return;
    }

    const org = STATE.allOrganisations.find((o) => o.id === orgId);
    try {
      const insertData = {
        organisation_id: orgId,
        company_name: org?.company_name || '',
        follow_up_date: date,
        note: note || null,
      };
      if (assignee) insertData.assigned_to = assignee;
      await apiClient.insert('organisation_follow_ups', insertData);
      utils.showToast('Follow-up scheduled' + (assignee ? ` (assigned to ${assignee})` : ''), 'success');
      if (org) this.openCompanyProfile(orgId, org.company_name);
    } catch (e) {
      utils.showToast('Error: ' + e.message, 'error');
    }
  },

  /**
   * Mark a follow-up as completed.
   * @param {string} orgId - Organisation ID
   * @param {string} followUpId - Follow-up record ID
   * @returns {Promise<void>}
   */
  async completeFollowUp(orgId, followUpId) {
    try {
      await apiClient.update('organisation_follow_ups', followUpId, {
        completed: true,
        completed_at: new Date().toISOString(),
      });
      utils.showToast('Follow-up completed', 'success');
      const org = STATE.allOrganisations.find((o) => o.id === orgId);
      if (org) this.openCompanyProfile(orgId, org.company_name);
    } catch (e) {
      utils.showToast('Error: ' + e.message, 'error');
    }
  },

  /**
   * Delete a follow-up after confirmation.
   * @param {string} orgId - Organisation ID
   * @param {string} followUpId - Follow-up record ID
   * @returns {Promise<void>}
   */
  async deleteFollowUp(orgId, followUpId) {
    if (
      !(await utils.confirmDialog({
        title: 'Delete Follow-Up',
        message: 'Delete this follow-up?',
        confirmText: 'Delete',
        danger: true,
      }))
    )
      return;
    try {
      await apiClient.delete('organisation_follow_ups', followUpId);
      utils.showToast('Follow-up deleted', 'success');
      const org = STATE.allOrganisations.find((o) => o.id === orgId);
      if (org) this.openCompanyProfile(orgId, org.company_name);
    } catch (e) {
      utils.showToast('Error: ' + e.message, 'error');
    }
  },

  // ============================================
  // AREA 6: SMS/WHATSAPP TEMPLATES
  // ============================================
  _smsTemplates: [
    {
      id: 'sms_shortlist',
      name: 'Shortlist SMS',
      body: 'Hi {contact_name}, great news! {company_name} has been shortlisted for the British Trade Awards. Check your email for details.',
    },
    {
      id: 'sms_winner',
      name: 'Winner SMS',
      body: 'Congratulations {contact_name}! {company_name} has won at the British Trade Awards! Details in your inbox.',
    },
    {
      id: 'sms_reminder',
      name: 'Entry Reminder',
      body: "Hi {contact_name}, just a reminder that entries for British Trade Awards close soon. Don't miss out!",
    },
  ],

  _whatsappTemplates: [
    {
      id: 'wa_shortlist',
      name: 'Shortlist WhatsApp',
      body: 'Hi {contact_name}! Exciting news - {company_name} has been shortlisted for the British Trade Awards! Check your email for all the details.',
    },
    {
      id: 'wa_winner',
      name: 'Winner WhatsApp',
      body: "Congratulations {contact_name}! We're thrilled to let you know that {company_name} has won at the British Trade Awards! Full details coming to your inbox.",
    },
    {
      id: 'wa_invite',
      name: 'Invitation WhatsApp',
      body: "Hi {contact_name}, we'd love to invite {company_name} to enter the British Trade Awards this year. Interested? Reply for more info!",
    },
  ],

  openSMSTemplate(orgId) {
    const org = STATE.allOrganisations.find((o) => o.id === orgId) || {};
    const phone = org.contact_phone || '';
    const cleanPhone = phone.replace(/[^0-9+]/g, '');

    const html = `<div class="mb-3"><strong>Phone:</strong> ${utils.escapeHtml(phone || 'No phone number')}</div>
    <h6 class="fw-semibold mb-2">SMS Templates</h6>
    <div class="list-group mb-3">
      ${this._smsTemplates
        .map((t) => {
          const body = t.body
            .replace(/{company_name}/g, org.company_name || '')
            .replace(/{contact_name}/g, org.contact_name || '');
          return `<a href="sms:${cleanPhone}?body=${encodeURIComponent(body)}" class="list-group-item list-group-item-action">
          <div class="d-flex justify-content-between"><div><h6 class="mb-1">${t.name}</h6><small class="text-muted">${utils.escapeHtml(body.substring(0, 80))}...</small></div><i class="bi bi-chat-dots text-success"></i></div>
        </a>`;
        })
        .join('')}
    </div>
    <h6 class="fw-semibold mb-2">WhatsApp Templates</h6>
    <div class="list-group">
      ${this._whatsappTemplates
        .map((t) => {
          const body = t.body
            .replace(/{company_name}/g, org.company_name || '')
            .replace(/{contact_name}/g, org.contact_name || '');
          return `<a href="https://wa.me/${cleanPhone.replace('+', '')}?text=${encodeURIComponent(body)}" target="_blank" class="list-group-item list-group-item-action">
          <div class="d-flex justify-content-between"><div><h6 class="mb-1">${t.name}</h6><small class="text-muted">${utils.escapeHtml(body.substring(0, 80))}...</small></div><i class="bi bi-whatsapp text-success"></i></div>
        </a>`;
        })
        .join('')}
    </div>`;

    this._showDynamicModal('SMS / WhatsApp', html, 'bi-phone');
  },

  // ============================================
  // AREA 7: GLOBAL AUDIT LOG WITH FILTERS & DIFF
  // ============================================
  /**
   * Open a modal showing the global audit log with filter controls.
   * @returns {Promise<void>}
   */
  async showGlobalAuditLog() {
    utils.showLoading();
    try {
      const log = await this.getAuditLog(null);
      const html = `<div class="row g-2 mb-3">
        <div class="col-md-3"><select class="form-select form-select-sm" id="auditActionFilter" data-on-change="orgsModule._filterAuditLog">
          <option value="">All Actions</option>
          <option value="status_change">Status Change</option><option value="archived">Archived</option>
          <option value="restored">Restored</option><option value="created">Created</option>
          <option value="email_sent">Email Sent</option><option value="note_added">Note Added</option>
          <option value="csv_import">CSV Import</option>
        </select></div>
        <div class="col-md-3"><input type="date" class="form-control form-control-sm" id="auditDateFrom" data-on-change="orgsModule._filterAuditLog" placeholder="From"></div>
        <div class="col-md-3"><input type="date" class="form-control form-control-sm" id="auditDateTo" data-on-change="orgsModule._filterAuditLog" placeholder="To"></div>
        <div class="col-md-3"><input type="text" class="form-control form-control-sm" id="auditSearchFilter" data-on-input="orgsModule._filterAuditLog" placeholder="Search..."></div>
      </div>
      <div id="auditLogContent" style="max-height: 500px; overflow-y: auto;">
        ${this._renderAuditEntries(log)}
      </div>`;

      this._showDynamicModal('Global Audit Log', html, 'bi-journal-text', 'modal-xl');
      this._cachedAuditLog = log;
    } catch (e) {
      utils.showToast('Error loading audit log', 'error');
    } finally {
      utils.hideLoading();
    }
  },

  _cachedAuditLog: [],

  _filterAuditLog() {
    const action = document.getElementById('auditActionFilter')?.value || '';
    const dateFrom = document.getElementById('auditDateFrom')?.value || '';
    const dateTo = document.getElementById('auditDateTo')?.value || '';
    const search = (document.getElementById('auditSearchFilter')?.value || '').toLowerCase();

    let filtered = this._cachedAuditLog;
    if (action) filtered = filtered.filter((e) => e.action === action);
    if (dateFrom) filtered = filtered.filter((e) => (e.timestamp || e.created_at) >= dateFrom);
    if (dateTo) filtered = filtered.filter((e) => (e.timestamp || e.created_at) <= dateTo + 'T23:59:59');
    if (search) {
      filtered = filtered.filter(
        (e) => (e.company_name || '').toLowerCase().includes(search) || (e.details || '').toLowerCase().includes(search)
      );
      // Fuzzy search fallback
      if (filtered.length === 0) {
        filtered = utils.fuzzyFilter(this._cachedAuditLog, search, ['company_name', 'details']);
        if (action) filtered = filtered.filter((e) => e.action === action);
        if (dateFrom) filtered = filtered.filter((e) => (e.timestamp || e.created_at) >= dateFrom);
        if (dateTo) filtered = filtered.filter((e) => (e.timestamp || e.created_at) <= dateTo + 'T23:59:59');
      }
    }

    const container = document.getElementById('auditLogContent');
    if (container) container.innerHTML = this._renderAuditEntries(filtered);
  },

  _renderAuditEntries(entries) {
    if (!entries || entries.length === 0) return '<p class="text-muted text-center">No audit entries found</p>';
    const icons = {
      status_change: 'bi-arrow-repeat text-primary',
      archived: 'bi-archive text-warning',
      restored: 'bi-arrow-counterclockwise text-success',
      created: 'bi-plus-circle text-success',
      email_sent: 'bi-envelope text-info',
      note_added: 'bi-sticky text-secondary',
      csv_import: 'bi-file-earmark-arrow-up text-primary',
    };
    return `<table class="table table-sm table-hover"><thead><tr><th>Time</th><th>User</th><th>Organisation</th><th>Action</th><th>Details</th></tr></thead><tbody>
      ${entries
        .map((e) => {
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
        })
        .join('')}
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
    if (this.selectedOrgs.size === 0) {
      utils.showToast('No organisations selected', 'warning');
      return;
    }
    const allTags = new Set();
    STATE.allOrganisations.forEach((o) => {
      if (o.tags) o.tags.forEach((t) => allTags.add(t));
    });

    const html = `<p class="small text-muted">Apply to <strong>${this.selectedOrgs.size}</strong> selected organisations</p>
      <div class="mb-3">
        <label class="form-label fw-semibold">Add Tag</label>
        <div class="input-group">
          <input type="text" class="form-control" id="bulkTagInput" list="bulkTagSuggestions" placeholder="Enter tag name...">
          <datalist id="bulkTagSuggestions">${[...allTags]
            .sort()
            .map((t) => `<option value="${utils.escapeHtml(t)}">`)
            .join('')}</datalist>
          <button class="btn btn-primary" data-action="orgsModule.executeBulkTagAdd"><i class="bi bi-plus me-1"></i>Add</button>
        </div>
      </div>
      <div class="mb-3">
        <label class="form-label fw-semibold">Remove Tag</label>
        <select class="form-select" id="bulkTagRemoveSelect">
          <option value="">-- Select tag to remove --</option>
          ${[...allTags]
            .sort()
            .map((t) => `<option value="${utils.escapeHtml(t)}">${utils.escapeHtml(t)}</option>`)
            .join('')}
        </select>
        <button class="btn btn-outline-danger btn-sm mt-2" data-action="orgsModule.executeBulkTagRemove"><i class="bi bi-trash me-1"></i>Remove from Selected</button>
      </div>`;

    this._showDynamicModal('Bulk Tag Assignment', html, 'bi-tags');
  },

  /**
   * Add a tag to all selected organisations in bulk.
   * @returns {Promise<void>}
   */
  async executeBulkTagAdd() {
    const tag = document.getElementById('bulkTagInput')?.value.trim();
    if (!tag) {
      utils.showToast('Enter a tag', 'warning');
      return;
    }

    try {
      utils.showLoading();
      const orgIds = Array.from(this.selectedOrgs);
      // Build updates for orgs that need the tag
      const updates = [];
      for (const id of orgIds) {
        const org = STATE.allOrganisations.find((o) => o.id === id);
        const currentTags = org?.tags || [];
        if (!currentTags.includes(tag)) {
          const newTags = [...currentTags, tag];
          updates.push({ id, org, newTags });
        }
      }
      // Execute in parallel batches of 5
      for (let i = 0; i < updates.length; i += 5) {
        const batch = updates.slice(i, i + 5);
        await Promise.all(
          batch.map(({ id, org, newTags }) => {
            if (org) org.tags = newTags;
            return apiClient.update('organisations', id, { tags: newTags });
          })
        );
      }
      utils.showToast(`Tag "${tag}" added to ${updates.length} org(s)`, 'success');
      this.renderOrganisations();
    } catch (e) {
      utils.showToast('Error: ' + e.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Remove a selected tag from all selected organisations in bulk.
   * @returns {Promise<void>}
   */
  async executeBulkTagRemove() {
    const tag = document.getElementById('bulkTagRemoveSelect')?.value;
    if (!tag) {
      utils.showToast('Select a tag', 'warning');
      return;
    }

    try {
      utils.showLoading();
      const orgIds = Array.from(this.selectedOrgs);
      // Build updates for orgs that have the tag
      const updates = [];
      for (const id of orgIds) {
        const org = STATE.allOrganisations.find((o) => o.id === id);
        const currentTags = org?.tags || [];
        if (currentTags.includes(tag)) {
          const newTags = currentTags.filter((t) => t !== tag);
          updates.push({ id, org, newTags });
        }
      }
      // Execute in parallel batches of 5
      for (let i = 0; i < updates.length; i += 5) {
        const batch = updates.slice(i, i + 5);
        await Promise.all(
          batch.map(({ id, org, newTags }) => {
            if (org) org.tags = newTags;
            return apiClient.update('organisations', id, { tags: newTags });
          })
        );
      }
      utils.showToast(`Tag "${tag}" removed from ${updates.length} org(s)`, 'success');
      this.renderOrganisations();
    } catch (e) {
      utils.showToast('Error: ' + e.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  // ============================================
  // AREA 8: BULK ASSIGN TO AWARD
  // ============================================
  /**
   * Open a modal to bulk-assign the selected organisations to an award.
   * @returns {Promise<void>}
   */
  async showBulkAssignAwardModal() {
    if (this.selectedOrgs.size === 0) {
      utils.showToast('No organisations selected', 'warning');
      return;
    }

    utils.showLoading();
    try {
      /* selectAll: justified — small reference table (awards for bulk-assign dropdown) */
      const awards = await apiClient.selectAll('awards', {
        select: 'id, award_name, county, sector, year',
        sort: { column: 'year', ascending: false },
      });
      const html = `<p class="small text-muted">Assign <strong>${this.selectedOrgs.size}</strong> selected organisations to an award</p>
        <div class="mb-3">
          <label class="form-label fw-semibold">Select Award</label>
          <select class="form-select" id="bulkAssignAwardSelect">
            <option value="">-- Select Award --</option>
            ${(awards || []).map((a) => `<option value="${a.id}">${utils.escapeHtml(a.year + ' - ' + (a.award_name || a.county + ' ' + utils.toTitleCase(a.sector)))}</option>`).join('')}
          </select>
        </div>
        <div class="mb-3">
          <label class="form-label fw-semibold">Assignment Status</label>
          <select class="form-select" id="bulkAssignStatus">
            <option value="nominated">Nominated</option><option value="shortlisted">Shortlisted</option><option value="winner">Winner</option>
          </select>
        </div>
        <button class="btn btn-primary" data-action="orgsModule.executeBulkAssignAward"><i class="bi bi-trophy me-1"></i>Assign</button>`;

      this._showDynamicModal('Bulk Assign to Award', html, 'bi-trophy');
    } catch (e) {
      utils.showToast('Error loading awards', 'error');
    } finally {
      utils.hideLoading();
    }
  },

  /**
   * Execute the bulk award assignment for all selected organisations.
   * @returns {Promise<void>}
   */
  async executeBulkAssignAward() {
    const awardId = document.getElementById('bulkAssignAwardSelect')?.value;
    const status = document.getElementById('bulkAssignStatus')?.value || 'nominated';
    if (!awardId) {
      utils.showToast('Select an award', 'warning');
      return;
    }

    try {
      utils.showLoading();
      const orgIds = Array.from(this.selectedOrgs);
      const records = orgIds.map((orgId) => ({ award_id: awardId, organisation_id: orgId, status }));
      // upsert not supported by apiClient — insert with conflict handled server-side
      for (const record of records) {
        try {
          await apiClient.insert('award_assignments', record);
        } catch (_) {
          await apiClient.updateByFilters(
            'award_assignments',
            { award_id: record.award_id, organisation_id: record.organisation_id },
            { status: record.status }
          );
        }
      }
      // Auto-promote prospects/entrants to nominee
      await this._autoPromoteStatus(orgIds);
      utils.showToast(`${orgIds.length} org(s) assigned to award`, 'success');
      await this.loadOrganisations();
    } catch (e) {
      utils.showToast('Error: ' + e.message, 'error');
    } finally {
      utils.hideLoading();
    }
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
    const org1 = STATE.allOrganisations.find((o) => o.id === id1);
    const org2 = STATE.allOrganisations.find((o) => o.id === id2);
    if (!org1 || !org2) return;

    const fields = [
      'company_name',
      'contact_name',
      'email',
      'contact_phone',
      'website',
      'sector',
      'county_city',
      'address',
      'catchment_area',
      'description',
      'tier',
      'status',
      'logo_url',
    ];

    const html = `<div class="alert alert-warning small"><i class="bi bi-exclamation-triangle me-2"></i>Select which value to keep for each field. The other organisation will be deleted.</div>
    <table class="table table-sm"><thead><tr><th>Field</th><th>Organisation A</th><th>Organisation B</th></tr></thead><tbody>
    ${fields
      .map((f) => {
        const v1 = org1[f] || '';
        const v2 = org2[f] || '';
        return `<tr>
        <td class="fw-semibold small">${f.replace(/_/g, ' ')}</td>
        <td><label class="d-flex align-items-center small"><input type="radio" name="merge_${f}" value="a" class="me-2" ${v1 ? 'checked' : ''}>${utils.escapeHtml(String(v1) || '(empty)')}</label></td>
        <td><label class="d-flex align-items-center small"><input type="radio" name="merge_${f}" value="b" class="me-2" ${!v1 && v2 ? 'checked' : ''}>${utils.escapeHtml(String(v2) || '(empty)')}</label></td>
      </tr>`;
      })
      .join('')}
    </tbody></table>
    <button class="btn btn-danger" data-action="orgsModule.executeMerge" data-args='${JSON.stringify([id1, id2])}'><i class="bi bi-intersect me-1"></i>Merge (keeps selected values, deletes other)</button>`;

    this._showDynamicModal('Merge Organisations', html, 'bi-intersect', 'modal-lg');
  },

  /**
   * Merge two organisations, transferring all related records to the primary one.
   * @param {string} id1 - ID of the primary (keeper) organisation
   * @param {string} id2 - ID of the organisation to delete after merge
   * @returns {Promise<void>}
   */
  async executeMerge(id1, id2) {
    if (
      !(await utils.confirmDialog({
        title: 'Merge Organisations',
        message: 'This will merge the two organisations. The non-primary org will be deleted. Continue?',
        confirmText: 'Merge',
      }))
    )
      return;

    const org1 = STATE.allOrganisations.find((o) => o.id === id1);
    const org2 = STATE.allOrganisations.find((o) => o.id === id2);
    if (!org1 || !org2) {
      utils.showToast('Could not find both organisations', 'error');
      return;
    }
    const fields = [
      'company_name',
      'contact_name',
      'email',
      'contact_phone',
      'website',
      'sector',
      'county_city',
      'address',
      'catchment_area',
      'description',
      'tier',
      'status',
      'logo_url',
    ];

    const merged = {};
    const keepId = id1,
      deleteId = id2;
    fields.forEach((f) => {
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
      await apiClient.update('organisations', keepId, merged);

      // Transfer all related records from deleted org to keeper
      await Promise.all([
        apiClient.updateByFilters('award_assignments', { organisation_id: deleteId }, { organisation_id: keepId }),
        apiClient.updateByFilters('entries', { organisation_id: deleteId }, { organisation_id: keepId }),
        apiClient.updateByFilters('invoices', { organisation_id: deleteId }, { organisation_id: keepId }),
        apiClient.updateByFilters('organisation_contacts', { organisation_id: deleteId }, { organisation_id: keepId }),
        apiClient.updateByFilters('organisation_notes', { organisation_id: deleteId }, { organisation_id: keepId }),
        apiClient.updateByFilters(
          'organisation_follow_ups',
          { organisation_id: deleteId },
          { organisation_id: keepId }
        ),
        apiClient.updateByFilters('organisation_images', { organisation_id: deleteId }, { organisation_id: keepId }),
        apiClient.updateByFilters('organisation_documents', { organisation_id: deleteId }, { organisation_id: keepId }),
      ]);

      // Merge tags
      const keeperTags = org1.tags || [];
      const deletedTags = org2.tags || [];
      const mergedTags = [...new Set([...keeperTags, ...deletedTags])];
      await apiClient.update('organisations', keepId, { tags: mergedTags });

      // Delete the other org
      await apiClient.delete('organisations', deleteId);

      utils.showToast('Organisations merged successfully', 'success');
      this.selectedOrgs.clear();
      await this.loadOrganisations();
    } catch (e) {
      utils.showToast('Error: ' + e.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  // ============================================
  // AREA 9: DATA QUALITY
  // ============================================
  calculateCompletenessScore(org) {
    const keyFields = [
      'company_name',
      'email',
      'contact_name',
      'contact_phone',
      'website',
      'logo_url',
      'sector',
      'county_city',
      'address',
      'description',
    ];
    const filled = keyFields.filter((f) => org[f]).length;
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
    const orgs = STATE.allOrganisations.filter((o) => (o.status || 'prospect') !== 'archived');

    // Calculate stats
    const missingEmail = orgs.filter((o) => !o.email);
    const missingPhone = orgs.filter((o) => !o.contact_phone);
    const missingLogo = orgs.filter((o) => !o.logo_url);
    const missingWebsite = orgs.filter((o) => !o.website);
    const missingContact = orgs.filter((o) => !o.contact_name);
    const missingDescription = orgs.filter((o) => !o.description);

    const invalidEmails = orgs.filter((o) => o.email && !this.validateEmail(o.email).valid);
    const staleOrgs = orgs.filter((o) => {
      const updated = new Date(o.updated_at || o.created_at || 0);
      return Date.now() - updated.getTime() > 180 * 24 * 60 * 60 * 1000;
    });

    // Average completeness
    const avgCompleteness =
      orgs.length > 0
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
          {
            label: 'Missing Description',
            count: missingDescription.length,
            field: 'description',
            icon: 'bi-text-paragraph',
          },
        ]
          .map(
            (item) => `
          <a href="#" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
             data-action="orgsModule.filterByMissingField" data-id="${item.field}">
            <span><i class="bi ${item.icon} me-2"></i>${item.label}</span>
            <span class="badge ${item.count > 0 ? 'bg-warning text-dark' : 'bg-success'}">${item.count}</span>
          </a>
        `
          )
          .join('')}
      </div>
      ${
        invalidEmails.length > 0
          ? `
        <h6 class="fw-semibold mb-2">Invalid Emails</h6>
        <div class="table-responsive mb-3" style="max-height: 200px; overflow-y: auto;">
          <table class="table table-sm"><thead><tr><th>Organisation</th><th>Email</th><th>Issue</th></tr></thead><tbody>
            ${invalidEmails
              .slice(0, 50)
              .map((o) => {
                const v = this.validateEmail(o.email);
                return `<tr><td class="small">${utils.escapeHtml(o.company_name)}</td><td class="small">${utils.escapeHtml(o.email)}</td><td class="small text-danger">${v.reason}</td></tr>`;
              })
              .join('')}
          </tbody></table>
        </div>`
          : ''
      }
      ${
        staleOrgs.length > 0
          ? `
        <h6 class="fw-semibold mb-2">Stale Records (6+ months without updates)</h6>
        <div class="table-responsive" style="max-height: 200px; overflow-y: auto;">
          <table class="table table-sm"><thead><tr><th>Organisation</th><th>Last Updated</th><th>Status</th></tr></thead><tbody>
            ${staleOrgs
              .slice(0, 50)
              .map(
                (o) => `<tr>
              <td class="small">${utils.escapeHtml(o.company_name)}</td>
              <td class="small text-muted">${o.updated_at ? new Date(o.updated_at).toLocaleDateString('en-GB') : 'Never'}</td>
              <td>${this.getStatusBadge(o.status || 'prospect')}</td>
            </tr>`
              )
              .join('')}
          </tbody></table>
        </div>`
          : ''
      }`;

    this._showDynamicModal('Data Quality Wizard', html, 'bi-shield-check', 'modal-lg');
  },

  // ============================================
  // AREA 10: ANALYTICS & REPORTING
  // ============================================
  showAnalyticsDashboard() {
    const orgs = STATE.allOrganisations.filter((o) => (o.status || 'prospect') !== 'archived');

    // Sector breakdown
    const sectorCounts = {};
    orgs.forEach((o) => {
      if (o.sector) sectorCounts[o.sector] = (sectorCounts[o.sector] || 0) + 1;
    });
    const topSectors = Object.entries(sectorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    const maxSectorCount = topSectors[0]?.[1] || 1;

    // Regional distribution
    const regionCounts = {};
    orgs.forEach((o) => {
      if (o.county_city) regionCounts[o.county_city] = (regionCounts[o.county_city] || 0) + 1;
    });
    const topRegions = Object.entries(regionCounts).sort((a, b) => b[1] - a[1]);
    const maxRegionCount = topRegions[0]?.[1] || 1;

    // Status pipeline
    const statusCounts = { prospect: 0, entrant: 0, nominee: 0, shortlisted: 0, winner: 0, sponsor: 0, past_winner: 0 };
    orgs.forEach((o) => {
      const s = o.status || 'prospect';
      if (statusCounts[s] !== undefined) statusCounts[s]++;
    });
    const conversionRates = this._calculateConversionRates(statusCounts);

    // Year-over-year growth
    const yearCounts = {};
    STATE.allOrganisations.forEach((o) => {
      const year = o.created_at ? new Date(o.created_at).getFullYear() : null;
      if (year) yearCounts[year] = (yearCounts[year] || 0) + 1;
    });
    const years = Object.keys(yearCounts).sort();

    // Win rate by sector
    const sectorWinData = {};
    orgs.forEach((o) => {
      if (o.sector) {
        if (!sectorWinData[o.sector]) sectorWinData[o.sector] = { total: 0, winners: 0 };
        sectorWinData[o.sector].total++;
        if (o.status === 'winner' || o.status === 'past_winner') sectorWinData[o.sector].winners++;
      }
    });
    const winRates = Object.entries(sectorWinData)
      .map(([sector, data]) => ({
        sector,
        rate: data.total > 0 ? Math.round((data.winners / data.total) * 100) : 0,
        winners: data.winners,
        total: data.total,
      }))
      .filter((d) => d.winners > 0)
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 10);

    const statusColors = {
      prospect: '#6c757d',
      entrant: '#0dcaf0',
      nominee: '#0d6efd',
      shortlisted: '#ffc107',
      winner: '#198754',
      sponsor: '#dc3545',
      past_winner: '#212529',
    };

    const html = `
      <div class="row g-4">
        <!-- Sector Breakdown -->
        <div class="col-md-6">
          <h6 class="fw-semibold mb-3"><i class="bi bi-pie-chart me-2"></i>Sector Breakdown (Top 10)</h6>
          <div class="card"><div class="card-body">
            ${topSectors
              .map(
                ([sector, count]) => `
              <div class="d-flex align-items-center mb-2">
                <span class="small text-truncate me-2" style="width: 120px;" title="${utils.escapeHtml(utils.toTitleCase(sector))}">${utils.escapeHtml(utils.toTitleCase(sector))}</span>
                <div class="flex-grow-1"><div class="progress" style="height: 20px;">
                  <div class="progress-bar bg-info" style="width: ${(count / maxSectorCount) * 100}%">${count}</div>
                </div></div>
              </div>`
              )
              .join('')}
            ${topSectors.length === 0 ? '<p class="text-muted small">No sector data</p>' : ''}
          </div></div>
        </div>

        <!-- Regional Distribution -->
        <div class="col-md-6">
          <h6 class="fw-semibold mb-3"><i class="bi bi-geo-alt me-2"></i>Regional Distribution</h6>
          <div class="card"><div class="card-body">
            ${topRegions
              .map(
                ([region, count]) => `
              <div class="d-flex align-items-center mb-2">
                <span class="small text-truncate me-2" style="width: 120px;" title="${utils.escapeHtml(region)}">${utils.escapeHtml(region)}</span>
                <div class="flex-grow-1"><div class="progress" style="height: 20px;">
                  <div class="progress-bar bg-success" style="width: ${(count / maxRegionCount) * 100}%">${count}</div>
                </div></div>
              </div>`
              )
              .join('')}
            ${topRegions.length === 0 ? '<p class="text-muted small">No region data</p>' : ''}
          </div></div>
        </div>

        <!-- Status Pipeline with Conversion Rates -->
        <div class="col-md-6">
          <h6 class="fw-semibold mb-3"><i class="bi bi-funnel me-2"></i>Status Pipeline & Conversion</h6>
          <div class="card"><div class="card-body">
            ${['prospect', 'entrant', 'nominee', 'shortlisted', 'winner']
              .map((s, i, arr) => {
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
              })
              .join('')}
          </div></div>
        </div>

        <!-- Year-over-Year Growth -->
        <div class="col-md-6">
          <h6 class="fw-semibold mb-3"><i class="bi bi-graph-up me-2"></i>Year-over-Year Growth</h6>
          <div class="card"><div class="card-body">
            ${
              years.length > 0
                ? (() => {
                    const maxYearCount = Math.max(...Object.values(yearCounts)) || 1;
                    return years
                      .map((y, i) => {
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
                      })
                      .join('');
                  })()
                : '<p class="text-muted small">No year data available</p>'
            }
          </div></div>
        </div>

        <!-- Win Rate by Sector -->
        <div class="col-12">
          <h6 class="fw-semibold mb-3"><i class="bi bi-trophy me-2"></i>Win Rate by Sector</h6>
          <div class="card"><div class="card-body">
            ${
              winRates.length > 0
                ? `<div class="table-responsive"><table class="table table-sm"><thead><tr><th>Sector</th><th>Total Orgs</th><th>Winners</th><th>Win Rate</th><th></th></tr></thead><tbody>
              ${winRates
                .map(
                  (d) => `<tr>
                <td class="small fw-semibold">${utils.escapeHtml(utils.toTitleCase(d.sector))}</td>
                <td class="small">${d.total}</td>
                <td class="small">${d.winners}</td>
                <td class="small fw-bold ${d.rate >= 50 ? 'text-success' : d.rate >= 25 ? 'text-warning' : 'text-muted'}">${d.rate}%</td>
                <td><div class="progress" style="height: 12px; width: 100px;"><div class="progress-bar bg-success" style="width: ${d.rate}%"></div></div></td>
              </tr>`
                )
                .join('')}
            </tbody></table></div>`
                : '<p class="text-muted small">No winners data to show win rates</p>'
            }
          </div></div>
        </div>

        <!-- Engagement Distribution -->
        <div class="col-md-6">
          <h6 class="fw-semibold mb-3"><i class="bi bi-speedometer2 me-2"></i>Engagement Distribution</h6>
          <div class="card"><div class="card-body">
            ${(() => {
              const buckets = { '0-20': 0, '21-40': 0, '41-60': 0, '61-80': 0, '81-100': 0 };
              orgs.forEach((o) => {
                const s = this.calculateEngagementScore(o);
                if (s <= 20) buckets['0-20']++;
                else if (s <= 40) buckets['21-40']++;
                else if (s <= 60) buckets['41-60']++;
                else if (s <= 80) buckets['61-80']++;
                else buckets['81-100']++;
              });
              const maxB = Math.max(...Object.values(buckets)) || 1;
              const colors = {
                '0-20': '#dc3545',
                '21-40': '#fd7e14',
                '41-60': '#ffc107',
                '61-80': '#20c997',
                '81-100': '#198754',
              };
              return Object.entries(buckets)
                .map(
                  ([range, count]) => `
                <div class="d-flex align-items-center mb-2">
                  <span class="small fw-semibold me-2" style="width: 55px;">${range}</span>
                  <div class="flex-grow-1"><div class="progress" style="height: 20px;">
                    <div class="progress-bar" style="width: ${(count / maxB) * 100}%; background-color: ${colors[range]}">${count}</div>
                  </div></div>
                </div>`
                )
                .join('');
            })()}
          </div></div>
        </div>

        <!-- Tier Distribution -->
        <div class="col-md-6">
          <h6 class="fw-semibold mb-3"><i class="bi bi-gem me-2"></i>Tier Distribution</h6>
          <div class="card"><div class="card-body">
            ${(() => {
              const tierCounts = { Platinum: 0, Gold: 0, Silver: 0, Bronze: 0, None: 0 };
              orgs.forEach((o) => {
                tierCounts[o.tier || 'None']++;
              });
              const maxT = Math.max(...Object.values(tierCounts)) || 1;
              const tierColors = {
                Platinum: '#E5E4E2',
                Gold: '#FFD700',
                Silver: '#C0C0C0',
                Bronze: '#CD7F32',
                None: '#dee2e6',
              };
              return Object.entries(tierCounts)
                .map(
                  ([tier, count]) => `
                <div class="d-flex align-items-center mb-2">
                  <span class="small fw-semibold me-2" style="width: 65px;">${tier}</span>
                  <div class="flex-grow-1"><div class="progress" style="height: 20px;">
                    <div class="progress-bar" style="width: ${(count / maxT) * 100}%; background-color: ${tierColors[tier]}; color: #333;">${count}</div>
                  </div></div>
                </div>`
                )
                .join('');
            })()}
          </div></div>
        </div>
      </div>`;

    this._showDynamicModal('Analytics & Reporting', html, 'bi-bar-chart', 'modal-xl');
  },

  // ============================================
  // AREA 11: ENHANCED IMPORT/EXPORT
  // ============================================
  // Excel Export (V17-M13: includes custom fields as extra columns)
  /**
   * Export the currently filtered organisations list (with custom fields) as an Excel file.
   * @returns {Promise<void>}
   */
  async exportToExcel() {
    const data = STATE.filteredOrganisations;
    if (data.length === 0) {
      utils.showToast('No organisations to export', 'warning');
      return;
    }

    // V17-M13: Batch-fetch all custom fields for exported orgs to avoid N+1 queries
    const customFieldsMap = {}; // { orgId: { fieldName: fieldValue, ... } }
    let allCustomFieldNames = []; // sorted list of all unique custom field names across all orgs
    try {
      const orgIds = data.map((o) => o.id).filter(Boolean);
      if (orgIds.length > 0) {
        /* selectAll: justified — scoped to a bounded export set */
        const cfResult = await apiClient.selectAll('organisation_custom_fields', {
          filters: { organisation_id: { op: 'in', value: orgIds } },
          sort: { column: 'field_name', ascending: true },
        });
        (cfResult || []).forEach((row) => {
          if (!customFieldsMap[row.organisation_id]) customFieldsMap[row.organisation_id] = {};
          customFieldsMap[row.organisation_id][row.field_name] = row.field_value;
        });
        // Collect all unique field names across all orgs
        const nameSet = new Set();
        Object.values(customFieldsMap).forEach((fields) => Object.keys(fields).forEach((k) => nameSet.add(k)));
        allCustomFieldNames = [...nameSet].sort();
      }
    } catch (cfErr) {
      console.warn('Could not fetch custom fields for export:', cfErr.message);
    }

    // Build XML Spreadsheet (compatible with Excel without external libs)
    const headers = [
      'Organisation Name',
      'Sector',
      'Area',
      'Region',
      'Contact Name',
      'Email',
      'Phone',
      'Website',
      'Status',
      'Tier',
      'Tags',
      'Awards Count',
      'Address',
      'Catchment Area',
      'Description',
      'Year Founded',
      'Employees',
      'Engagement Score',
      'Health Status',
      'Last Contacted',
      // Append custom field columns at end
      ...allCustomFieldNames.map((n) => `Custom: ${n}`),
    ];
    const xmlHeader =
      '<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Organisations"><Table>';
    const headerRow =
      '<Row>' +
      headers.map((h) => `<Cell><Data ss:Type="String">${this._xmlEscape(h)}</Data></Cell>`).join('') +
      '</Row>';
    const dataRows = data
      .map((org) => {
        const engagement = this.calculateEngagementScore(org);
        const health = this.getOrgHealthIndicator(org);
        const lastContacted = this.getLastContacted(org.id);
        const orgCustomFields = customFieldsMap[org.id] || {};
        const vals = [
          org.company_name,
          org.sector,
          org.county,
          org.county_city,
          org.contact_name,
          org.email,
          org.contact_phone,
          org.website,
          org.status || 'prospect',
          org.tier,
          (org.tags || []).join(', '),
          String(org.awards_count || 0),
          org.address,
          org.catchment_area,
          org.description,
          org.year_founded ? String(org.year_founded) : '',
          org.employee_count ? String(org.employee_count) : '',
          String(engagement),
          health.label,
          lastContacted ? new Date(lastContacted).toLocaleDateString('en-GB') : 'Never',
          // Append custom field values in the same order as headers
          ...allCustomFieldNames.map((n) => orgCustomFields[n] || ''),
        ];
        return (
          '<Row>' +
          vals.map((v) => `<Cell><Data ss:Type="String">${this._xmlEscape(v || '')}</Data></Cell>`).join('') +
          '</Row>'
        );
      })
      .join('');
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

  // PDF Export
  exportToPDF() {
    const data = STATE.filteredOrganisations;
    if (data.length === 0) {
      utils.showToast('No organisations to export', 'warning');
      return;
    }

    const exportData = data.map((org) => ({
      company_name: org.company_name || '',
      sector: org.sector || '',
      county: org.county || '',
      county_city: org.county_city || '',
      contact_name: org.contact_name || '',
      email: org.email || '',
      status: org.status || 'prospect',
    }));
    utils.exportToPrintablePDF(exportData, 'Organisations Report', {
      columns: ['company_name', 'sector', 'county', 'county_city', 'contact_name', 'email', 'status'],
    });
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
    } catch (e) {
      /* ignore */
    }
  },

  showImportHistory() {
    try {
      const history = JSON.parse(localStorage.getItem('orgImportHistory') || '[]');
      const html =
        history.length === 0
          ? '<p class="text-muted text-center">No import history yet</p>'
          : `<div class="table-responsive"><table class="table table-sm"><thead><tr><th>Date</th><th>File</th><th>Area</th><th>Records</th></tr></thead><tbody>
          ${history
            .map(
              (h) => `<tr>
            <td class="small">${new Date(h.date).toLocaleDateString('en-GB')} ${new Date(h.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</td>
            <td class="small">${utils.escapeHtml(h.filename || 'N/A')}</td>
            <td class="small">${utils.escapeHtml(h.county || 'N/A')}</td>
            <td class="small fw-semibold">${h.count}</td>
          </tr>`
            )
            .join('')}
        </tbody></table></div>`;

      this._showDynamicModal('Import History', html, 'bi-clock-history');
    } catch (e) {
      utils.showToast('Error loading history', 'error');
    }
  },

  // Enhanced CSV import with validation
  _validateImportRow(record) {
    const issues = [];
    if (!record.company_name || record.company_name.trim().length < 2) issues.push('Company name too short');
    if (record.email && !this.validateEmail(record.email).valid)
      issues.push('Invalid email: ' + this.validateEmail(record.email).reason);
    if (record.website && !/^https?:\/\/.+\..+/.test(record.website) && !/^.+\..+/.test(record.website))
      issues.push('Invalid website URL');
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
  /**
   * Load and merge all activity types (audit, comms, notes, follow-ups, assignments, invoices) into a unified timeline.
   * @param {string} orgId - Organisation ID
   * @returns {Promise<Array>} Sorted array of timeline event objects
   */
  async loadUnifiedTimeline(orgId) {
    try {
      const [auditLog, commsLog, notes, followUps] = await Promise.all([
        this.getAuditLog(orgId),
        this.getCommsHistory(orgId),
        this.getThreadedNotes(orgId),
        this.getFollowUps(orgId),
      ]);

      // Also load award assignments for this org
      let assignments = [];
      try {
        const result = await apiClient.select('award_assignments', {
          select: '*, awards:award_years!award_assignments_award_id_fkey(award_name, year)',
          filters: { organisation_id: orgId },
          pageSize: 1000,
        });
        assignments = result.data || [];
      } catch (e) {
        /* ignore */
      }

      // Also load invoices
      let invoices = [];
      try {
        const result = await apiClient.select('invoices', {
          select: 'id, invoice_number, total_amount, status, created_at',
          filters: { organisation_id: orgId },
          pageSize: 1000,
        });
        invoices = result.data || [];
      } catch (e) {
        /* ignore */
      }

      const timeline = [
        ...auditLog.map((e) => ({
          ...e,
          _type: 'audit',
          _date: new Date(e.timestamp || e.created_at),
          _icon: 'bi-clock-history text-muted',
          _label: e.details || e.action,
        })),
        ...commsLog.map((e) => ({
          ...e,
          _type: 'comms',
          _date: new Date(e.timestamp || e.created_at),
          _icon: 'bi-envelope-check text-success',
          _label: `Email: ${e.templateName || e.template_name || 'Unknown'}`,
        })),
        ...notes.map((e) => ({
          ...e,
          _type: 'note',
          _date: new Date(e.created_at),
          _icon: 'bi-chat-left-text text-info',
          _label: `Note by ${e.author || 'Unknown'}: ${(e.content || '').substring(0, 80)}`,
        })),
        ...followUps
          .filter((f) => f.done)
          .map((f) => ({
            ...f,
            _type: 'followup',
            _date: new Date(f.created),
            _icon: 'bi-check-circle text-success',
            _label: `Follow-up completed: ${f.note || 'N/A'}`,
          })),
        ...assignments.map((a) => ({
          ...a,
          _type: 'assignment',
          _date: new Date(a.created_at),
          _icon: 'bi-trophy text-warning',
          _label: `Award assignment: ${a.awards?.award_name || 'Unknown'} (${a.status})`,
        })),
        ...invoices.map((inv) => ({
          ...inv,
          _type: 'invoice',
          _date: new Date(inv.created_at),
          _icon: 'bi-receipt text-primary',
          _label: `Invoice #${inv.invoice_number || 'N/A'}: £${parseFloat(inv.total_amount || 0).toFixed(2)} (${inv.status})`,
        })),
      ]
        .sort((a, b) => b._date - a._date)
        .slice(0, 50);

      return timeline;
    } catch (e) {
      return [];
    }
  },

  renderUnifiedTimeline(timeline) {
    if (!timeline || timeline.length === 0) return '<p class="text-muted small">No activity recorded yet</p>';
    const iconMap = {
      status_change: 'bi-arrow-repeat text-primary',
      archived: 'bi-archive text-warning',
      restored: 'bi-arrow-counterclockwise text-success',
      created: 'bi-plus-circle text-success',
      email_sent: 'bi-envelope text-info',
      note_added: 'bi-sticky text-secondary',
      csv_import: 'bi-file-earmark-arrow-up text-primary',
      field_changed: 'bi-pencil text-info',
    };

    return `<div class="list-group list-group-flush" style="max-height: 400px; overflow-y: auto;">
      ${timeline
        .map((e) => {
          const icon = e._type === 'audit' ? iconMap[e.action] || e._icon : e._icon;
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
        })
        .join('')}
    </div>`;
  },

  // ============================================
  // FEATURE 3: RELATIONSHIP MAPPING
  // ============================================
  /**
   * Fetch all outgoing and incoming organisation relationship records.
   * @param {string} orgId - Organisation ID
   * @returns {Promise<{outgoing: Array, incoming: Array}>}
   */
  async getRelationships(orgId) {
    try {
      const outRes = await apiClient.select('organisation_relationships', {
        select: '*, related:related_organisation_id(id, company_name, logo_url, status)',
        filters: { organisation_id: orgId },
        pageSize: 1000,
      });
      const inRes = await apiClient.select('organisation_relationships', {
        select: '*, source:organisation_id(id, company_name, logo_url, status)',
        filters: { related_organisation_id: orgId },
        pageSize: 1000,
      });
      const outgoing = outRes.data;
      const incoming = inRes.data;
      return { outgoing: outgoing || [], incoming: incoming || [] };
    } catch (e) {
      return { outgoing: [], incoming: [] };
    }
  },

  /**
   * Add a relationship link between this organisation and another found by name.
   * @param {string} orgId - Organisation ID
   * @returns {Promise<void>}
   */
  async addRelationship(orgId) {
    const relatedName = document.getElementById('relatedOrgSearch')?.value.trim();
    const relType = document.getElementById('relationshipType')?.value || 'related';
    if (!relatedName) {
      utils.showToast('Search for an organisation', 'warning');
      return;
    }

    const related = STATE.allOrganisations.find(
      (o) => o.company_name?.toLowerCase() === relatedName.toLowerCase() && o.id !== orgId
    );
    if (!related) {
      utils.showToast('Organisation not found', 'error');
      return;
    }

    try {
      await apiClient.insert('organisation_relationships', {
        organisation_id: orgId,
        related_organisation_id: related.id,
        relationship_type: relType,
      });
      utils.showToast('Relationship added', 'success');
      const org = STATE.allOrganisations.find((o) => o.id === orgId);
      if (org) this.openCompanyProfile(orgId, org.company_name);
    } catch (e) {
      utils.showToast('Error: ' + e.message, 'error');
    }
  },

  /**
   * Delete a relationship record between two organisations.
   * @param {string} relId - Relationship record ID
   * @param {string} orgId - Organisation ID (used to refresh the profile)
   * @returns {Promise<void>}
   */
  async removeRelationship(relId, orgId) {
    try {
      await apiClient.delete('organisation_relationships', relId);
      utils.showToast('Relationship removed', 'success');
      const org = STATE.allOrganisations.find((o) => o.id === orgId);
      if (org) this.openCompanyProfile(orgId, org.company_name);
    } catch (e) {
      utils.showToast('Error: ' + e.message, 'error');
    }
  },

  renderRelationships(relationships, orgId) {
    if (!relationships) return '<p class="text-muted small mb-0">No relationships</p>';
    let all;
    if (Array.isArray(relationships)) {
      all = relationships.map((r) => ({
        id: r.id,
        type: r.relationship_type,
        org: r.related || { id: r.related_org_id, company_name: r.related_org_name },
        direction: 'outgoing',
      }));
    } else {
      all = [
        ...(relationships.outgoing || []).map((r) => ({
          id: r.id,
          type: r.relationship_type,
          org: r.related,
          direction: 'outgoing',
        })),
        ...(relationships.incoming || []).map((r) => ({
          id: r.id,
          type: r.relationship_type,
          org: r.source,
          direction: 'incoming',
        })),
      ];
    }
    const typeLabels = {
      parent: 'Parent Company',
      subsidiary: 'Subsidiary',
      co_sponsor: 'Co-Sponsor',
      partner: 'Partner',
      franchise: 'Franchise',
      related: 'Related',
      competitor: 'Competitor',
      supplier: 'Supplier',
    };

    if (all.length === 0) return '<p class="text-muted small mb-0">No relationships</p>';
    return `<div class="list-group list-group-flush">
      ${all
        .map(
          (r) => `<div class="list-group-item px-0 py-2 border-0 d-flex align-items-center">
        ${
          r.org?.logo_url
            ? `<img src="${r.org.logo_url}" class="me-2 rounded" style="width:30px;height:21px;object-fit:contain;border:1px solid #e0e0e0;">`
            : `<div class="me-2 d-flex align-items-center justify-content-center rounded" style="width:30px;height:21px;background:#f5f5f5;border:1px solid #e0e0e0;"><i class="bi bi-building text-muted" style="font-size:0.6rem;"></i></div>`
        }
        <div class="flex-grow-1">
          <a href="#" class="small fw-semibold text-primary text-decoration-none"
            data-action="orgsModule.openCompanyProfile" data-args='${JSON.stringify([r.org?.id, utils.escapeHtml(r.org?.company_name || '').replace(/'/g, '&#39;')])}'>${utils.escapeHtml(r.org?.company_name || 'Unknown')}</a>
          <span class="badge bg-light text-muted ms-1" style="font-size:0.6rem;">${typeLabels[r.type] || r.type}${r.direction === 'incoming' ? ' (of this)' : ''}</span>
        </div>
        <button class="btn btn-sm btn-outline-danger py-0" data-action="orgsModule.removeRelationship" data-args='${JSON.stringify([r.id, orgId])}'><i class="bi bi-x"></i></button>
      </div>`
        )
        .join('')}
    </div>`;
  },

  // ============================================
  // FEATURE 4: EMAIL INTEGRATION IN PROFILE
  // ============================================
  /**
   * Compose and log an email to an organisation directly from its profile panel.
   * @param {string} orgId - Organisation ID
   * @returns {Promise<void>}
   */
  async composeEmailFromProfile(orgId) {
    const org = STATE.allOrganisations.find((o) => o.id === orgId);
    if (!org) return;
    const to = org.email || '';
    const subject = document.getElementById('profileEmailSubject')?.value.trim() || '';
    const body = document.getElementById('profileEmailBody')?.value.trim() || '';
    if (!to) {
      utils.showToast('No email address for this company', 'warning');
      return;
    }
    if (!subject) {
      utils.showToast('Enter a subject', 'warning');
      return;
    }

    // Log the communication
    try {
      await apiClient.insert('organisation_comms_log', {
        organisation_id: orgId,
        template_name: subject,
        subject,
        message: body,
        channel: 'email',
        direction: 'outbound',
      });
    } catch (e) {
      /* ignore */
    }
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
      if (toggleBtn) {
        toggleBtn.classList.remove('btn-outline-info');
        toggleBtn.classList.add('btn-info');
      }
      this.renderKanbanBoard();
    } else {
      if (kanbanEl) kanbanEl.style.display = 'none';
      if (tableEl) tableEl.style.display = 'block';
      if (toggleBtn) {
        toggleBtn.classList.remove('btn-info');
        toggleBtn.classList.add('btn-outline-info');
      }
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
      { key: 'past_winner', label: 'Past Winner', color: '#fd7e14', icon: 'bi-award' },
    ];

    const orgs = STATE.filteredOrganisations.filter((o) => (o.status || 'prospect') !== 'archived');

    kanbanEl.innerHTML = `
      <div class="d-flex gap-2 overflow-auto pb-3" style="min-height: 500px;">
        ${stages
          .map((stage) => {
            const stageOrgs = orgs.filter((o) => (o.status || 'prospect') === stage.key);
            return `
            <div class="kanban-column flex-shrink-0" style="width: 220px; min-width: 220px;"
              data-status="${stage.key}">
              <div class="card h-100 border-0 shadow-sm">
                <div class="card-header py-2 text-white" style="background: ${stage.color};">
                  <div class="d-flex justify-content-between align-items-center">
                    <span class="fw-semibold small"><i class="bi ${stage.icon} me-1"></i>${stage.label}</span>
                    <span class="badge bg-white text-dark">${stageOrgs.length}</span>
                  </div>
                </div>
                <div class="card-body p-2" style="max-height: 450px; overflow-y: auto;">
                  ${(() => {
                    if (stageOrgs.length === 0)
                      return '<p class="text-muted small text-center py-3">No organisations</p>';
                    const isExpanded = this._kanbanExpandedColumns.has(stage.key);
                    const limit = isExpanded ? stageOrgs.length : 30;
                    const visible = stageOrgs.slice(0, limit);
                    const remaining = stageOrgs.length - limit;
                    return (
                      visible
                        .map(
                          (org) => `
                      <div class="card mb-2 kanban-card" draggable="true"
                        data-org-id="${org.id}"
                        style="cursor: grab; border-left: 3px solid ${stage.color};">
                        <div class="card-body p-2">
                          <div class="d-flex align-items-center mb-1">
                            ${org.logo_url ? `<img src="${org.logo_url}" class="me-1 rounded" style="width:24px;height:17px;object-fit:contain;">` : ''}
                            <a href="#" class="small fw-semibold text-primary text-decoration-none text-truncate"
                              data-action="orgsModule.openCompanyProfile" data-args='${JSON.stringify([org.id, utils.escapeHtml(org.company_name || '').replace(/'/g, '&#39;')])}'
                              style="max-width: 150px;">${utils.escapeHtml(org.company_name || 'N/A')}</a>
                          </div>
                          <div class="text-muted" style="font-size: 0.65rem;">${utils.escapeHtml(utils.toTitleCase(org.sector) || '-')} &middot; ${utils.escapeHtml(org.county || '-')}</div>
                          ${org.tier ? `<span class="badge" style="font-size:0.55rem;background:${{ Bronze: '#CD7F32', Silver: '#C0C0C0', Gold: '#FFD700', Platinum: '#E5E4E2' }[org.tier] || '#ccc'}">${org.tier}</span>` : ''}
                        </div>
                      </div>
                    `
                        )
                        .join('') +
                      (remaining > 0
                        ? `<button class="btn btn-sm btn-outline-secondary w-100 mt-1" data-action="orgsModule.expandKanbanColumn" data-id="${stage.key}"><i class="bi bi-chevron-down me-1"></i>Show ${remaining} more</button>`
                        : isExpanded && stageOrgs.length > 30
                          ? `<button class="btn btn-sm btn-outline-secondary w-100 mt-1" data-action="orgsModule.collapseKanbanColumn" data-id="${stage.key}"><i class="bi bi-chevron-up me-1"></i>Show less</button>`
                          : '')
                    );
                  })()}
                </div>
              </div>
            </div>
          `;
          })
          .join('')}
      </div>
    `;

    // Bind kanban drag & drop listeners (replacing inline handlers)
    this._bindKanbanDragListeners(kanbanEl);
  },

  /**
   * Bind drag/drop listeners to the kanban board (replaces inline handlers).
   */
  _bindKanbanDragListeners(container) {
    // Column drop targets
    container.querySelectorAll('.kanban-column').forEach((col) => {
      const status = col.dataset.status;
      col.addEventListener('dragover', (e) => {
        e.preventDefault();
        col.classList.add('kanban-drag-over');
      });
      col.addEventListener('dragleave', () => {
        col.classList.remove('kanban-drag-over');
      });
      col.addEventListener('drop', (e) => {
        col.classList.remove('kanban-drag-over');
        this.handleKanbanDrop(e, status);
      });
    });

    // Card drag sources
    container.querySelectorAll('.kanban-card[draggable="true"]').forEach((card) => {
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', card.dataset.orgId);
      });
    });
  },

  /**
   * Handle a Kanban card drag-drop to update an organisation's pipeline status.
   * @param {DragEvent} event - Browser drag event containing the org ID
   * @param {string} newStatus - Target pipeline status column
   * @returns {Promise<void>}
   */
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
    const daysSinceUpdate = org.updated_at
      ? Math.floor((Date.now() - new Date(org.updated_at).getTime()) / 86400000)
      : 999;
    // Activity recency (time decay: exponential falloff)
    if (daysSinceUpdate < 7) score += 40;
    else if (daysSinceUpdate < 30) score += 25;
    else if (daysSinceUpdate < 90) score += 10;
    else if (daysSinceUpdate < 180) score += 3;
    // else 0 — stale orgs get no recency points

    // Last contacted decay
    const lastContacted = this.getLastContacted(org.id);
    if (lastContacted) {
      const daysSinceContact = Math.floor((Date.now() - new Date(lastContacted).getTime()) / 86400000);
      if (daysSinceContact < 14) score += 15;
      else if (daysSinceContact < 30) score += 10;
      else if (daysSinceContact < 90) score += 5;
    }

    if (org.email) score += 8;
    if (org.contact_name) score += 7;
    if (org.logo_url) score += 5;
    if (org.website) score += 5;
    if (org.description) score += 5;
    if (org.awards_count > 0) score += 15;
    if (org.tier) score += 5;
    if (org.contact_phone) score += 3;
    if ((org.tags || []).length > 0) score += 2;
    return Math.min(score, 100);
  },

  getOrgHealthIndicator(org) {
    const daysSinceUpdate = org.updated_at
      ? Math.floor((Date.now() - new Date(org.updated_at).getTime()) / 86400000)
      : 999;
    const hasEmail = !!org.email;
    const hasContact = !!org.contact_name;
    const engagement = this.calculateEngagementScore(org);

    if (daysSinceUpdate > 180 || (!hasEmail && !hasContact))
      return { color: 'danger', label: 'At Risk', icon: 'bi-exclamation-triangle-fill' };
    if (daysSinceUpdate > 90 || engagement < 30)
      return { color: 'warning', label: 'Needs Attention', icon: 'bi-exclamation-circle' };
    return { color: 'success', label: 'Healthy', icon: 'bi-check-circle-fill' };
  },

  // ============================================
  // FEATURE 8: THREADED NOTES / COMMENTS
  // ============================================
  /**
   * Fetch all threaded notes for an organisation, sorted pinned-first then by date.
   * @param {string} orgId - Organisation ID
   * @returns {Promise<Array>} Array of note objects
   */
  async getThreadedNotes(orgId) {
    try {
      // Direct call: complex query not supported by apiClient (dual order by)
      const result = await apiClient.select('organisation_notes', {
        filters: { organisation_id: orgId },
        sort: { column: 'created_at', ascending: false },
        pageSize: 1000,
      });
      const data = result.data || [];
      // Sort pinned first, then by created_at descending (apiClient only supports single sort)
      data.sort(
        (a, b) =>
          (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || Number(new Date(b.created_at)) - Number(new Date(a.created_at))
      );
      return data;
    } catch (e) {
      return [];
    }
  },

  /**
   * Add a new note to an organisation from the note input field.
   * @param {string} orgId - Organisation ID
   * @returns {Promise<void>}
   */
  async addThreadedNote(orgId) {
    const content = document.getElementById('newNoteContent')?.value.trim();
    if (!content) {
      utils.showToast('Enter a note', 'warning');
      return;
    }
    try {
      const userEmail = STATE.client?.auth?.getUser ? (await STATE.client.auth.getUser())?.data?.user?.email : 'admin';
      await apiClient.insert('organisation_notes', {
        organisation_id: orgId,
        content,
        author: userEmail || 'admin',
      });
      this._logAudit(orgId, 'note_added', '', `Note added: ${content.substring(0, 50)}`);
      utils.showToast('Note added', 'success');
      const org = STATE.allOrganisations.find((o) => o.id === orgId);
      if (org) this.openCompanyProfile(orgId, org.company_name);
    } catch (e) {
      utils.showToast('Error: ' + e.message, 'error');
    }
  },

  /**
   * Delete a note from an organisation after confirmation.
   * @param {string} noteId - Note record ID
   * @param {string} orgId - Organisation ID (used to refresh the profile)
   * @returns {Promise<void>}
   */
  async deleteThreadedNote(noteId, orgId) {
    if (!(await utils.confirmDialog({ title: 'Delete Note', message: 'Delete this note?' }))) return;
    try {
      await apiClient.delete('organisation_notes', noteId);
      utils.showToast('Note deleted', 'success');
      const org = STATE.allOrganisations.find((o) => o.id === orgId);
      if (org) this.openCompanyProfile(orgId, org.company_name);
    } catch (e) {
      utils.showToast('Error: ' + e.message, 'error');
    }
  },

  /**
   * Toggle the pinned status of a note.
   * @param {string} noteId - Note record ID
   * @param {boolean} pinned - Current pinned state (will be toggled)
   * @param {string} orgId - Organisation ID (used to refresh the profile)
   * @returns {Promise<void>}
   */
  async togglePinNote(noteId, pinned, orgId) {
    try {
      await apiClient.update('organisation_notes', noteId, { pinned: !pinned });
      const org = STATE.allOrganisations.find((o) => o.id === orgId);
      if (org) this.openCompanyProfile(orgId, org.company_name);
    } catch (e) {
      utils.showToast('Error: ' + e.message, 'error');
    }
  },

  renderThreadedNotes(notes, orgId) {
    if (notes.length === 0) return '<p class="text-muted small mb-0">No notes yet. Add one below.</p>';
    return `<div class="list-group list-group-flush" style="max-height: 300px; overflow-y: auto;">
      ${notes
        .map(
          (n) => `<div class="list-group-item px-0 py-2 border-0 ${n.pinned ? 'bg-warning-subtle' : ''}">
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
            <button class="btn btn-sm btn-outline-warning py-0" data-action="orgsModule.togglePinNote" data-args='${JSON.stringify([n.id, n.pinned, orgId])}' title="${n.pinned ? 'Unpin' : 'Pin'}"><i class="bi bi-pin"></i></button>
            <button class="btn btn-sm btn-outline-danger py-0" data-action="orgsModule.deleteThreadedNote" data-args='${JSON.stringify([n.id, orgId])}'><i class="bi bi-trash"></i></button>
          </div>
        </div>
      </div>`
        )
        .join('')}
    </div>`;
  },

  // ============================================
  // FEATURE 9: SPONSORSHIP PACKAGE MANAGEMENT
  // ============================================
  /**
   * Fetch all sponsorship packages for an organisation.
   * @param {string} orgId - Organisation ID
   * @returns {Promise<Array>} Array of sponsorship package objects
   */
  async getSponsorshipPackages(orgId) {
    try {
      const result = await apiClient.select('sponsorship_packages', {
        filters: { organisation_id: orgId },
        sort: { column: 'created_at', ascending: false },
        pageSize: 1000,
      });
      return result.data || [];
    } catch (e) {
      return [];
    }
  },

  /**
   * Add a sponsorship package to an organisation from the package form fields.
   * @param {string} orgId - Organisation ID
   * @returns {Promise<void>}
   */
  async addSponsorshipPackage(orgId) {
    const pkgName = document.getElementById('spkgName')?.value.trim();
    const tier = document.getElementById('spkgTier')?.value;
    const amount = parseFloat(document.getElementById('spkgAmount')?.value) || 0;
    const startDate = document.getElementById('spkgStartDate')?.value || null;
    const endDate = document.getElementById('spkgEndDate')?.value || null;
    const renewalDate = document.getElementById('spkgRenewalDate')?.value || null;
    const schedule = document.getElementById('spkgSchedule')?.value || 'one_time';
    const benefitsRaw = document.getElementById('spkgBenefits')?.value.trim() || '';
    const benefits = benefitsRaw ? benefitsRaw.split('\n').filter((b) => b.trim()) : [];

    if (!pkgName) {
      utils.showToast('Enter package name', 'warning');
      return;
    }
    try {
      await apiClient.insert('sponsorship_packages', {
        organisation_id: orgId,
        package_name: pkgName,
        tier,
        amount,
        start_date: startDate,
        end_date: endDate,
        renewal_date: renewalDate,
        payment_schedule: schedule,
        benefits: JSON.stringify(benefits),
        status: 'active',
      });
      utils.showToast('Package added', 'success');
      const org = STATE.allOrganisations.find((o) => o.id === orgId);
      if (org) this.openCompanyProfile(orgId, org.company_name);
    } catch (e) {
      utils.showToast('Error: ' + e.message, 'error');
    }
  },

  /**
   * Delete a sponsorship package after confirmation.
   * @param {string} pkgId - Sponsorship package record ID
   * @param {string} orgId - Organisation ID (used to refresh the profile)
   * @returns {Promise<void>}
   */
  async deleteSponsorshipPackage(pkgId, orgId) {
    if (
      !(await utils.confirmDialog({ title: 'Delete Sponsorship Package', message: 'Delete this sponsorship package?' }))
    )
      return;
    try {
      await apiClient.delete('sponsorship_packages', pkgId);
      utils.showToast('Package deleted', 'success');
      const org = STATE.allOrganisations.find((o) => o.id === orgId);
      if (org) this.openCompanyProfile(orgId, org.company_name);
    } catch (e) {
      utils.showToast('Error: ' + e.message, 'error');
    }
  },

  renderSponsorshipPackages(packages, orgId) {
    if (!packages || packages.length === 0) return '<p class="text-muted small mb-0">No sponsorship packages</p>';
    const statusColors = { active: 'success', expired: 'danger', pending: 'warning', cancelled: 'secondary' };
    return packages
      .map((pkg) => {
        let benefits = [];
        try {
          benefits = typeof pkg.benefits === 'string' ? JSON.parse(pkg.benefits) : pkg.benefits || [];
        } catch (e) {
          benefits = [];
        }
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
              ${benefits.length > 0 ? `<div class="mt-1">${benefits.map((b) => `<span class="badge bg-light text-dark me-1 mb-1" style="font-size:0.65rem;">${utils.escapeHtml(b)}</span>`).join('')}</div>` : ''}
            </div>
            <button class="btn btn-sm btn-outline-danger py-0" data-action="orgsModule.deleteSponsorshipPackage" data-args='${JSON.stringify([pkg.id, orgId])}'><i class="bi bi-trash"></i></button>
          </div>
        </div>
      </div>`;
      })
      .join('');
  },

  // ============================================
  // FEATURE 10: MAP VIEW FOR REGIONAL ANALYSIS
  // ============================================
  showMapView() {
    const regions = {};
    const counties = {};
    STATE.filteredOrganisations.forEach((org) => {
      const r = org.county_city || 'Unknown';
      const c = org.county || 'Unknown';
      regions[r] = (regions[r] || 0) + 1;
      counties[c] = (counties[c] || 0) + 1;
    });

    const maxRegionCount = Math.max(...Object.values(regions), 1);
    const sortedRegions = Object.entries(regions).sort((a, b) => b[1] - a[1]);
    const sortedCounties = Object.entries(counties)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 25);

    const getHeatColor = (count) => {
      const intensity = Math.floor((count / maxRegionCount) * 255);
      return `rgb(${255 - intensity}, ${Math.floor(intensity * 0.6)}, ${Math.floor(intensity * 0.3)})`;
    };

    const html = `
      <div class="row">
        <div class="col-md-6">
          <h6 class="fw-semibold mb-3"><i class="bi bi-geo-alt me-2"></i>Regional Distribution</h6>
          <div style="max-height: 400px; overflow-y: auto;">
            ${sortedRegions
              .map(([region, count]) => {
                const pct = ((count / STATE.filteredOrganisations.length) * 100).toFixed(1);
                return `<div class="d-flex align-items-center mb-2 cursor-pointer" data-action="orgsModule.filterByRegion" data-id="${utils.escapeHtml(region)}" style="cursor:pointer;">
                <div class="me-2" style="width: 20px; height: 20px; border-radius: 4px; background: ${getHeatColor(count)};"></div>
                <div class="flex-grow-1 small fw-semibold">${utils.escapeHtml(region)}</div>
                <div class="text-end">
                  <span class="badge bg-primary">${count}</span>
                  <span class="text-muted small ms-1">(${pct}%)</span>
                </div>
              </div>`;
              })
              .join('')}
          </div>
        </div>
        <div class="col-md-6">
          <h6 class="fw-semibold mb-3"><i class="bi bi-pin-map me-2"></i>Top Counties/Cities</h6>
          <div style="max-height: 400px; overflow-y: auto;">
            ${sortedCounties
              .map(([county, count]) => {
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
              })
              .join('')}
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
      } else if (e.key === ' ' && this._selectedRowIndex >= 0) {
        // Space = toggle checkbox selection on highlighted row
        e.preventDefault();
        const row = rows[this._selectedRowIndex];
        const cb = row?.querySelector('input[type="checkbox"]');
        if (cb) {
          cb.checked = !cb.checked;
          cb.dispatchEvent(new Event('change'));
        }
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
      } else if (e.key === 'n' && (e.ctrlKey || e.metaKey)) {
        // Ctrl+N = Add new org
        e.preventDefault();
        new bootstrap.Modal(document.getElementById('addNewOrgModal'))?.show();
      } else if (e.key === 'ArrowRight' && e.ctrlKey) {
        // Ctrl+Right = next page
        e.preventDefault();
        this.goToPage(this._currentPage + 1);
      } else if (e.key === 'ArrowLeft' && e.ctrlKey) {
        // Ctrl+Left = prev page
        e.preventDefault();
        this.goToPage(this._currentPage - 1);
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
      return dupes.map((d) => d.company_name).slice(0, 5);
    }
    return null;
  },

  // ============================================
  // QUICK WIN: LAST CONTACTED COLUMN HELPER
  // ============================================
  /**
   * Load and cache the most recent communication date for each organisation.
   * @returns {Promise<void>}
   */
  async loadLastContactedDates() {
    try {
      const result = await apiClient.select('organisation_comms_log', {
        select: 'organisation_id, created_at',
        sort: { column: 'created_at', ascending: false },
        pageSize: 1000,
      });
      const data = result.data;
      const lastContacted = {};
      (data || []).forEach((r) => {
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
            console.debug('Organisations realtime: subscribed'); // eslint-disable-line no-console
          }
        });
    } catch (e) {
      console.debug('Realtime subscription failed:', e.message); // eslint-disable-line no-console
    }
  },

  _handleRealtimeEvent(payload) {
    const { eventType, new: newRow, old: oldRow } = payload;

    if (eventType === 'INSERT' && newRow) {
      // Check if we already have this org (from our own insert)
      const exists = STATE.allOrganisations.find((o) => o.id === newRow.id);
      if (!exists) {
        STATE.allOrganisations.push({ ...newRow, awards_count: 0 });
        this._debouncedRealtimeRefresh('New organisation added by another user');
      }
    } else if (eventType === 'UPDATE' && newRow) {
      const org = STATE.allOrganisations.find((o) => o.id === newRow.id);
      if (org) {
        // Only trigger toast if this wasn't our own update (compare updated_at)
        const wasExternal = org.updated_at && newRow.updated_at && org.updated_at !== newRow.updated_at;
        Object.assign(org, newRow);
        const fOrg = STATE.filteredOrganisations.find((o) => o.id === newRow.id);
        if (fOrg) Object.assign(fOrg, newRow);
        if (wasExternal) {
          this._debouncedRealtimeRefresh(`${newRow.company_name || 'Organisation'} updated`);
        }
      }
    } else if (eventType === 'DELETE' && oldRow) {
      STATE.allOrganisations = STATE.allOrganisations.filter((o) => o.id !== oldRow.id);
      STATE.filteredOrganisations = STATE.filteredOrganisations.filter((o) => o.id !== oldRow.id);
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
  // FEATURE: TABLE PAGINATION
  // ============================================
  _renderPaginationControls(totalFiltered, totalPages) {
    const footer = document.querySelector('#orgTableContainer .card-footer');
    if (!footer) return;

    const pageSizes = [25, 50, 100, 250];
    const page = this._currentPage;

    footer.innerHTML = `
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div class="d-flex align-items-center gap-2">
          <small class="text-muted">
            Showing ${totalFiltered > 0 ? (page - 1) * this._pageSize + 1 + '-' + Math.min(page * this._pageSize, totalFiltered) : '0'}
            of ${STATE.allOrganisations.length}
            (${totalFiltered} filtered)
          </small>
          <select class="form-select form-select-sm" style="width: auto; font-size: 0.75rem;"
                  data-on-change="orgsModule.changePageSize">
            ${pageSizes.map((s) => `<option value="${s}" ${s === this._pageSize ? 'selected' : ''}>${s} per page</option>`).join('')}
          </select>
        </div>
        <div class="d-flex align-items-center gap-1">
          <button class="btn btn-sm btn-outline-secondary" ${page <= 1 ? 'disabled' : ''}
                  data-action="orgsModule.goToPage" data-id="1" title="First"><i class="bi bi-chevron-double-left"></i></button>
          <button class="btn btn-sm btn-outline-secondary" ${page <= 1 ? 'disabled' : ''}
                  data-action="orgsModule.goToPage" data-id="${page - 1}" title="Previous"><i class="bi bi-chevron-left"></i></button>
          <span class="small text-muted mx-1">Page ${page} of ${totalPages}</span>
          <button class="btn btn-sm btn-outline-secondary" ${page >= totalPages ? 'disabled' : ''}
                  data-action="orgsModule.goToPage" data-id="${page + 1}" title="Next"><i class="bi bi-chevron-right"></i></button>
          <button class="btn btn-sm btn-outline-secondary" ${page >= totalPages ? 'disabled' : ''}
                  data-action="orgsModule.goToPage" data-id="${totalPages}" title="Last"><i class="bi bi-chevron-double-right"></i></button>
        </div>
        <small class="text-muted">
          <i class="bi bi-clock me-1"></i>Last refreshed: ${new Date().toLocaleTimeString('en-GB')}
        </small>
      </div>`;
  },

  goToPage(page) {
    this._currentPage = page;
    this.renderOrganisations();
    document.getElementById('orgTableContainer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  changePageSize(size) {
    this._pageSize = size;
    this._currentPage = 1;
    this.renderOrganisations();
  },

  // ============================================
  // FEATURE: OVERDUE FOLLOW-UPS WIDGET
  // ============================================
  /**
   * Load overdue and due-soon follow-ups and update the dashboard badge counts.
   * @returns {Promise<void>}
   */
  async loadOverdueFollowUps() {
    try {
      const allFollowUps = await this.getFollowUps();
      const today = new Date().toISOString().split('T')[0];
      const threeDays = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];
      const overdue = allFollowUps.filter((f) => !f.done && f.date && f.date < today);
      const dueSoon = allFollowUps.filter((f) => !f.done && f.date && f.date >= today && f.date <= threeDays);

      const overdueEl = document.getElementById('orgsOverdueCount');
      const dueSoonEl = document.getElementById('orgsDueSoonCount');
      if (overdueEl) overdueEl.textContent = overdue.length;
      if (dueSoonEl) dueSoonEl.textContent = dueSoon.length;

      this._overdueFollowUps = overdue;
      this._dueSoonFollowUps = dueSoon;
    } catch (e) {
      console.warn('Failed to load overdue follow-ups:', e.message);
    }
  },

  showOverdueFollowUps() {
    const overdue = this._overdueFollowUps || [];
    const dueSoon = this._dueSoonFollowUps || [];
    const all = [...overdue, ...dueSoon].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    if (all.length === 0) {
      utils.showToast('No overdue or upcoming follow-ups', 'info');
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const html = `
      <div class="table-responsive">
        <table class="table table-sm table-hover">
          <thead><tr>
            <th>Organisation</th><th>Due Date</th><th>Note</th><th>Status</th><th>Action</th>
          </tr></thead>
          <tbody>
            ${all
              .map((f) => {
                const isOverdue = f.date < today;
                const safeName = utils.escapeHtml((f.companyName || '').replace(/'/g, '&#39;'));
                return `<tr class="${isOverdue ? 'table-danger' : 'table-warning'}">
                <td><a href="#" class="text-decoration-none" data-action="orgsModule.closeModalAndOpenProfile" data-args='${JSON.stringify([f.orgId, safeName])}' data-prevent-default="true">${utils.escapeHtml(f.companyName || 'Unknown')}</a></td>
                <td class="small">${f.date || '-'}</td>
                <td class="small">${utils.escapeHtml(f.note || '-')}</td>
                <td><span class="badge ${isOverdue ? 'bg-danger' : 'bg-warning text-dark'}">${isOverdue ? 'Overdue' : 'Due Soon'}</span></td>
                <td><button class="btn btn-sm btn-outline-success" data-action="orgsModule.completeFollowUp" data-args='${JSON.stringify([f.orgId, f.id])}'><i class="bi bi-check"></i></button></td>
              </tr>`;
              })
              .join('')}
          </tbody>
        </table>
      </div>`;

    this._showDynamicModal(
      `Follow-ups (${overdue.length} overdue, ${dueSoon.length} due soon)`,
      html,
      'bi-bell',
      'modal-lg'
    );
  },

  // ============================================
  // FEATURE: COLUMN VISIBILITY SETTINGS
  // ============================================
  showColumnSettings() {
    const columns = [
      { key: 'sector', label: 'Sector' },
      { key: 'county', label: 'County' },
      { key: 'contact', label: 'Contact' },
      { key: 'email', label: 'Email' },
      { key: 'tier', label: 'Tier' },
      { key: 'tags', label: 'Tags' },
      { key: 'county_city', label: 'Region' },
      { key: 'status', label: 'Status' },
      { key: 'awards', label: 'Awards' },
      { key: 'updated', label: 'Updated' },
      { key: 'lastContacted', label: 'Last Contacted' },
      { key: 'health', label: 'Health' },
    ];

    const html = `
      <p class="small text-muted mb-3">Toggle columns on/off. Settings persist across sessions.</p>
      <div class="row g-2">
        ${columns
          .map((c) => {
            const checked = this._columnVisibility[c.key] !== false ? 'checked' : '';
            return `<div class="col-6">
            <div class="form-check form-switch">
              <input class="form-check-input" type="checkbox" id="colVis_${c.key}" ${checked}
                     data-on-check="orgsModule.toggleColumnVisibility" data-id="${c.key}">
              <label class="form-check-label small" for="colVis_${c.key}">${c.label}</label>
            </div>
          </div>`;
          })
          .join('')}
      </div>
      <hr>
      <div class="d-flex gap-2">
        <button class="btn btn-sm btn-outline-primary" data-action="orgsModule.resetColumnVisibility">
          <i class="bi bi-arrow-counterclockwise me-1"></i>Show All
        </button>
        <button class="btn btn-sm btn-outline-secondary" data-action="orgsModule.hideAllColumns">
          <i class="bi bi-eye-slash me-1"></i>Hide All Optional
        </button>
      </div>`;

    this._showDynamicModal('Column Visibility', html, 'bi-layout-three-columns');
  },

  toggleColumnVisibility(col, visible) {
    this._columnVisibility[col] = visible;
    try {
      localStorage.setItem('orgsColumnVisibility', JSON.stringify(this._columnVisibility));
    } catch (e) {
      console.warn('Failed to save column visibility to localStorage:', e.message);
    }
    this.renderOrganisations();
    utils.updateEmptyRowColspan('orgsTableBody');
  },

  resetColumnVisibility() {
    this._columnVisibility = { tags: false, county_city: false, lastContacted: false, health: false, updated: false };
    try {
      localStorage.setItem('orgsColumnVisibility', JSON.stringify(this._columnVisibility));
    } catch (e) {
      console.warn('Failed to save column visibility to localStorage:', e.message);
    }
    document.querySelectorAll('[id^="colVis_"]').forEach((cb) => (cb.checked = true));
    this.renderOrganisations();
  },

  hideAllColumns() {
    const cols = [
      'sector',
      'county',
      'contact',
      'email',
      'tier',
      'tags',
      'county_city',
      'status',
      'awards',
      'updated',
      'lastContacted',
      'health',
    ];
    cols.forEach((c) => (this._columnVisibility[c] = false));
    try {
      localStorage.setItem('orgsColumnVisibility', JSON.stringify(this._columnVisibility));
    } catch (e) {
      console.warn('Failed to save column visibility to localStorage:', e.message);
    }
    document.querySelectorAll('[id^="colVis_"]').forEach((cb) => (cb.checked = false));
    this.renderOrganisations();
  },

  // ============================================
  // FEATURE: PRINT/PDF COMPANY PROFILE
  // ============================================
  printCompanyProfile(orgId) {
    const org = STATE.allOrganisations.find((o) => o.id === orgId);
    if (!org) {
      utils.showToast('Organisation not found', 'error');
      return;
    }

    const engagement = this.calculateEngagementScore(org);
    const health = this.getOrgHealthIndicator(org);
    const lastContacted = this.getLastContacted(orgId);

    const printHtml = `<!DOCTYPE html>
<html><head>
<title>${utils.escapeHtml(org.company_name)} - Company Profile</title>
<style>
  body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #333; }
  h1 { color: #0d6efd; border-bottom: 2px solid #0d6efd; padding-bottom: 8px; }
  h2 { color: #495057; margin-top: 24px; font-size: 1.1rem; border-bottom: 1px solid #dee2e6; padding-bottom: 4px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; }
  .field { margin-bottom: 4px; }
  .label { font-weight: bold; color: #6c757d; font-size: 0.85rem; }
  .value { margin-top: 2px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; }
  .logo { max-width: 200px; max-height: 120px; object-fit: contain; border: 1px solid #dee2e6; }
  .footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #dee2e6; font-size: 0.8rem; color: #6c757d; text-align: center; }
  @media print { body { padding: 0; } }
</style>
</head><body>
  ${org.logo_url ? `<img src="${utils.escapeHtml(org.logo_url)}" class="logo" alt="">` : ''}
  <h1>${utils.escapeHtml(org.company_name)}</h1>
  <h2>Contact Information</h2>
  <div class="grid">
    <div class="field"><span class="label">Contact Name:</span><div class="value">${utils.escapeHtml(org.contact_name || 'N/A')}</div></div>
    <div class="field"><span class="label">Email:</span><div class="value">${utils.escapeHtml(org.email || 'N/A')}</div></div>
    <div class="field"><span class="label">Phone:</span><div class="value">${utils.escapeHtml(org.contact_phone || 'N/A')}</div></div>
    <div class="field"><span class="label">Website:</span><div class="value">${utils.escapeHtml(org.website || 'N/A')}</div></div>
  </div>
  <h2>Organisation Details</h2>
  <div class="grid">
    <div class="field"><span class="label">Status:</span><div class="value"><span class="badge" style="background:#e9ecef;">${utils.escapeHtml(org.status || 'prospect')}</span></div></div>
    <div class="field"><span class="label">Tier:</span><div class="value"><span class="badge" style="background:#fff3cd;">${utils.escapeHtml(org.tier || 'N/A')}</span></div></div>
    <div class="field"><span class="label">Sector:</span><div class="value">${utils.escapeHtml(utils.toTitleCase(org.sector) || 'N/A')}</div></div>
    <div class="field"><span class="label">Region:</span><div class="value">${utils.escapeHtml(org.county_city || 'N/A')}</div></div>
    <div class="field"><span class="label">County:</span><div class="value">${utils.escapeHtml(org.county || 'N/A')}</div></div>
    <div class="field"><span class="label">Address:</span><div class="value">${utils.escapeHtml(org.address || 'N/A')}</div></div>
    <div class="field"><span class="label">Tags:</span><div class="value">${(org.tags || []).map((t) => utils.escapeHtml(t)).join(', ') || 'None'}</div></div>
    <div class="field"><span class="label">Awards Count:</span><div class="value">${org.awards_count || 0}</div></div>
  </div>
  <h2>Engagement &amp; Health</h2>
  <div class="grid">
    <div class="field"><span class="label">Engagement Score:</span><div class="value">${engagement}/100</div></div>
    <div class="field"><span class="label">Health:</span><div class="value">${health.label}</div></div>
    <div class="field"><span class="label">Last Contacted:</span><div class="value">${lastContacted ? new Date(lastContacted).toLocaleDateString('en-GB') : 'Never'}</div></div>
    <div class="field"><span class="label">Last Updated:</span><div class="value">${org.updated_at ? new Date(org.updated_at).toLocaleDateString('en-GB') : 'N/A'}</div></div>
  </div>
  ${org.notes ? `<h2>Notes</h2><p>${utils.escapeHtml(org.notes)}</p>` : ''}
  <div class="footer">Generated on ${new Date().toLocaleDateString('en-GB')} at ${new Date().toLocaleTimeString('en-GB')} — British Trade Awards CMS</div>
</body></html>`;

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (printWindow) {
      printWindow.document.write(printHtml);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    } else {
      utils.showToast('Pop-up blocked. Please allow pop-ups for this site.', 'warning');
    }
  },

  // ============================================
  // FEATURE: AUTO-STATUS PROMOTION ON AWARD ASSIGN
  // ============================================
  async _autoPromoteStatus(orgIds) {
    const promotable = ['prospect', 'entrant'];
    const toPromote = orgIds.filter((id) => {
      const org = STATE.allOrganisations.find((o) => o.id === id);
      return org && promotable.includes(org.status || 'prospect');
    });

    if (toPromote.length === 0) return;

    const batches = [];
    for (let i = 0; i < toPromote.length; i += 5) {
      batches.push(toPromote.slice(i, i + 5));
    }
    for (const batch of batches) {
      await Promise.all(batch.map((id) => apiClient.update('organisations', id, { status: 'nominee' })));
    }

    toPromote.forEach((id) => {
      const org = STATE.allOrganisations.find((o) => o.id === id);
      if (org) org.status = 'nominee';
      const fOrg = STATE.filteredOrganisations.find((o) => o.id === id);
      if (fOrg) fOrg.status = 'nominee';
    });

    // Batch audit log inserts instead of sequential loop
    try {
      const performedBy = await this._getCurrentUserEmail();
      const auditLogs = toPromote.map((id) => {
        const org = STATE.allOrganisations.find((o) => o.id === id);
        return {
          org_id: id,
          company_name: org?.company_name || '',
          action: 'auto_status_promotion',
          details: JSON.stringify({ from: 'prospect/entrant', to: 'nominee', reason: 'Assigned to award' }),
          performed_by: performedBy,
        };
      });
      if (auditLogs.length > 0) {
        await apiClient.insert('org_audit_log', auditLogs);
      }
    } catch (e) {
      console.warn('Failed to batch write audit logs:', e.message);
    }

    utils.showToast(`${toPromote.length} org(s) auto-promoted to "nominee"`, 'info');
  },

  // ============================================
  // FEATURE: LIVE DUPLICATE CHECK ON ADD FORM
  // ============================================
  _liveCheckDuplicate(name) {
    const warningEl = document.getElementById('duplicateWarning');
    if (!warningEl) return;
    if (!name || name.length < 3) {
      warningEl.style.display = 'none';
      return;
    }
    const dupes = this.checkDuplicateOnEntry(name);
    if (dupes && dupes.length > 0) {
      warningEl.style.display = '';
      warningEl.innerHTML = `<i class="bi bi-exclamation-triangle me-1"></i>Possible duplicates: <strong>${dupes.map((d) => utils.escapeHtml(d)).join(', ')}</strong>`;
    } else {
      warningEl.style.display = 'none';
    }
  },

  // ============================================
  // FEATURE: FOLLOW-UP AUTO-ALERT ON PAGE LOAD
  // ============================================
  _showFollowUpAlert() {
    const overdue = this._overdueFollowUps || [];
    if (overdue.length === 0) return;
    // Only show once per session
    if (this._followUpAlertShown) return;
    this._followUpAlertShown = true;

    const alertHtml = `<div id="followUpAlert" class="alert alert-danger alert-dismissible fade show d-flex align-items-center gap-2 mb-3" role="alert" style="animation: fadeIn 0.3s;">
      <i class="bi bi-bell-fill"></i>
      <div>You have <strong>${overdue.length}</strong> overdue follow-up${overdue.length > 1 ? 's' : ''} —
        <a href="#" class="alert-link" data-action="orgsModule.showOverdueFollowUps" data-prevent-default="true">View all</a>
      </div>
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    </div>`;

    const container = document.getElementById('orgTableContainer');
    if (container) container.insertAdjacentHTML('beforebegin', alertHtml);
  },

  // ============================================
  // FEATURE: CONTACT-LEVEL EMAIL IN BULK CAMPAIGNS
  // ============================================
  async _getContactEmails(orgIds) {
    try {
      const result = await apiClient.select('organisation_contacts', {
        select: 'organisation_id, first_name, last_name, email',
        filters: { organisation_id: { op: 'in', value: orgIds } },
        pageSize: 1000,
      });
      return result.data || [];
    } catch (e) {
      return [];
    }
  },

  // ============================================
  // FEATURE: BULK EDIT CUSTOM FIELDS
  // ============================================
  /**
   * Open a modal to apply a custom field value to all selected organisations.
   * @returns {Promise<void>}
   */
  async showBulkCustomFieldModal() {
    if (this.selectedOrgs.size === 0) {
      utils.showToast('No organisations selected', 'warning');
      return;
    }

    const html = `
      <p class="small text-muted">Set a custom field value on <strong>${this.selectedOrgs.size}</strong> selected organisations.</p>
      <div class="mb-3">
        <label class="form-label fw-semibold small">Field Name</label>
        <input type="text" class="form-control form-control-sm" id="bulkCustomFieldName" placeholder="e.g. Priority, Account Manager, Category">
      </div>
      <div class="mb-3">
        <label class="form-label fw-semibold small">Field Value</label>
        <input type="text" class="form-control form-control-sm" id="bulkCustomFieldValue" placeholder="Enter value (leave empty to delete field)">
      </div>
      <button class="btn btn-primary btn-sm" data-action="orgsModule.executeBulkCustomField">
        <i class="bi bi-pencil-square me-1"></i>Apply to ${this.selectedOrgs.size} org(s)
      </button>`;

    this._showDynamicModal('Bulk Edit Custom Field', html, 'bi-input-cursor-text');
  },

  /**
   * Apply the custom field update to all selected organisations.
   * @returns {Promise<void>}
   */
  async executeBulkCustomField() {
    const fieldName = document.getElementById('bulkCustomFieldName')?.value.trim();
    const fieldValue = document.getElementById('bulkCustomFieldValue')?.value.trim();
    if (!fieldName) {
      utils.showToast('Enter a field name', 'warning');
      return;
    }

    try {
      utils.showLoading();
      const orgIds = Array.from(this.selectedOrgs);
      for (const orgId of orgIds) {
        await this.saveCustomField(orgId, fieldName, fieldValue);
      }
      utils.showToast(`Custom field "${fieldName}" updated on ${orgIds.length} org(s)`, 'success');
      bootstrap.Modal.getInstance(document.getElementById('dynamicOrgModal'))?.hide();
    } catch (e) {
      utils.showToast('Error: ' + e.message, 'error');
    } finally {
      utils.hideLoading();
    }
  },

  // ============================================
  // FEATURE: FOLLOW-UP ASSIGNMENT TO USER
  // ============================================
  /**
   * Schedule a follow-up with an optional assignee for an organisation.
   * @param {string} orgId - Organisation ID
   * @returns {Promise<void>}
   */
  async addFollowUpWithAssignee(orgId) {
    const date = document.getElementById('followUpDate')?.value;
    const note = document.getElementById('followUpNote')?.value.trim();
    const assignee = document.getElementById('followUpAssignee')?.value.trim() || null;
    if (!date) {
      utils.showToast('Select a date', 'warning');
      return;
    }

    const org = STATE.allOrganisations.find((o) => o.id === orgId);
    try {
      await apiClient.insert('organisation_follow_ups', {
        organisation_id: orgId,
        company_name: org?.company_name || '',
        follow_up_date: date,
        note: note || null,
        assigned_to: assignee,
      });
      utils.showToast('Follow-up scheduled' + (assignee ? ` (assigned to ${assignee})` : ''), 'success');
      if (org) this.openCompanyProfile(orgId, org.company_name);
    } catch (e) {
      utils.showToast('Error: ' + e.message, 'error');
    }
  },

  // ============================================
  // FEATURE: DASHBOARD CHART VISUALISATIONS
  // ============================================
  _renderBarChart(data, maxVal, colorClass) {
    return data
      .map(([label, count]) => {
        const pct = Math.round((count / maxVal) * 100);
        return `<div class="d-flex align-items-center gap-2 mb-1">
        <span class="small text-end" style="width: 120px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${utils.escapeHtml(label)}">${utils.escapeHtml(label)}</span>
        <div class="flex-grow-1" style="height: 20px; background: #f0f0f0; border-radius: 3px;">
          <div style="width: ${pct}%; height: 100%; background: ${colorClass}; border-radius: 3px; transition: width 0.3s;"></div>
        </div>
        <span class="small fw-semibold" style="width: 35px;">${count}</span>
      </div>`;
      })
      .join('');
  },

  // ============================================
  // FEATURE: MULTI-SELECT TAG FILTER
  // ============================================
  _selectedTagFilters: [],

  toggleTagFilter(tag) {
    const idx = this._selectedTagFilters.indexOf(tag);
    if (idx >= 0) {
      this._selectedTagFilters.splice(idx, 1);
    } else {
      this._selectedTagFilters.push(tag);
    }
    this.filterOrganisations();
  },

  showTagFilterModal() {
    const allTags = [...new Set(STATE.allOrganisations.flatMap((o) => o.tags || []))].sort();
    if (allTags.length === 0) {
      utils.showToast('No tags found', 'info');
      return;
    }

    const html = `
      <p class="small text-muted mb-2">Select multiple tags to filter by (AND logic).</p>
      <div class="d-flex flex-wrap gap-2 mb-3">
        ${allTags
          .map((t) => {
            const active = this._selectedTagFilters.includes(t);
            return `<button class="btn btn-sm ${active ? 'btn-primary' : 'btn-outline-secondary'}" data-action="orgsModule.toggleTagFilterAndRefresh" data-id="${utils.escapeHtml(t)}">
            ${utils.escapeHtml(t)}
          </button>`;
          })
          .join('')}
      </div>
      <div class="d-flex gap-2">
        <button class="btn btn-sm btn-outline-danger" data-action="orgsModule.clearAllTagFilters">
          <i class="bi bi-x-circle me-1"></i>Clear All Tags
        </button>
      </div>
      ${this._selectedTagFilters.length > 0 ? `<div class="mt-2 small text-muted">Active: <strong>${this._selectedTagFilters.map((t) => utils.escapeHtml(t)).join(' + ')}</strong></div>` : ''}`;

    this._showDynamicModal('Multi-Tag Filter', html, 'bi-tags');
  },

  // ============================================
  // FEATURE: DRAG-AND-DROP ROW REORDERING
  // ============================================
  _draggedOrgId: null,
  _customOrgOrder: (() => {
    try {
      return JSON.parse(localStorage.getItem('orgsCustomOrder') || '[]');
    } catch (e) {
      return [];
    }
  })(),

  enableDragDrop() {
    this._dragDropEnabled = !this._dragDropEnabled;
    const btn = document.getElementById('dragDropToggleBtn');
    if (btn) btn.classList.toggle('active', this._dragDropEnabled);
    this.renderOrganisations();
    utils.showToast(
      this._dragDropEnabled ? 'Drag & drop enabled — drag rows to reorder' : 'Drag & drop disabled',
      'info'
    );
  },

  _handleDragStart(orgId, e) {
    this._draggedOrgId = orgId;
    e.dataTransfer.effectAllowed = 'move';
    e.target.closest('tr').style.opacity = '0.4';
  },

  _handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const tr = e.target.closest('tr');
    if (tr) tr.style.borderTop = '2px solid #0d6efd';
  },

  _handleDragLeave(e) {
    const tr = e.target.closest('tr');
    if (tr) tr.style.borderTop = '';
  },

  _handleDrop(targetOrgId, e) {
    e.preventDefault();
    const tr = e.target.closest('tr');
    if (tr) tr.style.borderTop = '';

    if (!this._draggedOrgId || this._draggedOrgId === targetOrgId) return;

    // Reorder in filtered array
    const arr = STATE.filteredOrganisations;
    const fromIdx = arr.findIndex((o) => o.id === this._draggedOrgId);
    const toIdx = arr.findIndex((o) => o.id === targetOrgId);
    if (fromIdx < 0 || toIdx < 0) return;

    const [moved] = arr.splice(fromIdx, 1);
    arr.splice(toIdx, 0, moved);

    // Save custom order
    this._customOrgOrder = arr.map((o) => o.id);
    try {
      localStorage.setItem('orgsCustomOrder', JSON.stringify(this._customOrgOrder));
    } catch (e) {
      console.warn('Failed to save custom org order to localStorage:', e.message);
    }

    this._draggedOrgId = null;
    this.renderOrganisations();
  },

  _handleDragEnd(e) {
    e.target.closest('tr').style.opacity = '';
    this._draggedOrgId = null;
  },

  // ============================================
  // FEATURE: SAVED VIEWS (filter + sort + columns)
  // ============================================
  /**
   * Save the current filter, sort, column, and page-size state as a named view.
   * @returns {Promise<void>}
   */
  async saveView() {
    const name = prompt('Name this view:');
    if (!name || !name.trim()) return;
    try {
      // Load existing views from Supabase
      let views = {};
      try {
        const result = await apiClient.select('user_preferences', {
          select: 'value',
          filters: { key: 'orgsSavedViews' },
          pageSize: 1,
        });
        const data = result.data?.[0];
        if (data?.value) {
          views = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
        }
      } catch (fetchErr) {
        views = JSON.parse(localStorage.getItem('orgsSavedViews') || '{}');
      }

      views[name.trim()] = {
        filters: {
          year: document.getElementById('orgsYearFilter')?.value || '',
          sector: document.getElementById('orgsSectorFilter')?.value || '',
          country: document.getElementById('orgsCountryFilter')?.value || '',
          areaId: document.getElementById('orgsAreaFilter')?.value || '',
          status: document.getElementById('orgsStatusFilter')?.value || '',
          search: document.getElementById('orgsSearchBox')?.value || '',
          tier: document.getElementById('orgsTierFilter')?.value || '',
          tag: document.getElementById('orgsTagFilter')?.value || '',
          logoFilter: document.getElementById('orgsLogoFilter')?.value || '',
          dateFilter: document.getElementById('orgsDateFilter')?.value || '',
        },
        sort: { field: this.sortField, direction: this.sortDirection },
        columns: { ...this._columnVisibility },
        pageSize: this._pageSize,
        tagFilters: [...this._selectedTagFilters],
      };

      try {
        await apiClient.upsert('user_preferences', {
          key: 'orgsSavedViews',
          value: JSON.stringify(views),
          user_email: STATE.currentUser?.email,
        });
      } catch (saveErr) {
        // Fallback to localStorage
        localStorage.setItem('orgsSavedViews', JSON.stringify(views));
      }

      utils.showToast(`View "${name.trim()}" saved`, 'success');
    } catch (e) {
      utils.showToast('Error saving view', 'error');
    }
  },

  /**
   * Open a modal listing all saved views with load and delete actions.
   * @returns {Promise<void>}
   */
  async showSavedViews() {
    let views = {};
    try {
      const result = await apiClient.select('user_preferences', {
        select: 'value',
        filters: { key: 'orgsSavedViews' },
        pageSize: 1,
      });
      const data = result.data?.[0];
      if (data?.value) {
        views = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
      }
    } catch (e) {
      // Fallback to localStorage
      try {
        views = JSON.parse(localStorage.getItem('orgsSavedViews') || '{}');
      } catch (parseErr) {
        views = {};
      }
    }
    const names = Object.keys(views);

    if (names.length === 0) {
      utils.showToast('No saved views yet. Use the Save View button to create one.', 'info');
      return;
    }

    const html = `
      <p class="small text-muted mb-3">Load a saved view to restore filters, sort, columns, and page size.</p>
      <div class="list-group">
        ${names
          .map(
            (n) => `<div class="list-group-item d-flex justify-content-between align-items-center">
          <div>
            <strong>${utils.escapeHtml(n)}</strong>
            <div class="small text-muted">${
              Object.entries(views[n].filters)
                .filter(([_k, v]) => v)
                .map(([k, v]) => `${k}: ${utils.escapeHtml(v)}`)
                .join(', ') || 'No filters'
            }</div>
          </div>
          <div class="d-flex gap-1">
            <button class="btn btn-sm btn-primary" data-action="orgsModule.loadView" data-id="utils.escapeHtml(n).replace(/'/g, '&#39;')"><i class="bi bi-box-arrow-in-right"></i></button>
            <button class="btn btn-sm btn-outline-danger" data-action="orgsModule.deleteView" data-id="utils.escapeHtml(n).replace(/'/g, '&#39;')"><i class="bi bi-trash"></i></button>
          </div>
        </div>`
          )
          .join('')}
      </div>`;

    this._showDynamicModal('Saved Views', html, 'bi-bookmark');
  },

  /**
   * Restore filters, sort, columns, and page size from a named saved view.
   * @param {string} name - Saved view name to load
   * @returns {Promise<void>}
   */
  async loadView(name) {
    let views = {};
    try {
      const result = await apiClient.select('user_preferences', {
        select: 'value',
        filters: { key: 'orgsSavedViews' },
        pageSize: 1,
      });
      const data = result.data?.[0];
      if (data?.value) {
        views = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
      }
    } catch (e) {
      // Fallback to localStorage
      try {
        views = JSON.parse(localStorage.getItem('orgsSavedViews') || '{}');
      } catch (parseErr) {
        utils.showToast('Error loading view', 'error');
        return;
      }
    }

    const view = views[name];
    if (!view) return;

    // Restore filters
    const f = view.filters;
    document.getElementById('orgsYearFilter').value = f.year || '';
    document.getElementById('orgsSectorFilter').value = f.sector || '';
    document.getElementById('orgsCountryFilter').value = f.country || '';
    locationModule.populateAreaDropdown('orgsAreaFilter', f.country || '', 'All Areas', f.areaId || '');
    if (f.areaId) document.getElementById('orgsAreaFilter').value = f.areaId;
    document.getElementById('orgsStatusFilter').value = f.status || '';
    document.getElementById('orgsSearchBox').value = f.search || '';
    const tierEl = document.getElementById('orgsTierFilter');
    if (tierEl) tierEl.value = f.tier || '';
    const tagEl = document.getElementById('orgsTagFilter');
    if (tagEl) tagEl.value = f.tag || '';
    const logoEl = document.getElementById('orgsLogoFilter');
    if (logoEl) logoEl.value = f.logoFilter || '';
    const dateEl = document.getElementById('orgsDateFilter');
    if (dateEl) dateEl.value = f.dateFilter || '';

    // Restore sort
    if (view.sort?.field) {
      this.sortField = view.sort.field;
      this.sortDirection = view.sort.direction || 'asc';
    }

    // Restore column visibility
    if (view.columns) {
      this._columnVisibility = { ...view.columns };
      try {
        localStorage.setItem('orgsColumnVisibility', JSON.stringify(this._columnVisibility));
      } catch (e) {
        console.warn('Failed to save column visibility to localStorage:', e.message);
      }
    }

    // Restore page size
    if (view.pageSize) this._pageSize = view.pageSize;

    // Restore tag filters
    if (view.tagFilters) this._selectedTagFilters = [...view.tagFilters];

    this.filterOrganisations();
    bootstrap.Modal.getInstance(document.getElementById('dynamicOrgModal'))?.hide();
    utils.showToast(`View "${name}" loaded`, 'success');
  },

  /**
   * Delete a saved view by name after confirmation.
   * @param {string} name - View name to delete
   * @returns {Promise<void>}
   */
  async deleteView(name) {
    if (!(await utils.confirmDialog({ title: 'Delete View', message: `Delete view "${name}"?` }))) return;
    try {
      // Load existing views from Supabase
      let views = {};
      try {
        const result = await apiClient.select('user_preferences', {
          select: 'value',
          filters: { key: 'orgsSavedViews' },
          pageSize: 1,
        });
        const data = result.data?.[0];
        if (data?.value) {
          views = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
        }
      } catch (fetchErr) {
        views = JSON.parse(localStorage.getItem('orgsSavedViews') || '{}');
      }

      delete views[name];

      try {
        await apiClient.upsert('user_preferences', {
          key: 'orgsSavedViews',
          value: JSON.stringify(views),
          user_email: STATE.currentUser?.email,
        });
      } catch (saveErr) {
        localStorage.setItem('orgsSavedViews', JSON.stringify(views));
      }

      utils.showToast(`View "${name}" deleted`, 'success');
      this.showSavedViews();
    } catch (e) {
      console.warn('Failed to delete view:', e.message);
      utils.showToast('Failed to delete view', 'warning');
    }
  },

  // ============================================
  // FEATURE: ORGANISATION SEGMENTS / SMART LISTS
  // ============================================
  showSegmentsBuilder() {
    const html = `
      <p class="small text-muted mb-3">Build dynamic segments based on rules. Matching orgs update in real-time.</p>
      <div id="segmentRules">
        <div class="segment-rule d-flex gap-2 align-items-center mb-2">
          <select class="form-select form-select-sm" style="width:auto;" id="segField0">
            <option value="tier">Tier</option><option value="status">Status</option><option value="county_city">Region</option>
            <option value="sector">Sector</option><option value="awards_count">Awards Count</option><option value="engagement">Engagement Score</option>
          </select>
          <select class="form-select form-select-sm" style="width:auto;" id="segOp0">
            <option value="eq">equals</option><option value="neq">not equals</option>
            <option value="gt">greater than</option><option value="lt">less than</option>
            <option value="contains">contains</option>
          </select>
          <input type="text" class="form-control form-control-sm" style="width:150px;" id="segVal0" placeholder="Value...">
        </div>
      </div>
      <button class="btn btn-sm btn-outline-secondary mb-3" data-action="orgsModule._addSegmentRule"><i class="bi bi-plus me-1"></i>Add Rule</button>
      <div class="d-flex gap-2">
        <button class="btn btn-sm btn-primary" data-action="orgsModule._applySegment"><i class="bi bi-funnel me-1"></i>Apply Segment</button>
        <button class="btn btn-sm btn-outline-success" data-action="orgsModule._saveSegment"><i class="bi bi-save me-1"></i>Save Segment</button>
        <button class="btn btn-sm btn-outline-secondary" data-action="orgsModule._loadSegments"><i class="bi bi-folder-open me-1"></i>Load Saved</button>
      </div>
      <div id="segmentResult" class="mt-3"></div>`;

    this._showDynamicModal('Organisation Segments', html, 'bi-funnel', 'modal-lg');
    this._segmentRuleCount = 1;
  },

  _segmentRuleCount: 1,

  _addSegmentRule() {
    const i = this._segmentRuleCount++;
    const ruleHtml = `<div class="segment-rule d-flex gap-2 align-items-center mb-2">
      <select class="form-select form-select-sm" style="width:auto;" id="segField${i}">
        <option value="tier">Tier</option><option value="status">Status</option><option value="county_city">Region</option>
        <option value="sector">Sector</option><option value="awards_count">Awards Count</option><option value="engagement">Engagement Score</option>
      </select>
      <select class="form-select form-select-sm" style="width:auto;" id="segOp${i}">
        <option value="eq">equals</option><option value="neq">not equals</option>
        <option value="gt">greater than</option><option value="lt">less than</option>
        <option value="contains">contains</option>
      </select>
      <input type="text" class="form-control form-control-sm" style="width:150px;" id="segVal${i}" placeholder="Value...">
      <button class="btn btn-sm btn-outline-danger" data-action="utils.removeParentElement"><i class="bi bi-x"></i></button>
    </div>`;
    document.getElementById('segmentRules')?.insertAdjacentHTML('beforeend', ruleHtml);
  },

  _getSegmentRules() {
    const rules = [];
    document.querySelectorAll('.segment-rule').forEach((el, _i) => {
      const field = el.querySelector('[id^="segField"]')?.value;
      const op = el.querySelector('[id^="segOp"]')?.value;
      const val = el.querySelector('[id^="segVal"]')?.value.trim();
      if (field && val) rules.push({ field, op, val });
    });
    return rules;
  },

  _matchesSegmentRules(org, rules) {
    return rules.every((r) => {
      let orgVal;
      if (r.field === 'engagement') orgVal = this.calculateEngagementScore(org);
      else if (r.field === 'awards_count') orgVal = org.awards_count || 0;
      else orgVal = org[r.field] || '';

      const testVal = r.val;
      switch (r.op) {
        case 'eq':
          return String(orgVal).toLowerCase() === testVal.toLowerCase();
        case 'neq':
          return String(orgVal).toLowerCase() !== testVal.toLowerCase();
        case 'gt':
          return Number(orgVal) > Number(testVal);
        case 'lt':
          return Number(orgVal) < Number(testVal);
        case 'contains':
          return String(orgVal).toLowerCase().includes(testVal.toLowerCase());
        default:
          return false;
      }
    });
  },

  _applySegment() {
    const rules = this._getSegmentRules();
    if (rules.length === 0) {
      utils.showToast('Add at least one rule', 'warning');
      return;
    }

    const matching = STATE.allOrganisations.filter((o) => this._matchesSegmentRules(o, rules));
    const resultEl = document.getElementById('segmentResult');
    if (resultEl) {
      resultEl.innerHTML = `<div class="alert alert-info small py-2">
        <strong>${matching.length}</strong> organisations match this segment.
        <button class="btn btn-sm btn-outline-primary ms-2" data-action="orgsModule._applySegmentAsFilter">Apply as Filter</button>
      </div>`;
    }
    this._lastSegmentMatches = matching;
  },

  _applySegmentAsFilter() {
    if (!this._lastSegmentMatches) return;
    STATE.filteredOrganisations = this._lastSegmentMatches;
    this._currentPage = 1;
    this.renderOrganisations();
    bootstrap.Modal.getInstance(document.getElementById('dynamicOrgModal'))?.hide();
    utils.showToast(`Showing ${this._lastSegmentMatches.length} segment matches`, 'success');
  },

  // Segments — delegated to crmModule (single source of truth)
  async _saveSegment() {
    if (typeof crmModule !== 'undefined') {
      crmModule.saveSmartSegment();
    }
  },
  async _loadSegments() {
    if (typeof crmModule !== 'undefined') {
      crmModule.loadSmartSegments();
    }
  },
  async _loadAndApplySegment(name) {
    if (typeof crmModule !== 'undefined') {
      crmModule._loadAndApplySegment(name);
    }
  },

  // ============================================
  // FEATURE: ORG COMPARISON SIDE-BY-SIDE
  // ============================================
  showOrgComparison() {
    if (this.selectedOrgs.size < 2 || this.selectedOrgs.size > 4) {
      utils.showToast('Select 2-4 organisations to compare', 'warning');
      return;
    }

    const orgs = Array.from(this.selectedOrgs)
      .map((id) => STATE.allOrganisations.find((o) => o.id === id))
      .filter(Boolean);
    const fields = [
      { key: 'status', label: 'Status' },
      { key: 'tier', label: 'Tier' },
      { key: 'sector', label: 'Sector' },
      { key: 'county_city', label: 'Region' },
      { key: 'county', label: 'County' },
      { key: 'contact_name', label: 'Contact' },
      { key: 'email', label: 'Email' },
      { key: 'website', label: 'Website' },
      { key: 'contact_phone', label: 'Phone' },
      { key: 'awards_count', label: 'Awards' },
      { key: '_engagement', label: 'Engagement Score' },
      { key: '_health', label: 'Health' },
      { key: '_lastContacted', label: 'Last Contacted' },
    ];

    const html = `
      <div class="table-responsive">
        <table class="table table-sm table-bordered">
          <thead><tr>
            <th style="width: 120px;"></th>
            ${orgs.map((o) => `<th class="small fw-semibold">${o.logo_url ? `<img src="${o.logo_url}" style="width:30px; height:20px; object-fit:contain;" class="me-1">` : ''}${utils.escapeHtml(o.company_name)}</th>`).join('')}
          </tr></thead>
          <tbody>
            ${fields
              .map(
                (f) => `<tr>
              <td class="small fw-semibold text-muted">${f.label}</td>
              ${orgs
                .map((o) => {
                  let val;
                  if (f.key === '_engagement') val = this.calculateEngagementScore(o) + '/100';
                  else if (f.key === '_health') val = this.getOrgHealthIndicator(o).label;
                  else if (f.key === '_lastContacted') {
                    const lc = this.getLastContacted(o.id);
                    val = lc ? new Date(lc).toLocaleDateString('en-GB') : 'Never';
                  } else val = o[f.key] || '-';
                  return `<td class="small">${utils.escapeHtml(String(val))}</td>`;
                })
                .join('')}
            </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>`;

    this._showDynamicModal(`Compare ${orgs.length} Organisations`, html, 'bi-layout-split', 'modal-xl');
  },

  // ============================================
  // FEATURE: COMPANIES HOUSE LOOKUP (UK)
  // ============================================
  /**
   * Search Companies House for an organisation by name and present matching results.
   * @param {string} orgId - Organisation ID
   * @returns {Promise<void>}
   */
  async companiesHouseLookup(orgId) {
    const org = STATE.allOrganisations.find((o) => o.id === orgId);
    if (!org) {
      utils.showToast('Organisation not found', 'error');
      return;
    }

    const searchName = org.company_name.replace(/\s*(Ltd|Limited|PLC|LLP|Inc)\s*\.?$/i, '').trim();
    utils.showToast('Searching Companies House...', 'info');

    try {
      // Use the free Companies House search API (no API key required for basic search)
      const response = await fetch(
        `https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(searchName)}&items_per_page=5`,
        {
          headers: { Accept: 'application/json' },
        }
      );

      if (!response.ok) {
        // Fallback: open Companies House website search
        window.open(
          `https://find-and-update.company-information.service.gov.uk/search?q=${encodeURIComponent(searchName)}`,
          '_blank'
        );
        utils.showToast('Opened Companies House search in new tab (API requires auth key)', 'info');
        return;
      }

      const data = await response.json();
      const items = data.items || [];

      if (items.length === 0) {
        utils.showToast('No results found on Companies House', 'warning');
        return;
      }

      const html = `
        <p class="small text-muted mb-3">Results for "<strong>${utils.escapeHtml(searchName)}</strong>" from Companies House</p>
        <div class="list-group">
          ${items
            .map(
              (c, _idx) => `<div class="list-group-item">
            <div class="d-flex justify-content-between">
              <div>
                <strong>${utils.escapeHtml(c.title)}</strong>
                <div class="small text-muted">${utils.escapeHtml(c.company_number || '')} &middot; ${utils.escapeHtml(c.company_status || '')} &middot; ${utils.escapeHtml(c.date_of_creation || '')}</div>
                ${c.address_snippet ? `<div class="small text-muted">${utils.escapeHtml(c.address_snippet)}</div>` : ''}
              </div>
              <button class="btn btn-sm btn-outline-primary"
                data-ch-address="${utils.escapeHtml(c.address_snippet || '')}"
                data-ch-number="${utils.escapeHtml(c.company_number || '')}"
                data-action="orgsModule._applyCompaniesHouseDataFromEl" data-id="${orgId}">
                <i class="bi bi-arrow-down-circle me-1"></i>Apply
              </button>
            </div>
          </div>`
            )
            .join('')}
        </div>`;

      this._showDynamicModal('Companies House Results', html, 'bi-bank', 'modal-lg');
    } catch (e) {
      console.error('Companies House lookup failed:', e);
      await utils.showErrorWithRetry('Failed to search Companies House', async () => {
        await this.companiesHouseLookup(orgId);
      });
    }
  },

  async _applyCompaniesHouseData(orgId, data) {
    try {
      const updates = {};
      if (data.address) updates.address = data.address;
      if (data.company_number) updates.company_number = data.company_number;
      updates.updated_at = new Date().toISOString();

      await apiClient.update('organisations', orgId, updates);

      const org = STATE.allOrganisations.find((o) => o.id === orgId);
      if (org) Object.assign(org, updates);

      utils.showToast('Companies House data applied', 'success');
      bootstrap.Modal.getInstance(document.getElementById('dynamicOrgModal'))?.hide();
    } catch (e) {
      utils.showToast('Error: ' + e.message, 'error');
    }
  },

  // ============================================
  // FEATURE: ADD ACTIVITY NOTE
  // ============================================
  showAddActivityNote(_orgId) {
    const html = `
      <div class="mb-3"><label class="form-label fw-semibold">Note Type</label>
        <select class="form-select" id="activityNoteType">
          <option value="note">General Note</option><option value="call">Phone Call</option>
          <option value="meeting">Meeting</option><option value="email">Email</option><option value="task">Task</option>
        </select></div>
      <div class="mb-3"><label class="form-label fw-semibold">Content</label>
        <textarea class="form-control" id="activityNoteContent" rows="4" placeholder="Enter note details..."></textarea></div>
      <div class="mb-3"><label class="form-label fw-semibold">Priority</label>
        <select class="form-select" id="activityNotePriority">
          <option value="normal">Normal</option><option value="high">High</option><option value="low">Low</option>
        </select></div>
      <button class="btn btn-primary w-100" data-action="orgsModule.saveActivityNote" data-id="orgId"><i class="bi bi-plus-circle me-2"></i>Add Note</button>`;
    this._showDynamicModal('Add Activity Note', html, 'bi-journal-plus', '');
  },

  /**
   * Save a typed activity note (call, meeting, email, etc.) for an organisation.
   * @param {string} orgId - Organisation ID
   * @returns {Promise<void>}
   */
  async saveActivityNote(orgId) {
    const type = document.getElementById('activityNoteType')?.value || 'note';
    const content = document.getElementById('activityNoteContent')?.value?.trim();
    const priority = document.getElementById('activityNotePriority')?.value || 'normal';
    if (!content) {
      utils.showToast('Please enter note content', 'warning');
      return;
    }
    try {
      const user = await this._getCurrentUserEmail();
      await apiClient.insert('org_activity_notes', {
        organisation_id: orgId,
        type,
        content,
        priority,
        created_by: user,
      });
    } catch (e) {
      console.warn('DB insert for activity note failed, using localStorage:', e);
      const key = `bta_org_notes_${orgId}`;
      const stored = JSON.parse(localStorage.getItem(key) || '[]');
      stored.push({
        id: crypto.randomUUID(),
        organisation_id: orgId,
        type,
        content,
        priority,
        created_at: new Date().toISOString(),
      });
      localStorage.setItem(key, JSON.stringify(stored));
    }
    this._logAudit(orgId, 'note_added', '', `${type}: ${content.substring(0, 80)}`);
    utils.showToast('Note added', 'success');
    bootstrap.Modal.getInstance(document.getElementById('dynamicOrgModal'))?.hide();
    try {
      const timeline = await this.loadUnifiedTimeline(orgId);
      const el = document.getElementById('orgActivityTimeline');
      if (el) el.innerHTML = this.renderUnifiedTimeline(timeline);
    } catch (e) {
      /* timeline refresh best-effort */
    }
  },

  // Email sequences — delegated to marketingModule (single source of truth)
  showEmailSequences() {
    if (typeof marketingModule !== 'undefined') {
      marketingModule.loadEmailSequences();
      const tab = document.getElementById('marketing-tab');
      if (tab) new bootstrap.Tab(tab).show();
      setTimeout(() => {
        const sub = document.getElementById('email-sequences-subtab');
        if (sub) new bootstrap.Tab(sub).show();
      }, 100);
    }
  },
  showCreateSequence() {
    if (typeof marketingModule !== 'undefined') marketingModule.showCreateSequence();
  },
  toggleSequence(i) {
    if (typeof marketingModule !== 'undefined') marketingModule.toggleSequence(i);
  },
  deleteSequence(i) {
    if (typeof marketingModule !== 'undefined') marketingModule.deleteSequence(i);
  },

  // ============================================
  // FEATURE: MY TASKS DASHBOARD
  // ============================================
  /**
   * Open a modal showing the current user's overdue, today, and upcoming follow-up tasks.
   * @returns {Promise<void>}
   */
  async showMyTasks() {
    let followUps = [];
    try {
      const result = await apiClient.select('organisation_follow_ups', {
        sort: { column: 'date', ascending: true },
        pageSize: 1000,
      });
      followUps = result.data || [];
    } catch (e) {
      console.warn('Could not load follow-ups:', e);
    }
    const today = new Date().toISOString().split('T')[0];
    const overdue = followUps.filter((f) => !f.done && f.date < today);
    const todayTasks = followUps.filter((f) => !f.done && f.date === today);
    const upcoming = followUps.filter((f) => !f.done && f.date > today).slice(0, 20);
    const completed = followUps.filter((f) => f.done).slice(0, 10);

    const renderTask = (f, section) => {
      const org = STATE.allOrganisations.find((o) => o.id === f.org_id);
      const orgName = org ? utils.escapeHtml(org.company_name) : 'Unknown';
      const icons = {
        overdue: 'bi-exclamation-triangle text-danger',
        today: 'bi-bell text-warning',
        completed: 'bi-check-circle text-success',
        upcoming: 'bi-clock text-info',
      };
      return `<div class="d-flex align-items-center py-2 border-bottom">
        <i class="bi ${icons[section]} me-2 fs-5"></i>
        <div class="flex-grow-1"><div class="fw-semibold small">${utils.escapeHtml(f.note || 'Follow up')}</div>
        <div class="text-muted" style="font-size:0.75rem;">${orgName} · ${new Date(f.date).toLocaleDateString('en-GB')}${f.assignee ? ' · ' + utils.escapeHtml(f.assignee) : ''}</div></div>
        ${!f.done ? `<button class="btn btn-sm btn-outline-success me-1" data-action="orgsModule.completeFollowUpAndRefresh" data-args='${JSON.stringify([f.org_id, f.id])}'><i class="bi bi-check"></i></button>` : ''}
        ${org ? `<button class="btn btn-sm btn-outline-primary" data-action="orgsModule.openCompanyProfile" data-id="${f.org_id}"><i class="bi bi-eye"></i></button>` : ''}
      </div>`;
    };

    const html = `<div class="row mb-3 text-center">
        <div class="col-3"><div class="card border-danger"><div class="card-body py-2"><h4 class="text-danger mb-0">${overdue.length}</h4><small class="text-muted">Overdue</small></div></div></div>
        <div class="col-3"><div class="card border-warning"><div class="card-body py-2"><h4 class="text-warning mb-0">${todayTasks.length}</h4><small class="text-muted">Today</small></div></div></div>
        <div class="col-3"><div class="card border-info"><div class="card-body py-2"><h4 class="text-info mb-0">${upcoming.length}</h4><small class="text-muted">Upcoming</small></div></div></div>
        <div class="col-3"><div class="card border-success"><div class="card-body py-2"><h4 class="text-success mb-0">${completed.length}</h4><small class="text-muted">Done</small></div></div></div>
      </div>
      ${overdue.length > 0 ? `<h6 class="text-danger fw-bold"><i class="bi bi-exclamation-triangle me-1"></i>Overdue (${overdue.length})</h6>${overdue.map((f) => renderTask(f, 'overdue')).join('')}<hr>` : ''}
      ${todayTasks.length > 0 ? `<h6 class="text-warning fw-bold"><i class="bi bi-bell me-1"></i>Due Today</h6>${todayTasks.map((f) => renderTask(f, 'today')).join('')}<hr>` : ''}
      ${upcoming.length > 0 ? `<h6 class="text-info fw-bold"><i class="bi bi-clock me-1"></i>Upcoming</h6>${upcoming.map((f) => renderTask(f, 'upcoming')).join('')}<hr>` : ''}
      ${completed.length > 0 ? `<h6 class="text-success fw-bold"><i class="bi bi-check-circle me-1"></i>Recently Completed</h6>${completed.map((f) => renderTask(f, 'completed')).join('')}` : ''}
      ${followUps.filter((f) => !f.done).length === 0 ? '<div class="text-center py-4"><i class="bi bi-emoji-smile fs-1 d-block mb-2 text-success"></i><p class="text-muted">All caught up!</p></div>' : ''}`;
    this._showDynamicModal('My Tasks & Follow-ups', html, 'bi-person-check', 'modal-lg');
  },

  // ============================================
  // FEATURE: FIELD-LEVEL AUDIT / CHANGE HISTORY
  // ============================================
  /**
   * Open a modal showing the full field-level change history for an organisation.
   * @param {string} orgId - Organisation ID
   * @returns {Promise<void>}
   */
  async showFieldLevelAudit(orgId) {
    let logs = [];
    try {
      const result = await apiClient.select('org_audit_log', {
        filters: { org_id: { eq: orgId } },
        sort: { column: 'created_at', ascending: false },
        pageSize: 100,
      });
      logs = result.data || [];
    } catch (e) {
      console.warn('Audit log load error:', e);
    }
    if (logs.length === 0) {
      this._showDynamicModal(
        'Change History',
        '<div class="text-center py-4 text-muted"><i class="bi bi-clock-history fs-1 d-block mb-2"></i>No change history recorded.</div>',
        'bi-clock-history',
        ''
      );
      return;
    }
    const iconMap = {
      status_change: 'bi-arrow-repeat text-warning',
      archived: 'bi-archive text-danger',
      restored: 'bi-box-arrow-up text-success',
      note_added: 'bi-journal-plus text-info',
      email_sent: 'bi-envelope text-primary',
      field_update: 'bi-pencil text-secondary',
    };
    const html = `<div class="mb-3"><input type="text" class="form-control form-control-sm" placeholder="Filter history..." data-on-input="utils.filterElementsByText" data-args='${JSON.stringify(['.audit-entry'])}'></div>
      <div style="max-height:500px;overflow-y:auto;">${logs
        .map((log) => {
          const icon = iconMap[log.action] || 'bi-circle text-muted';
          return `<div class="audit-entry d-flex align-items-start py-2 border-bottom">
          <i class="bi ${icon} me-2 mt-1 fs-5"></i><div class="flex-grow-1">
          <div class="fw-semibold small">${utils.escapeHtml(log.action?.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) || '')}</div>
          <div class="small">${utils.escapeHtml(log.details || '')}</div>
          <div class="text-muted" style="font-size:0.7rem;">${new Date(log.created_at).toLocaleString('en-GB')} · by ${utils.escapeHtml(log.performed_by || 'system')}</div>
        </div></div>`;
        })
        .join('')}</div>`;
    this._showDynamicModal('Change History', html, 'bi-clock-history', 'modal-lg');
  },

  // ============================================
  // FEATURE: BULK IMPORT VALIDATION PREVIEW
  // ============================================
  validateImportData(rows) {
    const issues = [];
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const existNames = new Set(STATE.allOrganisations.map((o) => o.company_name?.toLowerCase().trim()));
    const existEmails = new Set(STATE.allOrganisations.map((o) => o.email?.toLowerCase().trim()).filter(Boolean));
    const seen = new Set();
    rows.forEach((row, i) => {
      const r = i + 1;
      if (!row.company_name?.trim()) issues.push({ row: r, severity: 'error', message: 'Missing company name' });
      if (row.email && !emailRe.test(row.email))
        issues.push({ row: r, severity: 'error', message: `Invalid email: ${row.email}` });
      if (row.company_name && existNames.has(row.company_name.toLowerCase().trim()))
        issues.push({ row: r, severity: 'warning', message: `Duplicate: "${row.company_name}" already exists` });
      if (row.email && existEmails.has(row.email.toLowerCase().trim()))
        issues.push({ row: r, severity: 'warning', message: `Email exists: ${row.email}` });
      const k = row.company_name?.toLowerCase().trim();
      if (k && seen.has(k))
        issues.push({ row: r, severity: 'warning', message: `Duplicate in import: "${row.company_name}"` });
      if (k) seen.add(k);
      if (!row.county_city?.trim()) issues.push({ row: r, severity: 'info', message: 'Missing region' });
    });
    return issues;
  },

  showImportValidationPreview(rows) {
    const issues = this.validateImportData(rows);
    const errors = issues.filter((i) => i.severity === 'error'),
      warnings = issues.filter((i) => i.severity === 'warning'),
      infos = issues.filter((i) => i.severity === 'info');
    return `<div class="row text-center mb-3">
      <div class="col-3"><div class="card"><div class="card-body py-2"><h5 class="mb-0">${rows.length}</h5><small>Total Rows</small></div></div></div>
      <div class="col-3"><div class="card border-danger"><div class="card-body py-2"><h5 class="text-danger mb-0">${errors.length}</h5><small>Errors</small></div></div></div>
      <div class="col-3"><div class="card border-warning"><div class="card-body py-2"><h5 class="text-warning mb-0">${warnings.length}</h5><small>Warnings</small></div></div></div>
      <div class="col-3"><div class="card border-info"><div class="card-body py-2"><h5 class="text-info mb-0">${infos.length}</h5><small>Info</small></div></div></div>
    </div>
    ${
      errors.length > 0
        ? `<div class="alert alert-danger py-2"><strong>Errors:</strong><ul class="mb-0 small">${errors
            .slice(0, 20)
            .map((e) => `<li>Row ${e.row}: ${utils.escapeHtml(e.message)}</li>`)
            .join('')}</ul></div>`
        : ''
    }
    ${
      warnings.length > 0
        ? `<div class="alert alert-warning py-2"><strong>Warnings:</strong><ul class="mb-0 small">${warnings
            .slice(0, 20)
            .map((w) => `<li>Row ${w.row}: ${utils.escapeHtml(w.message)}</li>`)
            .join('')}</ul></div>`
        : ''
    }
    ${errors.length === 0 ? '<div class="alert alert-success py-2"><i class="bi bi-check-circle me-2"></i>Ready to import.</div>' : '<div class="alert alert-danger py-2">Fix errors before importing.</div>'}`;
  },

  // Scheduled reports — delegated to reportsScheduler (single source of truth)
  showScheduledReports() {
    if (typeof reportsScheduler !== 'undefined') {
      reportsScheduler.loadReports();
      const tab = document.getElementById('reports-tab');
      if (tab) new bootstrap.Tab(tab).show();
    }
  },
  showCreateScheduledReport() {
    if (typeof reportsScheduler !== 'undefined') reportsScheduler.showCreateReport();
  },
  previewScheduledReport(i) {
    if (typeof reportsScheduler !== 'undefined') reportsScheduler.previewReport(i);
  },
  deleteScheduledReport(i) {
    if (typeof reportsScheduler !== 'undefined') reportsScheduler.deleteReport(i);
  },

  // ============================================
  // FEATURE: DUPLICATE DETECTION DASHBOARD
  // ============================================
  showDuplicateDetectionDashboard() {
    const orgs = STATE.allOrganisations;
    const nameG = new Map(),
      emailG = new Map(),
      phoneG = new Map(),
      webG = new Map();
    orgs.forEach((org) => {
      const n = org.company_name
        ?.toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .trim();
      if (n && n.length > 2) {
        if (!nameG.has(n)) nameG.set(n, []);
        nameG.get(n).push(org);
      }
      const e = org.email?.toLowerCase().trim();
      if (e) {
        if (!emailG.has(e)) emailG.set(e, []);
        emailG.get(e).push(org);
      }
      const p = org.phone?.replace(/\D/g, '');
      if (p && p.length >= 8) {
        if (!phoneG.has(p)) phoneG.set(p, []);
        phoneG.get(p).push(org);
      }
      const w = org.website
        ?.toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/\/.*/, '')
        .trim();
      if (w) {
        if (!webG.has(w)) webG.set(w, []);
        webG.get(w).push(org);
      }
    });
    const nD = Array.from(nameG.values()).filter((g) => g.length > 1);
    const eD = Array.from(emailG.values()).filter((g) => g.length > 1);
    const pD = Array.from(phoneG.values()).filter((g) => g.length > 1);
    const wD = Array.from(webG.values()).filter((g) => g.length > 1);
    const total = nD.length + eD.length + pD.length + wD.length;

    const renderG = (groups, label, icon) =>
      groups.length === 0
        ? ''
        : `<h6 class="fw-bold mt-3"><i class="bi ${icon} me-2"></i>${label} (${groups.length})</h6>` +
          groups
            .slice(0, 15)
            .map(
              (g) => `<div class="card mb-2"><div class="card-body py-2"><div class="d-flex flex-wrap gap-2">
        ${g
          .map(
            (
              o
            ) => `<div class="border rounded px-2 py-1 small"><a href="#" class="text-primary text-decoration-none" data-action="orgsModule.openCompanyProfile" data-id="${o.id}">${utils.escapeHtml(o.company_name)}</a>
        <span class="text-muted ms-1">${utils.escapeHtml(o.county_city || '')}</span></div>`
          )
          .join('')}
        <button class="btn btn-sm btn-outline-warning" data-action="orgsModule.mergeDuplicateGroup" data-args='${JSON.stringify(g.map((o) => o.id))}'>
          <i class="bi bi-intersect me-1"></i>Merge</button>
      </div></div></div>`
            )
            .join('');

    const html = `<div class="row text-center mb-3">
        <div class="col-3"><div class="card"><div class="card-body py-2"><h4 class="mb-0 ${nD.length ? 'text-danger' : 'text-success'}">${nD.length}</h4><small>Name</small></div></div></div>
        <div class="col-3"><div class="card"><div class="card-body py-2"><h4 class="mb-0 ${eD.length ? 'text-warning' : 'text-success'}">${eD.length}</h4><small>Email</small></div></div></div>
        <div class="col-3"><div class="card"><div class="card-body py-2"><h4 class="mb-0 ${pD.length ? 'text-warning' : 'text-success'}">${pD.length}</h4><small>Phone</small></div></div></div>
        <div class="col-3"><div class="card"><div class="card-body py-2"><h4 class="mb-0 ${wD.length ? 'text-info' : 'text-success'}">${wD.length}</h4><small>Website</small></div></div></div>
      </div>
      ${total === 0 ? '<div class="text-center py-4"><i class="bi bi-shield-check fs-1 text-success d-block mb-2"></i><p class="text-muted">No duplicates detected!</p></div>' : ''}
      ${renderG(nD, 'Duplicate Names', 'bi-building')}${renderG(eD, 'Duplicate Emails', 'bi-envelope')}
      ${renderG(pD, 'Duplicate Phones', 'bi-telephone')}${renderG(wD, 'Duplicate Websites', 'bi-globe')}`;
    this._showDynamicModal('Duplicate Detection Dashboard', html, 'bi-search', 'modal-xl');
  },

  // ============================================
  // FEATURE: PUBLIC SHARE LINK
  // ============================================
  generateShareLink(orgId) {
    const org = STATE.allOrganisations.find((o) => o.id === orgId);
    if (!org) {
      utils.showToast('Organisation not found', 'error');
      return;
    }
    const token = btoa(orgId + ':' + org.company_name)
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, 24);
    const shareUrl = `${window.location.origin}${window.location.pathname}?share=${token}&org=${orgId}`;
    const shares = JSON.parse(localStorage.getItem('orgShareTokens') || '{}');
    shares[token] = { orgId, created: new Date().toISOString(), active: true };
    localStorage.setItem('orgShareTokens', JSON.stringify(shares));
    const html = `<div class="text-center mb-3"><i class="bi bi-share fs-1 text-primary d-block mb-2"></i>
        <h6>Share <strong>${utils.escapeHtml(org.company_name)}</strong></h6>
        <p class="text-muted small">Read-only profile link.</p></div>
      <div class="input-group mb-3"><input type="text" class="form-control" id="shareLinkUrl" value="${utils.escapeHtml(shareUrl)}" readonly>
        <button class="btn btn-primary" data-action="utils.copyInputValueById" data-id="shareLinkUrl"><i class="bi bi-clipboard me-1"></i>Copy</button></div>
      <div class="row text-center"><div class="col-6"><a href="mailto:?subject=${encodeURIComponent('Profile: ' + org.company_name)}&body=${encodeURIComponent(shareUrl)}" class="btn btn-outline-primary w-100"><i class="bi bi-envelope me-1"></i>Email</a></div>
      <div class="col-6"><button class="btn btn-outline-danger w-100" data-action="orgsModule.revokeShareLink" data-id="${token}"><i class="bi bi-x-circle me-1"></i>Revoke</button></div></div>`;
    this._showDynamicModal('Share Organisation Profile', html, 'bi-share', '');
  },

  revokeShareLink(token) {
    const shares = JSON.parse(localStorage.getItem('orgShareTokens') || '{}');
    delete shares[token];
    localStorage.setItem('orgShareTokens', JSON.stringify(shares));
    utils.showToast('Share link revoked', 'success');
    bootstrap.Modal.getInstance(document.getElementById('dynamicOrgModal'))?.hide();
  },

  // Accounting integration — delegated to paymentsModule (single source of truth)
  showXeroIntegration() {
    if (typeof paymentsModule !== 'undefined') {
      paymentsModule.loadAccountingIntegration();
      const tab = document.getElementById('payments-tab');
      if (tab) new bootstrap.Tab(tab).show();
      setTimeout(() => {
        const sub = document.getElementById('accounting-subtab');
        if (sub) new bootstrap.Tab(sub).show();
      }, 100);
    }
  },
  _setAccountingProvider(p) {
    if (typeof paymentsModule !== 'undefined') paymentsModule._setAccountingProvider(p);
  },
  _connectAccounting() {
    if (typeof paymentsModule !== 'undefined') paymentsModule._connectAccounting();
  },
  _disconnectAccounting() {
    if (typeof paymentsModule !== 'undefined') paymentsModule._disconnectAccounting();
  },
  _runAccountingSync() {
    if (typeof paymentsModule !== 'undefined') paymentsModule._runAccountingSync();
  },

  // ============================================
  // FEATURE: INTERACTIVE BRITISH ISLES MAP
  // ============================================
  _mapInstance: null,
  _mapMarkers: [],
  _mapViewActive: false,

  _UK_LOCATIONS: {
    'Greater London': [51.507, -0.128],
    London: [51.507, -0.128],
    'South East': [51.28, 0.52],
    'South West': [50.82, -3.0],
    'East of England': [52.2, 0.9],
    'East Midlands': [52.83, -1.0],
    'West Midlands': [52.48, -1.9],
    'North West': [53.5, -2.5],
    'North East': [54.97, -1.6],
    'Wales, NW (Gwynedd)': [52.88, -4.07],
    'Wales, NE (Clwyd)': [53.18, -3.43],
    'Wales, Mid & West': [52.07, -4.3],
    'Wales, South': [51.58, -3.3],
    Wales: [52.13, -3.63],
    'Scotland, North': [57.48, -4.22],
    'Scotland, Central': [56.07, -3.47],
    'Scotland, West': [55.95, -4.53],
    'Scotland, South': [55.2, -4.0],
    Scotland: [56.49, -4.2],
    'South East England': [51.28, 0.52],
    'South West England': [50.82, -3.0],
    East: [52.2, 0.9],
    'North West England': [53.5, -2.5],
    'North East England': [54.97, -1.6],
    Birmingham: [52.486, -1.89],
    Manchester: [53.481, -2.243],
    Glasgow: [55.864, -4.252],
    Leeds: [53.801, -1.549],
    Edinburgh: [55.953, -3.188],
    Liverpool: [53.408, -2.992],
    Bristol: [51.455, -2.588],
    Sheffield: [53.381, -1.47],
    Newcastle: [54.978, -1.618],
    'Newcastle upon Tyne': [54.978, -1.618],
    Nottingham: [52.955, -1.158],
    Leicester: [52.637, -1.14],
    Belfast: [54.597, -5.93],
    Brighton: [50.823, -0.137],
    Cardiff: [51.482, -3.179],
    Aberdeen: [57.15, -2.094],
    Derby: [52.923, -1.475],
    Exeter: [50.718, -3.534],
    Plymouth: [50.376, -4.143],
    Southampton: [50.91, -1.404],
    Portsmouth: [50.82, -1.088],
    Oxford: [51.752, -1.258],
    Cambridge: [52.205, 0.122],
    Norwich: [52.631, 1.297],
    Ipswich: [52.057, 1.148],
    Coventry: [52.407, -1.52],
    Wolverhampton: [52.587, -2.129],
    'Stoke-on-Trent': [53.003, -2.179],
    Sunderland: [54.907, -1.384],
    Swansea: [51.621, -3.944],
    Newport: [51.584, -2.998],
    Dundee: [56.462, -2.971],
    Inverness: [57.478, -4.225],
    Perth: [56.395, -3.431],
    Stirling: [56.117, -3.937],
    York: [53.959, -1.082],
    Chester: [53.193, -2.893],
    Worcester: [52.192, -2.222],
    Gloucester: [51.864, -2.238],
    Bath: [51.381, -2.359],
    Canterbury: [51.28, 1.079],
    Bournemouth: [50.719, -1.881],
    Reading: [51.454, -0.978],
    'Milton Keynes': [52.041, -0.759],
    Northampton: [52.241, -0.903],
    Luton: [51.879, -0.42],
    Peterborough: [52.57, -0.241],
    Colchester: [51.889, 0.903],
    Chelmsford: [51.736, 0.469],
    Maidstone: [51.272, 0.529],
    Guildford: [51.236, -0.57],
    Swindon: [51.556, -1.78],
    Cheltenham: [51.899, -2.078],
    Hereford: [52.057, -2.716],
    Shrewsbury: [52.708, -2.754],
    Lincoln: [53.231, -0.541],
    Hull: [53.768, -0.327],
    Doncaster: [53.523, -1.129],
    Wakefield: [53.683, -1.498],
    Bradford: [53.796, -1.759],
    Huddersfield: [53.646, -1.785],
    Bolton: [53.579, -2.43],
    Wigan: [53.545, -2.633],
    Warrington: [53.39, -2.597],
    Preston: [53.763, -2.703],
    Lancaster: [54.047, -2.801],
    Carlisle: [54.893, -2.933],
    Middlesbrough: [54.574, -1.235],
    Durham: [54.775, -1.585],
    Darlington: [54.524, -1.553],
    Blackpool: [53.818, -3.036],
    Stockport: [53.411, -2.158],
    Salford: [53.488, -2.29],
    Blackburn: [53.749, -2.485],
    Burnley: [53.789, -2.239],
    Bangor: [53.227, -4.129],
    Wrexham: [53.046, -2.993],
    Aberystwyth: [52.415, -4.083],
    Kent: [51.28, 0.77],
    Surrey: [51.25, -0.38],
    Essex: [51.73, 0.47],
    'East Sussex': [50.92, -0.08],
    'West Sussex': [50.92, -0.48],
    Hampshire: [51.05, -1.15],
    Berkshire: [51.45, -1.08],
    Dorset: [50.75, -2.25],
    Wiltshire: [51.35, -1.83],
    Somerset: [51.05, -2.95],
    Devon: [50.72, -3.53],
    Cornwall: [50.27, -5.05],
    Norfolk: [52.66, 0.94],
    Suffolk: [52.19, 1.0],
    Cambridgeshire: [52.25, 0.12],
    Hertfordshire: [51.81, -0.24],
    Buckinghamshire: [51.77, -0.81],
    Oxfordshire: [51.77, -1.26],
    Bedfordshire: [52.0, -0.45],
    Northamptonshire: [52.24, -0.9],
    Warwickshire: [52.28, -1.58],
    Worcestershire: [52.19, -2.22],
    Gloucestershire: [51.86, -2.24],
    Staffordshire: [52.82, -2.0],
    Shropshire: [52.63, -2.75],
    Cheshire: [53.19, -2.59],
    Derbyshire: [53.1, -1.56],
    Nottinghamshire: [53.1, -1.0],
    Leicestershire: [52.63, -1.13],
    Lincolnshire: [53.07, -0.26],
    Lancashire: [53.85, -2.58],
    Cumbria: [54.57, -2.75],
    Merseyside: [53.4, -2.99],
    'Tyne and Wear': [54.96, -1.6],
    'County Durham': [54.68, -1.73],
    Fife: [56.25, -3.19],
    Aberdeenshire: [57.17, -2.72],
    Highland: [57.47, -5.0],
    Ayrshire: [55.47, -4.58],
    Borders: [55.55, -2.78],
    Lothian: [55.93, -3.13],
    Lanarkshire: [55.68, -3.78],
    Renfrewshire: [55.83, -4.43],
    Antrim: [54.72, -6.21],
    Down: [54.37, -5.72],
    Armagh: [54.35, -6.65],
    Tyrone: [54.6, -7.3],
    Derry: [55.0, -7.32],
    Fermanagh: [54.35, -7.63],
    'Isle of Man': [54.24, -4.55],
    'Isle of Wight': [50.69, -1.3],
  },

  _getOrgCoords(org) {
    const c = org.county?.trim(),
      r = org.county_city?.trim();
    if (c && this._UK_LOCATIONS[c]) return this._UK_LOCATIONS[c];
    if (r && this._UK_LOCATIONS[r]) return this._UK_LOCATIONS[r];
    if (c) {
      for (const [k, v] of Object.entries(this._UK_LOCATIONS)) {
        if (k.toLowerCase().includes(c.toLowerCase()) || c.toLowerCase().includes(k.toLowerCase())) return v;
      }
    }
    if (r) {
      for (const [k, v] of Object.entries(this._UK_LOCATIONS)) {
        if (k.toLowerCase().includes(r.toLowerCase()) || r.toLowerCase().includes(k.toLowerCase())) return v;
      }
    }
    return null;
  },

  toggleMapView() {
    this._mapViewActive = !this._mapViewActive;
    const mapContainer = document.getElementById('orgMapContainer');
    const tableEl = document.getElementById('orgTableContainer');
    const mapBtn = document.getElementById('mapToggleBtn');
    if (this._mapViewActive) {
      if (mapContainer) mapContainer.style.display = 'block';
      if (tableEl) tableEl.style.display = 'none';
      if (mapBtn) {
        mapBtn.classList.remove('btn-outline-success');
        mapBtn.classList.add('btn-success');
      }
      this._initLeafletMap();
    } else {
      if (mapContainer) mapContainer.style.display = 'none';
      if (tableEl) tableEl.style.display = 'block';
      if (mapBtn) {
        mapBtn.classList.remove('btn-success');
        mapBtn.classList.add('btn-outline-success');
      }
      if (this._mapInstance) {
        this._mapInstance.remove();
        this._mapInstance = null;
      }
    }
  },

  _initLeafletMap() {
    if (typeof L === 'undefined') {
      utils.showToast('Map library not loaded. Please refresh.', 'error');
      return;
    }
    if (this._mapInstance) {
      this._mapInstance.remove();
      this._mapInstance = null;
    }
    this._mapInstance = L.map('orgLeafletMap').setView([54.5, -3.5], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(this._mapInstance);
    this._plotOrgsOnMap();
  },

  _plotOrgsOnMap() {
    if (!this._mapInstance) return;
    this._mapMarkers.forEach((m) => m.remove());
    this._mapMarkers = [];
    const orgs = STATE.filteredOrganisations;
    let plotted = 0,
      unplotted = 0;
    const locGroups = {};
    orgs.forEach((org) => {
      const coords = this._getOrgCoords(org);
      if (!coords) {
        unplotted++;
        return;
      }
      const key = coords.join(',');
      locGroups[key] = locGroups[key] || [];
      locGroups[key].push(org);
    });
    const statusColors = {
      prospect: '#6c757d',
      entrant: '#0d6efd',
      nominee: '#ffc107',
      shortlisted: '#fd7e14',
      winner: '#198754',
      sponsor: '#6f42c1',
      archived: '#adb5bd',
    };
    Object.entries(locGroups).forEach(([key, gOrgs]) => {
      const [bLat, bLng] = key.split(',').map(Number);
      gOrgs.forEach((org, i) => {
        const jitter = i * 0.008;
        const angle = (i * 137.5 * Math.PI) / 180;
        const lat = bLat + jitter * Math.cos(angle);
        const lng = bLng + jitter * Math.sin(angle);
        const color = statusColors[org.status] || '#6c757d';
        const icon = L.divIcon({
          className: 'custom-map-marker',
          html: `<div style="width:28px;height:28px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:bold;cursor:pointer;">${org.company_name?.charAt(0) || '?'}</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });
        const marker = L.marker([lat, lng], { icon }).addTo(this._mapInstance);
        marker.bindPopup(`<div style="min-width:220px;">
          <strong style="font-size:14px;">${utils.escapeHtml(org.company_name)}</strong><br>
          <span class="badge" style="background:${color};color:white;font-size:10px;">${org.status || 'prospect'}</span>
          ${org.sector ? `<span class="badge bg-light text-dark ms-1" style="font-size:10px;">${utils.escapeHtml(utils.toTitleCase(org.sector))}</span>` : ''}
          <hr style="margin:6px 0;">
          ${org.county_city ? `<div style="font-size:12px;"><i class="bi bi-geo-alt"></i> ${utils.escapeHtml(org.county_city)}${org.county ? ', ' + utils.escapeHtml(org.county) : ''}</div>` : ''}
          ${org.email ? `<div style="font-size:12px;"><i class="bi bi-envelope"></i> ${utils.escapeHtml(org.email)}</div>` : ''}
          ${org.phone ? `<div style="font-size:12px;"><i class="bi bi-telephone"></i> ${utils.escapeHtml(org.phone)}</div>` : ''}
          ${org.website ? `<div style="font-size:12px;"><i class="bi bi-globe"></i> <a href="${utils.escapeHtml(org.website)}" target="_blank">${utils.escapeHtml(org.website)}</a></div>` : ''}
          <div style="margin-top:8px;"><button class="btn btn-sm btn-primary" style="font-size:11px;" data-action="orgsModule.openCompanyProfile" data-id="${org.id}"><i class="bi bi-eye me-1"></i>View Profile</button></div>
        </div>`);
        this._mapMarkers.push(marker);
        plotted++;
      });
    });
    const countEl = document.getElementById('mapOrgCount');
    if (countEl) countEl.textContent = `${plotted} plotted` + (unplotted > 0 ? `, ${unplotted} without location` : '');
    if (this._mapMarkers.length > 0) {
      const group = L.featureGroup(this._mapMarkers);
      this._mapInstance.fitBounds(group.getBounds().pad(0.1));
    }
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
  },

  // ============================================
  // DATA-ACTION DELEGATION HELPER METHODS
  // ============================================

  /** Helper for data-action: apply bulk field update from modal */
  _applyBulkFieldUpdate(field) {
    const val = document.getElementById('bulkFieldValue')?.value;
    if (!val) {
      utils.showToast('Please select a value', 'warning');
      return;
    }
    bootstrap.Modal.getInstance(document.getElementById('bulkFieldModal'))?.hide();
    this.bulkUpdateField(field, val);
  },

  /** Helper for data-action: filter by missing field from data quality modal */
  filterByMissingField(field) {
    this._filterMissingField = field;
    this.filterOrganisations();
    bootstrap.Modal.getInstance(document.getElementById('dynamicOrgModal'))?.hide();
  },

  /** Helper for data-action: filter by country from map/chart */
  filterByRegion(country) {
    const el = document.getElementById('orgsCountryFilter');
    if (el) el.value = country;
    locationModule.populateAreaDropdown('orgsAreaFilter', country, 'All Areas');
    this.filterOrganisations();
    bootstrap.Modal.getInstance(document.getElementById('dynamicOrgModal'))?.hide();
  },

  showOrgsView() {
    const btn = document.getElementById('orgsViewBtn');
    if (btn) bootstrap.Tab.getOrCreateInstance(btn).show();
  },

  showSponsorsView() {
    const btn = document.getElementById('sponsorsViewBtn');
    if (btn) bootstrap.Tab.getOrCreateInstance(btn).show();
  },

  _initSubNavTabs() {
    const sponsorsBtn = document.getElementById('sponsorsViewBtn');
    if (sponsorsBtn) {
      sponsorsBtn.addEventListener('shown.bs.tab', () => {
        if (typeof marketingModule !== 'undefined') marketingModule.loadSponsors();
      });
    }
  },

  /** Helper for data-action: filter by status from dashboard card */
  filterByStatus(status) {
    const el = document.getElementById('orgsStatusFilter');
    if (el) el.value = status;
    this.filterOrganisations();
  },

  /** Helper for data-action: filter by date threshold from dashboard card */
  filterByDate(dateType) {
    if (dateType === 'stale') {
      // Filter for orgs not updated in 6+ months
      this._filterMissingField = null;
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      this.filteredOrganisations = (STATE.allOrganisations || []).filter((org) => {
        const updated = new Date(org.updated_at || org.created_at);
        return updated < sixMonthsAgo;
      });
      this.renderOrganisations();
      return;
    }
    this.filterOrganisations();
  },

  /** Helper for data-action: close modal and open company profile */
  closeModalAndOpenProfile(orgId, name) {
    document.getElementById('dynamicOrgModal')?.querySelector('.btn-close')?.click();
    setTimeout(() => this.openCompanyProfile(orgId, name), 300);
  },

  /** Helper for data-action: complete follow-up and refresh tasks view */
  completeFollowUpAndRefresh(orgId, followUpId) {
    this.completeFollowUp(orgId, followUpId);
    setTimeout(() => this.showMyTasks(), 500);
  },

  /** Helper for data-action: toggle tag filter and refresh modal */
  toggleTagFilterAndRefresh(tag) {
    this.toggleTagFilter(tag);
    document.getElementById('dynamicOrgModal')?.querySelector('.btn-close')?.click();
    setTimeout(() => this.showTagFilterModal(), 200);
  },

  /** Helper for data-action: clear all tag filters */
  clearAllTagFilters() {
    this._selectedTagFilters = [];
    this.filterOrganisations();
    document.getElementById('dynamicOrgModal')?.querySelector('.btn-close')?.click();
  },

  /** Helper for data-action: merge duplicate group */
  mergeDuplicateGroup(ids) {
    if (Array.isArray(ids)) {
      this.selectedOrgs = new Set(ids);
    }
    this.showMergeDuplicatesModal();
    bootstrap.Modal.getInstance(document.getElementById('dynamicOrgModal'))?.hide();
  },

  /** Helper for data-action: apply Companies House data from element dataset */
  _applyCompaniesHouseDataFromEl(orgId, _extraArgs, event) {
    const el = event?.target?.closest('[data-action]') || event?.target;
    if (el) {
      this._applyCompaniesHouseData(orgId, {
        address: el.dataset.chAddress,
        company_number: el.dataset.chNumber,
      });
    }
  },

  /** Helper for data-action: cancel inline edit (receives orgId from data-id) */
  openAddOrgModal() {
    const el = document.getElementById('addNewOrgModal');
    if (el) new bootstrap.Modal(el).show();
  },

  cancelInlineEdit(elOrId, orgIdOrEvent) {
    // Support both old signature (el, orgId) and new delegation signature (orgId, event)
    if (typeof elOrId === 'string' && (orgIdOrEvent instanceof Event || orgIdOrEvent === undefined)) {
      // Called via data-action: elOrId is the orgId from data-id
      const td =
        document.querySelector(`[data-original-html]`) || document.querySelector('.input-group')?.closest('td');
      if (td && td.dataset.originalHtml) {
        td.innerHTML = td.dataset.originalHtml;
      }
      return;
    }
    // Legacy call with (element, orgId)
    const td = elOrId?.closest?.('td');
    if (td && td.dataset.originalHtml) {
      td.innerHTML = td.dataset.originalHtml;
    }
  },
};

// Export to window for global access
ModuleRegistry.register('orgsModule', orgsModule);

export { orgsModule };

/* ==================================================== */
/* LOCATION MODULE — Country / Region / Area helpers    */
/* ==================================================== */

const locationModule = {
  _cachedAreas: null,
  _cachedRegions: null,
  _loadPromise: null,
  _loadRegionsPromise: null,

  /**
   * Fetch all active regions from the regions table (cached after first call).
   * @returns {Promise<Array>}
   */
  async loadRegions() {
    if (this._cachedRegions) return this._cachedRegions;
    if (this._loadRegionsPromise) return this._loadRegionsPromise;

    this._loadRegionsPromise = (async () => {
      try {
        const { data } = await apiClient.select('regions', {
          select: 'id, display_name, country, sort_order',
          filters: { is_active: true },
          sort: { column: 'sort_order', ascending: true },
          pageSize: 100,
        });
        this._cachedRegions = data || [];
      } catch (e) {
        console.warn('locationModule: could not load regions:', e.message);
        this._cachedRegions = [];
      } finally {
        this._loadRegionsPromise = null;
      }
      return this._cachedRegions;
    })();

    return this._loadRegionsPromise;
  },

  /**
   * Fetch all active areas from the areas table (cached after first call).
   * Automatically loads regions too so each area object includes _regionName.
   * @returns {Promise<Array>}
   */
  async loadAreas() {
    if (this._cachedAreas) return this._cachedAreas;
    if (this._loadPromise) return this._loadPromise;

    this._loadPromise = (async () => {
      try {
        await this.loadRegions();
        const regionMap = {};
        (this._cachedRegions || []).forEach((r) => {
          regionMap[r.id] = r;
        });

        const { data } = await apiClient.select('areas', {
          select: 'id, display_name, country, area_type, is_small, sort_order, region_id',
          filters: { is_active: true },
          sort: { column: 'sort_order', ascending: true },
          pageSize: 500,
        });
        this._cachedAreas = (data || []).map((a) => ({
          ...a,
          _region: regionMap[a.region_id] || null,
          _regionName: regionMap[a.region_id]?.display_name || '',
        }));
      } catch (e) {
        console.warn('locationModule: could not load areas:', e.message);
        this._cachedAreas = [];
      } finally {
        this._loadPromise = null;
      }
      return this._cachedAreas;
    })();

    return this._loadPromise;
  },

  /**
   * Look up a single area record by UUID.
   * @param {string} id
   * @returns {Object|null}
   */
  getAreaById(id) {
    if (!id || !this._cachedAreas) return null;
    return this._cachedAreas.find((a) => a.id === id) || null;
  },

  /**
   * Return the display name for an area UUID (empty string if not found).
   * @param {string} id
   * @returns {string}
   */
  getAreaName(id) {
    return this.getAreaById(id)?.display_name || '';
  },

  /**
   * Return the region name for an area UUID.
   * @param {string} id
   * @returns {string}
   */
  getRegionName(id) {
    return this.getAreaById(id)?._regionName || '';
  },

  /**
   * Return whether an area is "small" (uses compact category list).
   * @param {string} id
   * @returns {boolean}
   */
  isSmall(id) {
    return this.getAreaById(id)?.is_small ?? false;
  },

  /**
   * Return a SMALL/LARGE badge HTML string for an area.
   * @param {string} id
   * @returns {string}
   */
  sizeBadgeHtml(id) {
    const area = this.getAreaById(id);
    if (!area) return '';
    return area.is_small
      ? '<span class="badge bg-warning text-dark ms-1" style="font-size:0.6rem;line-height:1.2;">SMALL</span>'
      : '<span class="badge bg-primary-subtle text-primary ms-1" style="font-size:0.6rem;line-height:1.2;">LARGE</span>';
  },

  /**
   * Populate a country <select> with England / Scotland / Wales options.
   * Preserves the currently selected value.
   * @param {string} selectId
   * @param {string} [allLabel]
   */
  populateCountryDropdown(selectId, allLabel = 'All Countries') {
    const el = document.getElementById(selectId);
    if (!el) return;
    const current = el.value;
    el.innerHTML =
      `<option value="">${utils.escapeHtml(allLabel)}</option>` +
      ['England', 'Northern Ireland', 'Scotland', 'Wales']
        .map((c) => `<option value="${c}"${current === c ? ' selected' : ''}>${c}</option>`)
        .join('');
  },

  /**
   * Populate an area <select> filtered by country, grouped by region via <optgroup>.
   * Preserves selected area UUID if still in the filtered list.
   * @param {string} selectId
   * @param {string} [country]    - Filter by country; '' means all
   * @param {string} [allLabel]
   * @param {string} [selectedId] - UUID to pre-select (falls back to current el.value)
   * @param {string} [regionId]   - When set, only show areas in this region (no optgroups)
   */
  populateAreaDropdown(selectId, country = '', allLabel = 'All Areas', selectedId = '', regionId = '') {
    const el = document.getElementById(selectId);
    if (!el) return;
    const pick = selectedId || el.value;
    let areas = (this._cachedAreas || []).filter((a) => !country || a.country === country);

    if (regionId) {
      areas = areas.filter((a) => a.region_id === regionId);
      const makeOption = (a) =>
        `<option value="${a.id}"${pick === a.id ? ' selected' : ''}>${utils.escapeHtml(a.display_name)}</option>`;
      el.innerHTML = `<option value="">${utils.escapeHtml(allLabel)}</option>` + areas.map(makeOption).join('');
      return;
    }

    // Group by region for <optgroup> rendering
    const grouped = {};
    const ungrouped = [];
    areas.forEach((a) => {
      if (a._regionName) {
        if (!grouped[a._regionName]) grouped[a._regionName] = [];
        grouped[a._regionName].push(a);
      } else {
        ungrouped.push(a);
      }
    });

    const makeOption = (a) =>
      `<option value="${a.id}"${pick === a.id ? ' selected' : ''}>${utils.escapeHtml(a.display_name)}</option>`;

    let html = `<option value="">${utils.escapeHtml(allLabel)}</option>`;

    if (Object.keys(grouped).length > 0) {
      Object.entries(grouped).forEach(([regionName, regionAreas]) => {
        html += `<optgroup label="${utils.escapeHtml(regionName)}">`;
        html += regionAreas.map(makeOption).join('');
        html += '</optgroup>';
      });
      if (ungrouped.length) html += ungrouped.map(makeOption).join('');
    } else {
      html += areas.map(makeOption).join('');
    }

    el.innerHTML = html;
  },

  /**
   * Populate a region <select> filtered by country.
   * @param {string} selectId
   * @param {string} [country]    - Filter by country; '' means all
   * @param {string} [allLabel]
   * @param {string} [selectedId] - UUID to pre-select
   */
  populateRegionDropdown(selectId, country = '', allLabel = 'All Regions', selectedId = '') {
    const el = document.getElementById(selectId);
    if (!el) return;
    const pick = selectedId || el.value;
    const regions = (this._cachedRegions || []).filter((r) => !country || r.country === country);
    el.innerHTML =
      `<option value="">${utils.escapeHtml(allLabel)}</option>` +
      regions
        .map(
          (r) =>
            `<option value="${r.id}"${pick === r.id ? ' selected' : ''}>${utils.escapeHtml(r.display_name)}</option>`
        )
        .join('');
  },
};

window.locationModule = locationModule;

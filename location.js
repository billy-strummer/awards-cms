/* ==================================================== */
/* LOCATION MODULE — shared country / area helpers      */
/* ==================================================== */

const locationModule = {
  _cachedAreas: null,
  _loadPromise: null,

  /**
   * Fetch all active areas from the areas table (cached after first call).
   * @returns {Promise<Array>}
   */
  async loadAreas() {
    if (this._cachedAreas) return this._cachedAreas;
    if (this._loadPromise) return this._loadPromise;

    this._loadPromise = (async () => {
      try {
        const { data } = await apiClient.select('areas', {
          select: 'id, display_name, country, area_type, is_small, sort_order',
          filters: { is_active: true },
          sort: { column: 'sort_order', ascending: true },
          pageSize: 500,
        });
        this._cachedAreas = data || [];
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
      ['England', 'Scotland', 'Wales']
        .map((c) => `<option value="${c}"${current === c ? ' selected' : ''}>${c}</option>`)
        .join('');
  },

  /**
   * Populate an area <select> filtered by country.
   * Preserves selected area UUID if it is still in the filtered list.
   * @param {string} selectId
   * @param {string} [country]     - Filter by country, '' means all
   * @param {string} [allLabel]
   * @param {string} [selectedId]  - UUID to pre-select (falls back to current el.value)
   */
  populateAreaDropdown(selectId, country = '', allLabel = 'All Areas', selectedId = '') {
    const el = document.getElementById(selectId);
    if (!el) return;
    const pick = selectedId || el.value;
    const areas = (this._cachedAreas || []).filter((a) => !country || a.country === country);
    el.innerHTML =
      `<option value="">${utils.escapeHtml(allLabel)}</option>` +
      areas
        .map(
          (a) =>
            `<option value="${a.id}"${pick === a.id ? ' selected' : ''}>${utils.escapeHtml(a.display_name)}</option>`
        )
        .join('');
  },
};

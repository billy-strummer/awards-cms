/* ==================================================== */
/* GLOBAL SEASON SWITCHER MODULE */
/* ==================================================== */
/**
 * @module seasonSwitcherModule
 * @description A single, persistent "Season" selector in the top admin
 * header bar. Broadcasts a `bta:season-change` DOM event whenever the
 * selection changes so any tab can sync its own per-tab year filter —
 * app.js owns the actual per-tab wiring (consistent with how every other
 * cross-tab filter listener in this app is centralised there).
 */

const SEASON_STORAGE_KEY = 'btaGlobalSeason';
const SEASON_CHANGE_EVENT = 'bta:season-change';
const SELECT_ID = 'globalSeasonSwitcher';

const seasonSwitcherModule = {
  _years: null,
  _listenerAttached: false,

  /**
   * The current global season, or '' for "All Seasons".
   * @returns {string}
   */
  getSeason() {
    try {
      return localStorage.getItem(SEASON_STORAGE_KEY) || '';
    } catch (_e) {
      return '';
    }
  },

  /**
   * A sensible year range to offer when `award_years` has no rows yet
   * (e.g. a freshly-provisioned database) — mirrors Award Areas' own
   * fallback range (current year ± a couple) rather than leaving the
   * switcher with nothing but "All Seasons" to offer.
   * @returns {number[]} Years, newest first.
   */
  _fallbackYears() {
    const current = new Date().getFullYear();
    return [current + 1, current, current - 1];
  },

  /**
   * Load distinct award years from the database, falling back to a
   * generated range if the table is empty or the query fails.
   * @returns {Promise<number[]>} Years, newest first. Cached after first call.
   */
  async _loadYears() {
    if (this._years) return this._years;
    try {
      const data = await apiClient.selectAll('award_years', { select: 'year' });
      const years = [...new Set((data || []).map((row) => row.year).filter(Boolean))].sort((a, b) => b - a);
      this._years = years.length > 0 ? years : this._fallbackYears();
    } catch (error) {
      console.warn('Could not load seasons from the database, using a fallback range:', error.message);
      this._years = this._fallbackYears();
    }
    return this._years;
  },

  /**
   * Persist the season to localStorage. Swallows storage errors (private
   * browsing, quota) — the switcher still works for the current page load,
   * it just won't be remembered next time.
   * @param {string} value
   */
  _persist(value) {
    try {
      localStorage.setItem(SEASON_STORAGE_KEY, value);
    } catch (_e) {
      /* ignore */
    }
  },

  /**
   * Set the global season: updates the dropdown, persists it, and
   * broadcasts the change event for every tab to react to.
   * @param {string} value - A year as a string, or '' for "All Seasons".
   */
  setSeason(value) {
    const select = document.getElementById(SELECT_ID);
    if (select) select.value = value;
    this._persist(value);
    document.dispatchEvent(new CustomEvent(SEASON_CHANGE_EVENT, { detail: { season: value } }));
  },

  /**
   * Populate the header dropdown, restore (or default) the saved season,
   * and wire its change listener. Call once during app startup.
   * @returns {Promise<void>}
   */
  async init() {
    const select = document.getElementById(SELECT_ID);
    if (!select) return;

    const years = await this._loadYears();
    select.innerHTML =
      '<option value="">All Seasons</option>' +
      years.map((year) => `<option value="${year}">${year}</option>`).join('');

    const saved = this.getSeason();
    if (saved && years.includes(Number(saved))) {
      select.value = saved;
    } else {
      // No valid saved season yet — default to the latest one, not "All
      // Seasons", so the switcher starts on the season admins care about.
      const latest = String(Math.max(...years));
      select.value = latest;
      this._persist(latest);
    }

    // Guard against attaching a duplicate listener if init() is ever called
    // more than once (e.g. a future re-initialization flow) — each extra
    // listener would otherwise fire an extra, redundant broadcast per change.
    if (!this._listenerAttached) {
      this._listenerAttached = true;
      select.addEventListener('change', () => {
        this.setSeason(select.value);
      });
    }
  },

  /**
   * Re-fetch the available seasons and rebuild the dropdown — used after
   * something creates `award_years` rows for a season that wasn't in the
   * cached list yet (e.g. the Season Rollover Wizard), so it becomes
   * selectable without a full page reload. Optionally also switches to a
   * given season once it's confirmed to exist, broadcasting the usual
   * change event so every tab syncs to it.
   * @param {string|number} [selectSeason] - A season to switch to after refreshing, if it exists.
   * @returns {Promise<void>}
   */
  async refresh(selectSeason) {
    const select = document.getElementById(SELECT_ID);
    if (!select) return;

    const previous = select.value;
    this._years = null;
    const years = await this._loadYears();
    select.innerHTML =
      '<option value="">All Seasons</option>' +
      years.map((year) => `<option value="${year}">${year}</option>`).join('');

    if (selectSeason != null && years.includes(Number(selectSeason))) {
      this.setSeason(String(selectSeason));
    } else if (previous && years.includes(Number(previous))) {
      select.value = previous;
    } else {
      select.value = '';
    }
  },
};

ModuleRegistry.register('seasonSwitcherModule', seasonSwitcherModule);

export { seasonSwitcherModule, SEASON_CHANGE_EVENT, SEASON_STORAGE_KEY };

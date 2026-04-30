/* ==================================================== */
/* AREAS MANAGER — Settings > Manage Areas              */
/* ==================================================== */

const areasManager = {
  /**
   * Load and render all areas in the Manage Areas settings panel.
   */
  async loadAreas() {
    const container = document.getElementById('manageAreasContainer');
    if (!container) return;

    container.innerHTML =
      '<div class="text-center py-3"><div class="spinner-border spinner-border-sm text-primary" role="status"><span class="visually-hidden">Loading...</span></div></div>';

    try {
      const areas = await locationModule.loadAreas();

      if (!areas.length) {
        container.innerHTML =
          '<p class="text-muted small">No areas configured. Run the areas seed SQL to populate this table.</p>';
        return;
      }

      const byCountry = { England: [], Scotland: [], Wales: [] };
      areas.forEach((a) => {
        if (byCountry[a.country]) byCountry[a.country].push(a);
      });

      const renderSection = (country, list) => {
        if (!list.length) return '';
        const rows = list
          .map(
            (a) => `
          <tr>
            <td>${utils.escapeHtml(a.display_name)}</td>
            <td><span class="badge bg-secondary-subtle text-secondary">${utils.escapeHtml(a.area_type || 'area')}</span></td>
            <td>${
              a.is_small
                ? '<span class="badge bg-warning text-dark">SMALL</span>'
                : '<span class="badge bg-primary-subtle text-primary">LARGE</span>'
            }</td>
            <td class="text-center text-muted small">${a.sort_order ?? '-'}</td>
          </tr>`
          )
          .join('');
        return `
        <div class="mb-3">
          <h6 class="text-muted fw-semibold mb-2">${utils.escapeHtml(country)} <span class="badge bg-secondary ms-1">${list.length}</span></h6>
          <div class="table-responsive">
            <table class="table table-sm table-bordered align-middle mb-0">
              <thead class="table-light">
                <tr>
                  <th>Area</th><th>Type</th><th>Size</th><th style="width:60px;">Order</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>`;
      };

      container.innerHTML =
        renderSection('England', byCountry.England) +
        renderSection('Scotland', byCountry.Scotland) +
        renderSection('Wales', byCountry.Wales);
    } catch (e) {
      container.innerHTML = `<div class="alert alert-warning small">Could not load areas: ${utils.escapeHtml(e.message)}</div>`;
    }
  },
};

window.areasManager = areasManager;

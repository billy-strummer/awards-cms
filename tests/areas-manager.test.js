/**
 * Tests for areas-manager.js's loadAreas() rendering -- specifically that
 * it no longer groups or renders a Northern Ireland section (BTA-070:
 * permanently excluded from British Trade Awards' geographic coverage,
 * see CLAUDE.md and BTA-CMS-PROJECT-TASKS.md Decision register item 23).
 */

const { JSDOM } = require('jsdom');

function buildDom() {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="manageAreasContainer"></div></body></html>', {
    url: 'http://localhost',
  });
  global.window = dom.window;
  global.document = dom.window.document;
  return dom;
}

describe('areas-manager.js - loadAreas', () => {
  beforeEach(() => {
    jest.resetModules();
    buildDom();
    global.utils = { escapeHtml: (s) => String(s || '') };
    global.window.utils = global.utils;
    global.locationModule = {
      loadAreas: jest.fn().mockResolvedValue([
        { id: 'a1', display_name: 'Kent', country: 'England', area_type: 'county' },
        { id: 'a2', display_name: 'Highlands', country: 'Scotland', area_type: 'region' },
        { id: 'a3', display_name: 'Glamorgan', country: 'Wales', area_type: 'county', region_id: 'r1' },
      ]),
      loadRegions: jest.fn().mockResolvedValue([]),
      _cachedAreas: null,
      populateRegionDropdown: jest.fn((selectId, country, allLabel, selectedId) => {
        const el = document.getElementById(selectId);
        if (el) el.innerHTML = `<option value="">${allLabel}</option>`;
      }),
    };
    global.window.locationModule = global.locationModule;
    require('../areas-manager.js');
  });

  test('renders England/Scotland/Wales sections only, no Northern Ireland', async () => {
    await window.areasManager.loadAreas();
    const html = document.getElementById('manageAreasContainer').innerHTML;
    expect(html).toContain('England');
    expect(html).toContain('Scotland');
    expect(html).toContain('Wales');
    expect(html).not.toContain('Northern Ireland');
  });

  test('openEditModal pre-fills country/region and saveEdit persists them (BTA-070)', async () => {
    global.locationModule._cachedAreas = [
      { id: 'a3', display_name: 'Glamorgan', country: 'Wales', area_type: 'county', region_id: 'r1', sort_order: 0 },
    ];
    global.apiClient = { update: jest.fn().mockResolvedValue({}) };
    global.window.apiClient = global.apiClient;
    global.bootstrap = {
      Modal: { getOrCreateInstance: () => ({ show() {}, hide() {} }), getInstance: () => ({ hide() {} }) },
    };
    global.window.bootstrap = global.bootstrap;
    global.utils.showToast = jest.fn();
    document.body.innerHTML += `
      <div class="modal fade" id="areasEditModal"></div>
      <input id="areasEditId"><input id="areasEditName">
      <select id="areasEditType"><option value="county">county</option></select>
      <select id="areasEditSize"><option value="false">false</option><option value="true">true</option></select>
      <input id="areasEditOrder" value="0">
      <select id="areasEditCountry">
        <option value="England">England</option>
        <option value="Scotland">Scotland</option>
        <option value="Wales">Wales</option>
      </select>
      <select id="areasEditRegion"><option value="">No region</option></select>
      <button id="areasEditSaveBtn"></button>`;

    await window.areasManager.openEditModal('a3');

    expect(document.getElementById('areasEditCountry').value).toBe('Wales');
    expect(global.locationModule.populateRegionDropdown).toHaveBeenCalledWith(
      'areasEditRegion',
      'Wales',
      'No region',
      'r1'
    );

    document.getElementById('areasEditCountry').value = 'Scotland';
    await window.areasManager.saveEdit();

    expect(global.apiClient.update).toHaveBeenCalledWith(
      'areas',
      'a3',
      expect.objectContaining({ country: 'Scotland' })
    );
  });

  test('CSV import help text for regions does not mention Northern Ireland', () => {
    global.bootstrap = { Modal: { getOrCreateInstance: () => ({ show() {} }) } };
    global.window.bootstrap = global.bootstrap;
    document.body.innerHTML += `
      <div class="modal fade" id="areasImportModal"></div>
      <h5 id="areasImportModalTitle"></h5>
      <div id="areasImportFormat"></div>
      <div id="areasImportPreview"></div>
      <button id="areasImportConfirmBtn"></button>
      <div id="areasImportErrors"></div>
      <input id="areasImportFileVisible">`;
    window.areasManager.openImportModal('regions');
    const helpText = document.getElementById('areasImportFormat').innerHTML;
    expect(helpText).toContain('England / Scotland / Wales');
    expect(helpText).not.toContain('Northern Ireland');
  });
});

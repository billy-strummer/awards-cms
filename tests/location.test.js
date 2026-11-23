/**
 * Tests for location.js's populateCountryDropdown() -- specifically that
 * it offers only England/Scotland/Wales (BTA-070: Northern Ireland is
 * permanently excluded from British Trade Awards' geographic coverage,
 * see CLAUDE.md and BTA-CMS-PROJECT-TASKS.md Decision register item 23).
 */

const { JSDOM } = require('jsdom');

function buildDom() {
  const dom = new JSDOM(`<!DOCTYPE html><html><body><select id="countryFilter"></select></body></html>`, {
    url: 'http://localhost',
  });
  global.window = dom.window;
  global.document = dom.window.document;
  return dom;
}

describe('location.js - populateCountryDropdown', () => {
  beforeEach(() => {
    jest.resetModules();
    buildDom();
    global.utils = { escapeHtml: (s) => String(s || '') };
    global.window.utils = global.utils;
    global.apiClient = {};
    global.window.apiClient = global.apiClient;
    require('../location.js');
  });

  test('offers exactly England, Scotland and Wales', () => {
    window.locationModule.populateCountryDropdown('countryFilter');
    const options = Array.from(document.getElementById('countryFilter').options).map((o) => o.value);
    expect(options).toEqual(['', 'England', 'Scotland', 'Wales']);
  });

  test('does not offer Northern Ireland', () => {
    window.locationModule.populateCountryDropdown('countryFilter');
    const options = Array.from(document.getElementById('countryFilter').options).map((o) => o.value);
    expect(options).not.toContain('Northern Ireland');
  });

  test('preserves the currently-selected value', () => {
    const select = document.getElementById('countryFilter');
    window.locationModule.populateCountryDropdown('countryFilter');
    select.value = 'Wales';
    window.locationModule.populateCountryDropdown('countryFilter');
    expect(select.value).toBe('Wales');
  });
});

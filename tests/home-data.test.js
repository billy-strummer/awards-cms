/**
 * Tests for home-data.js's window.REGION_DATA -- specifically that
 * Northern Ireland has been removed (BTA-070: permanently excluded from
 * British Trade Awards' geographic coverage, see CLAUDE.md and
 * BTA-CMS-PROJECT-TASKS.md Decision register item 23), and that the
 * remaining England/Scotland/Wales data is untouched.
 */

const { JSDOM } = require('jsdom');

function buildDom() {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost' });
  global.window = dom.window;
  global.document = dom.window.document;
  return dom;
}

describe('home-data.js - window.REGION_DATA', () => {
  beforeEach(() => {
    jest.resetModules();
    buildDom();
    require('../home-data.js');
  });

  test('does not define a northern-ireland branch', () => {
    expect(window.REGION_DATA['northern-ireland']).toBeUndefined();
  });

  test('still defines england, scotland and wales with their county/city data', () => {
    expect(window.REGION_DATA.england).toBeDefined();
    expect(window.REGION_DATA.england.Counties).toContain('Kent');
    expect(window.REGION_DATA.scotland).toBeDefined();
    expect(window.REGION_DATA.wales).toBeDefined();
    expect(window.REGION_DATA.wales['Counties & Areas']).toContain('Glamorgan');
  });

  test('exposes exactly 3 country keys', () => {
    expect(Object.keys(window.REGION_DATA).sort()).toEqual(['england', 'scotland', 'wales']);
  });

  test('the flag/image map contains no Northern Ireland place names', () => {
    const flagMap = window.BTA_HOME_DATA.flagMap;
    const niPlaceNames = ['Belfast City Centre', 'Antrim', 'Enniskillen', 'Armagh', 'Derry / Londonderry'];
    niPlaceNames.forEach((name) => {
      expect(Object.prototype.hasOwnProperty.call(flagMap, name)).toBe(false);
    });
  });
});

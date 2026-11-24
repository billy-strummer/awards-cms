/**
 * Bundle-wiring regression tests for region-hub.js (Roadmap 3.2 cleanup).
 *
 * region-hub.js was introduced in task 1.2 and extended in 2.2/2.3/3.1, but
 * was never actually imported by main.js (the real esbuild ESM entry point
 * the production build uses) or any lazy chunk -- confirmed by direct
 * inspection of dist/app.min.js and git history before this fix. Every
 * existing region-hub.js test (tests/region-hub.test.js) require()s the
 * file directly, bypassing the build entirely, so that gap was invisible
 * to every passing Jest run. These tests guard against it recurring.
 *
 * Run with: npx jest tests/main-bundle-wiring.test.js
 */

const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');
const { JSDOM } = require('jsdom');

describe('main.js — region-hub.js wiring (static)', () => {
  test('main.js imports/exports regionHubModule from region-hub.js', () => {
    const mainSrc = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
    expect(mainSrc).toMatch(/from\s+['"]\.\/region-hub\.js['"]/);
    expect(mainSrc).toMatch(/regionHubModule/);
  });
});

describe('main.js — region-hub.js wiring (real esbuild bundle)', () => {
  let bundleCode;

  beforeAll(async () => {
    // Bundle the real ESM entry point exactly as build.js does for the
    // production core bundle (bundle + minify), so this test fails the
    // same way a real production build would if the wiring regresses.
    const result = await esbuild.build({
      entryPoints: [path.join(__dirname, '..', 'main.js')],
      bundle: true,
      minify: true,
      target: 'es2020',
      format: 'esm',
      write: false,
      drop: ['debugger'],
    });
    bundleCode = result.outputFiles[0].text;
  }, 30000);

  test('region-hub.js function bodies are present in the built bundle', () => {
    // These are private implementation symbols from region-hub.js's own
    // function bodies (not exported object property names, which esbuild's
    // minifier leaves alone regardless of bundling -- these would only
    // survive minification if the module's actual code, not just a
    // "regionHubModule.xxx" string elsewhere, made it into the bundle).
    expect(bundleCode).toContain('openSponsorPicker');
    expect(bundleCode).toContain('saveSponsorAssignment');
    expect(bundleCode).toContain('_deriveLifecycleStage');
  });

  test('is not satisfied merely by the data-action string in nominee-uploads.js', () => {
    // Regression guard for the exact false-positive that let this bug go
    // unnoticed: nominee-uploads.js's row template contains the literal
    // string "regionHubModule.open" as a data-action attribute, which
    // matches a naive grep even when region-hub.js's own module code is
    // completely absent from the bundle. Assert on a symbol that only
    // exists inside region-hub.js's source, never in any data-action
    // string anywhere else in the codebase.
    const regionHubSrc = fs.readFileSync(path.join(__dirname, '..', 'region-hub.js'), 'utf8');
    expect(regionHubSrc).toContain('_deriveLifecycleStage');
    expect(bundleCode).toContain('_deriveLifecycleStage');
  });
});

describe('Award Areas row click → regionHubModule.open() (runtime dispatch)', () => {
  let dom;

  beforeAll(() => {
    dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, { url: 'http://localhost' });
    global.window = dom.window;
    global.document = dom.window.document;
    global.localStorage = dom.window.localStorage;
    global.navigator = dom.window.navigator;
    global.HTMLElement = dom.window.HTMLElement;

    global.bootstrap = {
      Toast: class {
        show() {}
        hide() {}
      },
      Modal: class {
        show() {}
        hide() {}
        static getInstance() {
          return null;
        }
      },
      Tooltip: class {},
      Offcanvas: class {
        show() {}
        hide() {}
        static getInstance() {
          return null;
        }
      },
    };

    const mockSupabase = {
      from: jest.fn(() => mockSupabase),
      select: jest.fn(() => mockSupabase),
      insert: jest.fn(() => mockSupabase),
      update: jest.fn(() => mockSupabase),
      delete: jest.fn(() => mockSupabase),
      eq: jest.fn(() => mockSupabase),
      order: jest.fn(() => mockSupabase),
      range: jest.fn(() => mockSupabase),
      single: jest.fn(() => Promise.resolve({ data: null, error: null })),
      then: jest.fn((cb) => cb({ data: [], error: null })),
      auth: {
        getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
        signInWithPassword: jest.fn(),
        signOut: jest.fn(() => Promise.resolve({ error: null })),
      },
      channel: jest.fn(() => ({
        on: jest.fn(function () {
          return this;
        }),
        subscribe: jest.fn(function () {
          return this;
        }),
      })),
    };
    global.supabase = { createClient: () => mockSupabase };
    global.window.supabase = global.supabase;

    require('../config.js');
    global.STATE = global.window.STATE;
    global.SUPABASE_CONFIG = global.window.SUPABASE_CONFIG;
    global.STATUS = global.window.STATUS;
    global.MEDIA_TYPES = global.window.MEDIA_TYPES;
    global.INACTIVITY_TIMEOUT = global.window.INACTIVITY_TIMEOUT;
    global.YEARS = global.window.YEARS;
    global.SECTORS = global.window.SECTORS;
    global.REGIONS = global.window.REGIONS;
    global.STATE.client = mockSupabase;

    require('../utils.js');
    require('../region-hub.js'); // sets window.regionHubModule via ModuleRegistry.register, matching real main.js wiring
    for (const key of Object.keys(global.window)) {
      if (!(key in global) && typeof global.window[key] !== 'undefined') {
        global[key] = global.window[key];
      }
    }

    actionRegistry.init();
  });

  let openSpy;
  let el;

  afterEach(() => {
    if (openSpy) openSpy.mockRestore();
    if (el) el.remove();
    openSpy = null;
    el = null;
  });

  test("a real Award Areas row (nominee-uploads.js's exact data-action/data-args shape) dispatches to regionHubModule.open", () => {
    openSpy = jest.spyOn(regionHubModule, 'open').mockResolvedValue();

    // Exact template shape from nominee-uploads.js's area row.
    el = document.createElement('tr');
    el.className = 'u-pointer';
    el.setAttribute('data-action', 'regionHubModule.open');
    el.setAttribute('data-args', JSON.stringify(['area-kent-1', 'Kent', 'county', 'England']));
    document.body.appendChild(el);

    el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

    expect(openSpy).toHaveBeenCalledWith('area-kent-1', 'Kent', 'county', 'England', expect.anything());
  });

  test('the "Open Region Hub" button (same data-action, with stop-propagation) also dispatches correctly', () => {
    openSpy = jest.spyOn(regionHubModule, 'open').mockResolvedValue();

    el = document.createElement('button');
    el.className = 'btn btn-sm btn-outline-secondary';
    el.setAttribute('data-action', 'regionHubModule.open');
    el.setAttribute('data-args', JSON.stringify(['area-essex-2', 'Essex', 'county', 'England']));
    el.setAttribute('data-stop-propagation', 'true');
    document.body.appendChild(el);

    el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

    expect(openSpy).toHaveBeenCalledWith('area-essex-2', 'Essex', 'county', 'England', expect.anything());
  });
});

/**
 * Tests for the actionRegistry event delegation system
 * Run with: npx jest tests/event-delegation.test.js
 */

const { JSDOM } = require('jsdom');

const dom = new JSDOM(`<!DOCTYPE html><html><body>
  <div id="loadingBar" style="display:none;"></div>
  <div id="notificationToast"><span id="toastIcon"></span><span id="toastTitle"></span><span id="toastMessage"></span></div>
  <div id="testContainer"></div>
</body></html>`, { url: 'http://localhost' });

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;

global.bootstrap = {
  Toast: class { show() {} hide() {} },
  Modal: class { show() {} hide() {} static getInstance() { return { hide() {} }; } },
  Tooltip: class {}
};

const mockSupabase = {
  from: jest.fn(() => mockSupabase), select: jest.fn(() => mockSupabase),
  insert: jest.fn(() => mockSupabase), update: jest.fn(() => mockSupabase),
  delete: jest.fn(() => mockSupabase), eq: jest.fn(() => mockSupabase),
  order: jest.fn(() => mockSupabase), range: jest.fn(() => mockSupabase),
  single: jest.fn(() => Promise.resolve({ data: null, error: null })),
  then: jest.fn(cb => cb({ data: [], error: null })),
  auth: { getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })), signInWithPassword: jest.fn(), signOut: jest.fn(() => Promise.resolve({ error: null })) },
  channel: jest.fn(() => ({ on: jest.fn(function() { return this; }), subscribe: jest.fn(function() { return this; }) }))
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
for (const key of Object.keys(global.window)) {
  if (!(key in global) && typeof global.window[key] !== 'undefined') {
    global[key] = global.window[key];
  }
}

// ==========================================
// TESTS
// ==========================================

describe('actionRegistry', () => {
  beforeAll(() => {
    actionRegistry.init();
  });

  test('is defined and has init/register methods', () => {
    expect(actionRegistry).toBeDefined();
    expect(typeof actionRegistry.init).toBe('function');
    expect(typeof actionRegistry.register).toBe('function');
  });

  test('register stores handlers', () => {
    const handler = jest.fn();
    actionRegistry.register('test.action', handler);
    expect(actionRegistry._handlers['test.action']).toBe(handler);
  });

  test('_resolve finds registered handlers', () => {
    const handler = jest.fn();
    actionRegistry.register('my.handler', handler);
    expect(actionRegistry._resolve('my.handler')).toBe(handler);
  });

  test('_resolve returns null for unknown actions', () => {
    expect(actionRegistry._resolve('nonexistent.action.path')).toBeNull();
  });

  test('_resolve finds window globals via dotted path', () => {
    window.testModule = { doThing: jest.fn() };
    const resolved = actionRegistry._resolve('testModule.doThing');
    expect(resolved).toBeTruthy();
    delete window.testModule;
  });

  test('clicking data-action element triggers handler', () => {
    const handler = jest.fn();
    actionRegistry.register('click.test', handler);

    const btn = document.createElement('button');
    btn.setAttribute('data-action', 'click.test');
    document.getElementById('testContainer').appendChild(btn);

    btn.click();
    expect(handler).toHaveBeenCalled();

    btn.remove();
  });

  test('data-id is passed as first argument', () => {
    const handler = jest.fn();
    actionRegistry.register('id.test', handler);

    const btn = document.createElement('button');
    btn.setAttribute('data-action', 'id.test');
    btn.setAttribute('data-id', 'abc-123');
    document.getElementById('testContainer').appendChild(btn);

    btn.click();
    expect(handler).toHaveBeenCalledWith('abc-123', expect.any(Object));

    btn.remove();
  });

  test('data-prevent-default calls event.preventDefault', () => {
    const handler = jest.fn();
    actionRegistry.register('prevent.test', handler);

    const link = document.createElement('a');
    link.href = '#';
    link.setAttribute('data-action', 'prevent.test');
    link.setAttribute('data-prevent-default', 'true');
    document.getElementById('testContainer').appendChild(link);

    // Create and dispatch event to check preventDefault
    const event = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true });
    const preventSpy = jest.spyOn(event, 'preventDefault');
    link.dispatchEvent(event);

    expect(preventSpy).toHaveBeenCalled();
    expect(handler).toHaveBeenCalled();

    link.remove();
  });

  test('data-stop-propagation calls event.stopPropagation', () => {
    const handler = jest.fn();
    actionRegistry.register('stop.test', handler);

    const btn = document.createElement('button');
    btn.setAttribute('data-action', 'stop.test');
    btn.setAttribute('data-stop-propagation', 'true');
    document.getElementById('testContainer').appendChild(btn);

    const event = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true });
    const stopSpy = jest.spyOn(event, 'stopPropagation');
    btn.dispatchEvent(event);

    expect(stopSpy).toHaveBeenCalled();
    expect(handler).toHaveBeenCalled();

    btn.remove();
  });

  test('clicking child of data-action element triggers handler (bubbling)', () => {
    const handler = jest.fn();
    actionRegistry.register('bubble.test', handler);

    const btn = document.createElement('button');
    btn.setAttribute('data-action', 'bubble.test');
    const icon = document.createElement('i');
    icon.className = 'bi bi-plus';
    btn.appendChild(icon);
    document.getElementById('testContainer').appendChild(btn);

    icon.click();
    expect(handler).toHaveBeenCalled();

    btn.remove();
  });

  test('data-args JSON is parsed and passed', () => {
    const handler = jest.fn();
    actionRegistry.register('args.test', handler);

    const btn = document.createElement('button');
    btn.setAttribute('data-action', 'args.test');
    btn.setAttribute('data-args', '["hello", 42]');
    document.getElementById('testContainer').appendChild(btn);

    btn.click();
    expect(handler).toHaveBeenCalledWith('hello', 42, expect.any(Object));

    btn.remove();
  });
});

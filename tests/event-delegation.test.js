/**
 * Tests for the actionRegistry event delegation system
 * Run with: npx jest tests/event-delegation.test.js
 */

const { JSDOM } = require('jsdom');

const dom = new JSDOM(
  `<!DOCTYPE html><html><body>
  <div id="loadingBar" style="display:none;"></div>
  <div id="notificationToast"><span id="toastIcon"></span><span id="toastTitle"></span><span id="toastMessage"></span></div>
  <div id="testContainer"></div>
</body></html>`,
  { url: 'http://localhost' }
);

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
      return { hide() {} };
    }
  },
  Tooltip: class {},
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

  // --- Edge Cases ---

  test('data-args with object JSON wraps in array', () => {
    const handler = jest.fn();
    actionRegistry.register('objargs.test', handler);

    const btn = document.createElement('button');
    btn.setAttribute('data-action', 'objargs.test');
    btn.setAttribute('data-args', '{"key":"value"}');
    document.getElementById('testContainer').appendChild(btn);

    btn.click();
    expect(handler).toHaveBeenCalledWith({ key: 'value' }, expect.any(Object));

    btn.remove();
  });

  test('invalid data-args JSON warns and passes no extra args', () => {
    const handler = jest.fn();
    actionRegistry.register('badargs.test', handler);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const btn = document.createElement('button');
    btn.setAttribute('data-action', 'badargs.test');
    btn.setAttribute('data-args', '{not valid json}');
    document.getElementById('testContainer').appendChild(btn);

    btn.click();
    expect(handler).toHaveBeenCalledWith(expect.any(Object)); // just event
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[actionRegistry]'), expect.any(String));

    warnSpy.mockRestore();
    btn.remove();
  });

  test('data-id and data-args are combined correctly', () => {
    const handler = jest.fn();
    actionRegistry.register('combo.test', handler);

    const btn = document.createElement('button');
    btn.setAttribute('data-action', 'combo.test');
    btn.setAttribute('data-id', 'rec-456');
    btn.setAttribute('data-args', '["extra"]');
    document.getElementById('testContainer').appendChild(btn);

    btn.click();
    expect(handler).toHaveBeenCalledWith('rec-456', 'extra', expect.any(Object));

    btn.remove();
  });

  test('unknown action logs warning', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const btn = document.createElement('button');
    btn.setAttribute('data-action', 'totally.unknown.action');
    document.getElementById('testContainer').appendChild(btn);

    btn.click();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('No handler found'));

    warnSpy.mockRestore();
    btn.remove();
  });

  test('empty data-action attribute does not trigger handler', () => {
    const handler = jest.fn();
    actionRegistry.register('', handler);

    const btn = document.createElement('button');
    btn.setAttribute('data-action', '');
    document.getElementById('testContainer').appendChild(btn);

    btn.click();
    expect(handler).not.toHaveBeenCalled();

    btn.remove();
  });

  test('keydown Enter triggers click on non-button data-action element', () => {
    const handler = jest.fn();
    actionRegistry.register('key.test', handler);

    const div = document.createElement('div');
    div.setAttribute('data-action', 'key.test');
    div.setAttribute('tabindex', '0');
    document.getElementById('testContainer').appendChild(div);

    const event = new dom.window.KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    });
    div.dispatchEvent(event);
    expect(handler).toHaveBeenCalled();

    div.remove();
  });

  test('keydown Space triggers click on non-button data-action element', () => {
    const handler = jest.fn();
    actionRegistry.register('space.test', handler);

    const div = document.createElement('div');
    div.setAttribute('data-action', 'space.test');
    div.setAttribute('tabindex', '0');
    document.getElementById('testContainer').appendChild(div);

    const event = new dom.window.KeyboardEvent('keydown', {
      key: ' ',
      bubbles: true,
      cancelable: true,
    });
    div.dispatchEvent(event);
    expect(handler).toHaveBeenCalled();

    div.remove();
  });

  test('keydown on native button does NOT trigger extra click', () => {
    const handler = jest.fn();
    actionRegistry.register('nativekey.test', handler);

    const btn = document.createElement('button');
    btn.setAttribute('data-action', 'nativekey.test');
    document.getElementById('testContainer').appendChild(btn);

    // Dispatch keydown — this should be ignored by our handler (browser handles it)
    const event = new dom.window.KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    });
    btn.dispatchEvent(event);
    // The handler should NOT be called by our keydown listener
    // (it would only be called by the native button's click)
    expect(handler).not.toHaveBeenCalled();

    btn.remove();
  });
});

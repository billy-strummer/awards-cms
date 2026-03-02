/**
 * Tests for the Accessibility Module (accessibility.js)
 * Run with: npx jest tests/accessibility.test.js
 */

const { JSDOM } = require('jsdom');

// Setup minimal DOM before loading modules
const dom = new JSDOM(
  `<!DOCTYPE html><html><body>
  <div id="loadingBar" style="display:none;"></div>
  <div id="notificationToast"><span id="toastIcon"></span><span id="toastTitle"></span><span id="toastMessage"></span></div>
  <div id="connectionStatus"><span class="status-icon"></span><span class="status-text"></span></div>
  <div id="loginPage"></div>
  <div id="dashboardPage"></div>
  <div id="splashScreen"></div>
  <div id="userEmail"></div>
  <div id="loginEmail"></div>
  <div id="loginPassword"></div>
  <div id="loginError" class="d-none"></div>
  <div id="loginBtn"></div>
  <table><tbody id="awardsTableBody"></tbody></table>
  <table><tbody id="orgsTableBody"></tbody></table>
  <table><tbody id="winnersTableBody"></tbody></table>
  <table><tbody id="eventsTableBody"></tbody></table>
  <table><tbody id="entriesTableBody"></tbody></table>
  <span id="awardsCount"></span>
  <span id="eventsCount"></span>
  <span id="winnersCount"></span>
  <button id="iconOnlyBtn"><i class="bi bi-pencil"></i></button>
  <button id="deleteBtn" onclick="deleteSomething()"></button>
  <a id="linkBtn" onclick="doSomething()">Link</a>
  <div onclick="handleClick()" id="clickableDiv">Click me</div>
  <span onclick="handleSpanClick()" id="clickableSpan">Click span</span>
  <table id="testTable">
    <thead><tr><th>Col1</th><th>Col2</th></tr></thead>
    <tbody><tr><td>A</td><td>B</td></tr></tbody>
  </table>
  <div class="modal" id="testModal">
    <div class="modal-title">Test Modal Title</div>
  </div>
  <ul class="nav-tabs">
    <li><a class="nav-link" href="#">Tab1</a></li>
    <li><a class="nav-link" href="#">Tab2</a></li>
    <li><a class="nav-link" href="#">Tab3</a></li>
  </ul>
</body></html>`,
  { url: 'http://localhost' }
);

global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.setTimeout = dom.window.setTimeout;

// Mock bootstrap
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

// Mock supabase
const mockSupabase = {
  from: jest.fn(() => mockSupabase),
  select: jest.fn(() => mockSupabase),
  insert: jest.fn(() => mockSupabase),
  update: jest.fn(() => mockSupabase),
  delete: jest.fn(() => mockSupabase),
  eq: jest.fn(() => mockSupabase),
  order: jest.fn(() => mockSupabase),
  range: jest.fn(() => mockSupabase),
  limit: jest.fn(() => mockSupabase),
  single: jest.fn(() => Promise.resolve({ data: null, error: null })),
  rpc: jest.fn(() => Promise.resolve({ data: [], error: null })),
  then: jest.fn((cb) => cb({ data: [], error: null })),
  auth: {
    getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    signInWithPassword: jest.fn(() => Promise.resolve({ data: { user: { email: 'test@test.com' } }, error: null })),
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

// Load config
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

function syncWindowToGlobal() {
  for (const key of Object.keys(global.window)) {
    if (!(key in global) && typeof global.window[key] !== 'undefined') {
      global[key] = global.window[key];
    }
  }
}

require('../utils.js');
syncWindowToGlobal();

require('../accessibility.js');
syncWindowToGlobal();

// ==========================================
// TESTS
// ==========================================

describe('Accessibility Module - Exports and Structure', () => {
  test('a11yModule is defined and accessible', () => {
    expect(a11yModule).toBeDefined();
    expect(typeof a11yModule).toBe('object');
  });

  test('a11yModule has required methods', () => {
    expect(typeof a11yModule.init).toBe('function');
    expect(typeof a11yModule.addSkipLink).toBe('function');
    expect(typeof a11yModule.enhanceButtons).toBe('function');
    expect(typeof a11yModule.enhanceClickableElements).toBe('function');
    expect(typeof a11yModule.enhanceTables).toBe('function');
    expect(typeof a11yModule.enhanceModals).toBe('function');
    expect(typeof a11yModule.setupKeyboardNav).toBe('function');
    expect(typeof a11yModule.setupLiveRegion).toBe('function');
    expect(typeof a11yModule.announce).toBe('function');
    expect(typeof a11yModule.refresh).toBe('function');
    expect(typeof a11yModule.announceTableUpdate).toBe('function');
    expect(typeof a11yModule.announceNavigation).toBe('function');
    expect(typeof a11yModule.setupFocusManagement).toBe('function');
  });
});

describe('Accessibility Module - Skip Link', () => {
  test('addSkipLink creates a skip link element', () => {
    // Remove any existing skip link first
    const existing = document.getElementById('a11y-skip-link');
    if (existing) existing.remove();

    a11yModule.addSkipLink();
    const skipLink = document.getElementById('a11y-skip-link');
    expect(skipLink).not.toBeNull();
    expect(skipLink.textContent).toBe('Skip to main content');
    expect(skipLink.href).toContain('#dashboardPage');
  });

  test('addSkipLink does not create duplicate skip links', () => {
    a11yModule.addSkipLink();
    a11yModule.addSkipLink();
    const links = document.querySelectorAll('#a11y-skip-link');
    expect(links.length).toBe(1);
  });
});

describe('Accessibility Module - Icon Label Inference', () => {
  test('_inferLabelFromIcon returns correct labels for known icons', () => {
    expect(a11yModule._inferLabelFromIcon('bi bi-pencil')).toBe('Edit');
    expect(a11yModule._inferLabelFromIcon('bi bi-trash')).toBe('Delete');
    expect(a11yModule._inferLabelFromIcon('bi bi-eye')).toBe('View');
    expect(a11yModule._inferLabelFromIcon('bi bi-download')).toBe('Download');
    expect(a11yModule._inferLabelFromIcon('bi bi-upload')).toBe('Upload');
    expect(a11yModule._inferLabelFromIcon('bi bi-plus')).toBe('Add');
    expect(a11yModule._inferLabelFromIcon('bi bi-search')).toBe('Search');
    expect(a11yModule._inferLabelFromIcon('bi bi-gear')).toBe('Settings');
  });

  test('_inferLabelFromIcon returns null for unknown icons', () => {
    expect(a11yModule._inferLabelFromIcon('bi bi-unknown-icon')).toBeNull();
    expect(a11yModule._inferLabelFromIcon('')).toBeNull();
  });
});

describe('Accessibility Module - Enhance Buttons', () => {
  test('enhanceButtons adds aria-label to icon-only buttons', () => {
    const btn = document.getElementById('iconOnlyBtn');
    btn.removeAttribute('aria-label');
    a11yModule.enhanceButtons();
    expect(btn.getAttribute('aria-label')).toBe('Edit');
  });

  test('enhanceButtons adds role=button to anchors with onclick', () => {
    const link = document.getElementById('linkBtn');
    link.removeAttribute('role');
    a11yModule.enhanceButtons();
    expect(link.getAttribute('role')).toBe('button');
  });
});

describe('Accessibility Module - Enhance Clickable Elements', () => {
  test('enhanceClickableElements adds role and tabindex to divs with onclick', () => {
    const div = document.getElementById('clickableDiv');
    div.removeAttribute('role');
    div.removeAttribute('tabindex');
    a11yModule.enhanceClickableElements();
    expect(div.getAttribute('role')).toBe('button');
    expect(div.getAttribute('tabindex')).toBe('0');
  });

  test('enhanceClickableElements adds role and tabindex to spans with onclick', () => {
    const span = document.getElementById('clickableSpan');
    span.removeAttribute('role');
    span.removeAttribute('tabindex');
    a11yModule.enhanceClickableElements();
    expect(span.getAttribute('role')).toBe('button');
    expect(span.getAttribute('tabindex')).toBe('0');
  });
});

describe('Accessibility Module - Enhance Tables', () => {
  test('enhanceTables adds role=grid to tables', () => {
    const table = document.getElementById('testTable');
    table.removeAttribute('role');
    a11yModule.enhanceTables();
    expect(table.getAttribute('role')).toBe('grid');
  });

  test('enhanceTables adds scope=col to header cells', () => {
    a11yModule.enhanceTables();
    const ths = document.querySelectorAll('#testTable thead th');
    ths.forEach((th) => {
      expect(th.getAttribute('scope')).toBe('col');
    });
  });
});

describe('Accessibility Module - Enhance Modals', () => {
  test('enhanceModals adds aria-modal to modals', () => {
    const modal = document.getElementById('testModal');
    modal.removeAttribute('aria-modal');
    a11yModule.enhanceModals();
    expect(modal.getAttribute('aria-modal')).toBe('true');
  });

  test('enhanceModals adds aria-labelledby linking to modal title', () => {
    const modal = document.getElementById('testModal');
    modal.removeAttribute('aria-labelledby');
    a11yModule.enhanceModals();
    const ariaLabelledBy = modal.getAttribute('aria-labelledby');
    expect(ariaLabelledBy).toBeTruthy();
  });
});

describe('Accessibility Module - Live Region', () => {
  test('setupLiveRegion creates an ARIA live region', () => {
    const existing = document.getElementById('a11y-live-region');
    if (existing) existing.remove();

    a11yModule.setupLiveRegion();
    const region = document.getElementById('a11y-live-region');
    expect(region).not.toBeNull();
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.getAttribute('aria-atomic')).toBe('true');
  });

  test('setupLiveRegion does not create duplicate regions', () => {
    a11yModule.setupLiveRegion();
    a11yModule.setupLiveRegion();
    const regions = document.querySelectorAll('#a11y-live-region');
    expect(regions.length).toBe(1);
  });
});

describe('Accessibility Module - Announcements', () => {
  beforeEach(() => {
    a11yModule.setupLiveRegion();
  });

  test('announceTableUpdate generates correct load message', () => {
    jest.useFakeTimers();
    a11yModule.announceTableUpdate('load', 25, 'Awards');
    jest.advanceTimersByTime(150);
    const region = document.getElementById('a11y-live-region');
    expect(region.textContent).toBe('Awards: 25 records loaded');
    jest.useRealTimers();
  });

  test('announceTableUpdate generates correct filter message', () => {
    jest.useFakeTimers();
    a11yModule.announceTableUpdate('filter', 10, 'Organisations');
    jest.advanceTimersByTime(150);
    const region = document.getElementById('a11y-live-region');
    expect(region.textContent).toBe('Organisations: 10 records match current filters');
    jest.useRealTimers();
  });

  test('announceTableUpdate generates correct delete message', () => {
    jest.useFakeTimers();
    a11yModule.announceTableUpdate('delete', 24, 'Entries');
    jest.advanceTimersByTime(150);
    const region = document.getElementById('a11y-live-region');
    expect(region.textContent).toBe('Entries: Record deleted. 24 records remaining');
    jest.useRealTimers();
  });

  test('announceNavigation generates correct message', () => {
    jest.useFakeTimers();
    a11yModule.announceNavigation('Awards');
    jest.advanceTimersByTime(150);
    const region = document.getElementById('a11y-live-region');
    expect(region.textContent).toBe('Navigated to Awards');
    jest.useRealTimers();
  });

  test('announceTableUpdate handles unknown action with fallback', () => {
    jest.useFakeTimers();
    a11yModule.announceTableUpdate('unknown', 5, 'Test');
    jest.advanceTimersByTime(150);
    const region = document.getElementById('a11y-live-region');
    expect(region.textContent).toBe('Test: 5 records');
    jest.useRealTimers();
  });
});

describe('Accessibility Module - Keyboard Navigation', () => {
  test('setupKeyboardNav sets tablist role on nav-tabs', () => {
    a11yModule.setupKeyboardNav();
    const navTabs = document.querySelector('.nav-tabs');
    expect(navTabs.getAttribute('role')).toBe('tablist');
  });

  test('setupKeyboardNav sets tab role on nav-links', () => {
    a11yModule.setupKeyboardNav();
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach((link) => {
      expect(link.getAttribute('role')).toBe('tab');
    });
  });
});

describe('Accessibility Module - Clickable Element Keyboard Handling', () => {
  test('Enter key on clickable div triggers click', () => {
    const div = document.getElementById('clickableDiv');
    div.removeAttribute('role');
    div.removeAttribute('tabindex');
    div._a11yKeyHandler = false;
    a11yModule.enhanceClickableElements();

    const clickSpy = jest.fn();
    div.addEventListener('click', clickSpy);

    const event = new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    div.dispatchEvent(event);

    expect(clickSpy).toHaveBeenCalled();
    div.removeEventListener('click', clickSpy);
  });

  test('Space key on clickable span triggers click', () => {
    const span = document.getElementById('clickableSpan');
    span.removeAttribute('role');
    span.removeAttribute('tabindex');
    span._a11yKeyHandler = false;
    a11yModule.enhanceClickableElements();

    const clickSpy = jest.fn();
    span.addEventListener('click', clickSpy);

    const event = new dom.window.KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    span.dispatchEvent(event);

    expect(clickSpy).toHaveBeenCalled();
    span.removeEventListener('click', clickSpy);
  });

  test('non-Enter/Space key on clickable element does not trigger click', () => {
    const div = document.getElementById('clickableDiv');
    div.removeAttribute('role');
    div.removeAttribute('tabindex');
    div._a11yKeyHandler = false;
    a11yModule.enhanceClickableElements();

    const clickSpy = jest.fn();
    div.addEventListener('click', clickSpy);

    const event = new dom.window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    div.dispatchEvent(event);

    expect(clickSpy).not.toHaveBeenCalled();
    div.removeEventListener('click', clickSpy);
  });
});

describe('Accessibility Module - Tab Keyboard Navigation', () => {
  test('ArrowRight moves focus to next tab', () => {
    // Use fresh tab elements to avoid multiple keydown listeners stacking
    const container = document.createElement('ul');
    container.className = 'nav-tabs';
    container.innerHTML = '<li><button class="nav-link">A</button></li><li><button class="nav-link">B</button></li><li><button class="nav-link">C</button></li>';
    document.body.appendChild(container);

    const tabs = container.querySelectorAll('.nav-link');
    // Replace native focus/click with spies before setupKeyboardNav to avoid
    // JSDOM setTimeout recursion triggered by native .focus()/.click()
    const focusSpy = jest.fn();
    const clickSpy = jest.fn();
    tabs[1].focus = focusSpy;
    tabs[1].click = clickSpy;

    a11yModule.setupKeyboardNav();

    const event = new dom.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
    tabs[0].dispatchEvent(event);

    expect(focusSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    container.remove();
  });

  test('ArrowLeft wraps to last tab from first tab', () => {
    const container = document.createElement('ul');
    container.className = 'nav-tabs';
    container.innerHTML = '<li><button class="nav-link">A</button></li><li><button class="nav-link">B</button></li><li><button class="nav-link">C</button></li>';
    document.body.appendChild(container);

    const tabs = container.querySelectorAll('.nav-link');
    const focusSpy = jest.fn();
    const clickSpy = jest.fn();
    tabs[2].focus = focusSpy;
    tabs[2].click = clickSpy;

    a11yModule.setupKeyboardNav();

    const event = new dom.window.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true });
    tabs[0].dispatchEvent(event);

    expect(focusSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    container.remove();
  });

  test('Home key moves focus to first tab', () => {
    const container = document.createElement('ul');
    container.className = 'nav-tabs';
    container.innerHTML = '<li><button class="nav-link">A</button></li><li><button class="nav-link">B</button></li><li><button class="nav-link">C</button></li>';
    document.body.appendChild(container);

    const tabs = container.querySelectorAll('.nav-link');
    const focusSpy = jest.fn();
    const clickSpy = jest.fn();
    tabs[0].focus = focusSpy;
    tabs[0].click = clickSpy;

    a11yModule.setupKeyboardNav();

    const event = new dom.window.KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true });
    tabs[2].dispatchEvent(event);

    expect(focusSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    container.remove();
  });

  test('End key moves focus to last tab', () => {
    const container = document.createElement('ul');
    container.className = 'nav-tabs';
    container.innerHTML = '<li><button class="nav-link">A</button></li><li><button class="nav-link">B</button></li><li><button class="nav-link">C</button></li>';
    document.body.appendChild(container);

    const tabs = container.querySelectorAll('.nav-link');
    const focusSpy = jest.fn();
    const clickSpy = jest.fn();
    tabs[2].focus = focusSpy;
    tabs[2].click = clickSpy;

    a11yModule.setupKeyboardNav();

    const event = new dom.window.KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true });
    tabs[0].dispatchEvent(event);

    expect(focusSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    container.remove();
  });
});

describe('Accessibility Module - Focus Management (Modal Events)', () => {
  beforeEach(() => {
    a11yModule._focusMgmtInit = false;
  });

  test('show.bs.modal stores the active element as trigger', () => {
    a11yModule.setupFocusManagement();

    const triggerBtn = document.createElement('button');
    triggerBtn.id = 'modalTrigger';
    document.body.appendChild(triggerBtn);

    // Simulate focus by overriding document.activeElement to avoid JSDOM
    // setTimeout recursion triggered by native .focus() in this test environment
    const origDescriptor = Object.getOwnPropertyDescriptor(dom.window.Document.prototype, 'activeElement')
      || Object.getOwnPropertyDescriptor(Document.prototype, 'activeElement');
    Object.defineProperty(document, 'activeElement', { value: triggerBtn, configurable: true });

    const modal = document.getElementById('testModal');
    const event = new dom.window.Event('show.bs.modal', { bubbles: true });
    modal.dispatchEvent(event);

    expect(modal._a11yTrigger).toBe(triggerBtn);

    // Restore activeElement
    if (origDescriptor) {
      Object.defineProperty(document, 'activeElement', origDescriptor);
    } else {
      delete document.activeElement;
    }
    triggerBtn.remove();
  });

  test('hidden.bs.modal restores focus to trigger element', () => {
    jest.useFakeTimers();
    a11yModule.setupFocusManagement();

    const triggerBtn = document.createElement('button');
    triggerBtn.id = 'modalTriggerRestore';
    document.body.appendChild(triggerBtn);
    const focusSpy = jest.spyOn(triggerBtn, 'focus');

    const modal = document.getElementById('testModal');
    modal._a11yTrigger = triggerBtn;

    const event = new dom.window.Event('hidden.bs.modal', { bubbles: true });
    modal.dispatchEvent(event);

    jest.advanceTimersByTime(100);

    expect(focusSpy).toHaveBeenCalled();
    expect(modal._a11yTrigger).toBeNull();

    focusSpy.mockRestore();
    triggerBtn.remove();
    jest.useRealTimers();
  });

  test('hidden.bs.modal does not focus trigger if trigger removed from DOM', () => {
    jest.useFakeTimers();
    a11yModule.setupFocusManagement();

    const triggerBtn = document.createElement('button');
    document.body.appendChild(triggerBtn);
    const focusSpy = jest.spyOn(triggerBtn, 'focus');

    const modal = document.getElementById('testModal');
    modal._a11yTrigger = triggerBtn;

    // Remove trigger from DOM before hidden event
    triggerBtn.remove();

    const event = new dom.window.Event('hidden.bs.modal', { bubbles: true });
    modal.dispatchEvent(event);

    jest.advanceTimersByTime(100);

    expect(focusSpy).not.toHaveBeenCalled();
    expect(modal._a11yTrigger).toBeNull();

    focusSpy.mockRestore();
    jest.useRealTimers();
  });
});

describe('Accessibility Module - Refresh', () => {
  test('refresh does not throw', () => {
    expect(() => a11yModule.refresh()).not.toThrow();
  });

  test('init does not throw', () => {
    expect(() => a11yModule.init()).not.toThrow();
  });
});

describe('Accessibility Module - Branch Coverage', () => {
  test('enhanceButtons skips button with text content and multiple children', () => {
    // Button that has non-empty text and children.length !== 1 -> both conditions false
    const btn = document.createElement('button');
    btn.textContent = 'Save';
    document.body.appendChild(btn);
    a11yModule.enhanceButtons();
    expect(btn.getAttribute('aria-label')).toBeNull();
    btn.remove();
  });

  test('enhanceButtons handles icon-only button with unknown icon class (label is null)', () => {
    const btn = document.createElement('button');
    const icon = document.createElement('i');
    icon.className = 'bi bi-unknown-xyz';
    btn.appendChild(icon);
    document.body.appendChild(btn);
    a11yModule.enhanceButtons();
    // label is null so aria-label should not be set
    expect(btn.getAttribute('aria-label')).toBeNull();
    btn.remove();
  });

  test('enhanceButtons handles button with empty text (first branch true) but no icon', () => {
    const btn = document.createElement('button');
    btn.textContent = '   ';
    document.body.appendChild(btn);
    a11yModule.enhanceButtons();
    expect(btn.getAttribute('aria-label')).toBeNull();
    btn.remove();
  });

  test('enhanceClickableElements skips element that already has tabindex', () => {
    const div = document.createElement('div');
    div.setAttribute('onclick', 'doSomething()');
    div.setAttribute('tabindex', '5');
    document.body.appendChild(div);
    a11yModule.enhanceClickableElements();
    // tabindex should remain at 5, not be overwritten to 0
    expect(div.getAttribute('tabindex')).toBe('5');
    expect(div.getAttribute('role')).toBe('button');
    div.remove();
  });

  test('enhanceModals handles modal without a title element', () => {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'noTitleModal';
    // No .modal-title child
    document.body.appendChild(modal);
    a11yModule.enhanceModals();
    // aria-labelledby should NOT be set since there's no title
    expect(modal.getAttribute('aria-labelledby')).toBeNull();
    // aria-modal should still be set
    expect(modal.getAttribute('aria-modal')).toBe('true');
    modal.remove();
  });

  test('enhanceModals skips modal that already has aria-labelledby', () => {
    const modal = document.getElementById('testModal');
    modal.setAttribute('aria-labelledby', 'existing-id');
    a11yModule.enhanceModals();
    expect(modal.getAttribute('aria-labelledby')).toBe('existing-id');
  });

  test('setupKeyboardNav: unrecognized key does not trigger focus/click', () => {
    const container = document.createElement('ul');
    container.className = 'nav-tabs';
    container.innerHTML = '<li><button class="nav-link">A</button></li><li><button class="nav-link">B</button></li>';
    document.body.appendChild(container);

    const tabs = container.querySelectorAll('.nav-link');
    const focusSpy0 = jest.fn();
    const clickSpy0 = jest.fn();
    const focusSpy1 = jest.fn();
    const clickSpy1 = jest.fn();
    tabs[0].focus = focusSpy0;
    tabs[0].click = clickSpy0;
    tabs[1].focus = focusSpy1;
    tabs[1].click = clickSpy1;

    a11yModule.setupKeyboardNav();

    const event = new dom.window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    tabs[0].dispatchEvent(event);

    // Neither tab should have been focused/clicked
    expect(focusSpy0).not.toHaveBeenCalled();
    expect(clickSpy0).not.toHaveBeenCalled();
    expect(focusSpy1).not.toHaveBeenCalled();
    expect(clickSpy1).not.toHaveBeenCalled();
    container.remove();
  });

  test('announce does nothing when live region does not exist', () => {
    const region = document.getElementById('a11y-live-region');
    if (region) region.remove();
    // Should not throw
    expect(() => a11yModule.announce('Test message')).not.toThrow();
  });

  test('enhanceButtons adds aria-label to delete buttons with onclick', () => {
    const btn = document.getElementById('deleteBtn');
    btn.removeAttribute('aria-label');
    a11yModule.enhanceButtons();
    expect(btn.getAttribute('aria-label')).toBe('Delete');
  });

  test('enhanceModals uses existing title id when present', () => {
    const modal = document.getElementById('testModal');
    modal.removeAttribute('aria-labelledby');
    const title = modal.querySelector('.modal-title');
    title.id = 'my-custom-title-id';
    a11yModule.enhanceModals();
    expect(modal.getAttribute('aria-labelledby')).toBe('my-custom-title-id');
  });
});

/**
 * Type declarations for global variables loaded via script tags in index.html.
 * These are conditionally available (checked via typeof X !== 'undefined' guards).
 *
 * DOM interface augmentations cover vanilla-JS patterns where getElementById /
 * querySelector returns a base type (HTMLElement / Element / EventTarget) but the
 * code accesses properties that only live on specific sub-types (HTMLInputElement,
 * HTMLFormElement, HTMLCanvasElement, etc.).  Making them optional (?) is safe — it
 * tells TypeScript "this CAN exist" without lying about it always being present.
 */

// ── Core globals injected by config.js / app.js ──────────────────────────────
declare var STATE: any;
declare var apiClient: any;
declare var utils: any;
declare var bootstrap: any;
declare var supabase: any;
declare var SUPABASE_CONFIG: any;

// ── Third-party globals (CDN) ─────────────────────────────────────────────────
declare var Chart: any;
declare var Sentry: any;
declare var stripeFrontend: any;
declare var Stripe: any;
declare var TradingView: any;
declare var Choices: any;
declare var L: any;       // Leaflet
declare var XLSX: any;
declare var jspdf: any;

// ── Application constants ─────────────────────────────────────────────────────
declare var SECTORS: any;
declare var REGIONS: any;
declare var STATUS: any;
declare var MEDIA_TYPES: any;
declare var INACTIVITY_TIMEOUT: number | undefined;

// ── Module globals (assigned from feature modules) ────────────────────────────
declare var ModuleRegistry: any;
declare var actionRegistry: any;
declare var awardsModule: any;
declare var assignmentsModule: any;
declare var authModule: any;
declare var brandingModule: any;
declare var crmModule: any;
declare var dashboardModule: any;
declare var emailBuilder: any;
declare var emailListsModule: any;
declare var entriesModule: any;
declare var eventsModule: any;
declare var gdprModule: any;
declare var i18n: any;
declare var marketingModule: any;
declare var mediaGalleryModule: any;
declare var multiTenancyModule: any;
declare var paymentsModule: any;
declare var rbacModule: any;
declare var securityModule: any;
declare var settingsModule: any;
declare var winnersModule: any;
declare var a11yModule: any;
declare var aiVettingModule: any;
declare var reportsScheduler: any;

// ── Feature module globals ────────────────────────────────────────────────────
declare var seatingEnhancements: { init: () => void } | undefined;
declare var reportingModule: { generateReport?: () => void } | undefined;
declare var updateTabCounts: (() => void) | undefined;
declare var orgsModule: any | undefined;

// Changed to `any` so auth.js can attach _pollInterval / _realtimeChannel
declare var notificationsModule: any | undefined;
// Changed to `any` so app.js can call .init() and other methods
declare var tenantModule: any | undefined;

// ── Window module properties (assigned via window.X = ...) ───────────────────
interface Window {
  areasManager?: any;
  eventsModule?: any;
  paymentsModule?: any;
  winnersModule?: any;
  SENTRY_DSN?: string;
  [key: string]: any;
}

// ── DOM interface augmentations ───────────────────────────────────────────────
// Vanilla JS regularly accesses specific-element properties on base types returned
// by getElementById / querySelector.  All properties are optional so the
// augmentations don't falsely claim every element has them.

interface HTMLElement {
  // Form / input element properties
  value?: string;
  checked?: boolean;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  min?: string;
  type?: string;
  name?: string;
  accept?: string;
  multiple?: boolean;
  href?: string;
  src?: string;
  alt?: string;
  width?: number;
  height?: number;
  selectedIndex?: number;
  selectedOptions?: HTMLCollectionOf<HTMLOptionElement>;
  options?: HTMLOptionsCollection;
  files?: FileList | null;
  selectionStart?: number | null;
  selectionEnd?: number | null;
  contentWindow?: Window | null;
  contentDocument?: Document | null;

  // Form-level methods
  reset?(): void;
  checkValidity?(): boolean;
  reportValidity?(): boolean;
  validationMessage?: string;

  // Input selection
  select?(): void;

  // Canvas methods
  getContext?(contextId: string, options?: any): any;
  toBlob?(callback: BlobCallback, type?: string, quality?: any): void;
  toDataURL?(type?: string, quality?: any): string;

  // Custom instance properties attached at runtime by various modules
  _presenceChannel?: any;
  _cmsRealtimeChannel?: any;
  _activeUsers?: any;
  _realtimeChannel?: any;
  _pollInterval?: any;
  _initPresence?: any;
  _formDirty?: boolean;
  _formSaved?: boolean;
  _formSnapshot?: any;
  _dirtyTracked?: boolean;
  _chartInstance?: any;
  _certHandler?: any;
  _certInit?: boolean;
  _listenerAttached?: boolean;
  _relTimer?: any;
  _bannerClickBound?: any;
  _canvasWrapperBound?: any;
  _gdprClickBound?: any;
  _gdprPageBound?: any;
  _gdprSearchBound?: any;
  _gdprSearchBound2?: any;
  _inlineValidationInit?: boolean;
  _orgChangeBound?: any;
}

interface Element {
  // Common element properties accessed after getElementById / querySelector
  style?: CSSStyleDeclaration;
  dataset?: DOMStringMap;
  value?: string;
  checked?: boolean;
  disabled?: boolean;
  type?: string;
  name?: string;
  href?: string;
  src?: string;
  alt?: string;
  rel?: string;
  title?: string;
  content?: string;
  placeholder?: string;
  onclick?: ((this: GlobalEventHandlers, ev: MouseEvent) => any) | null;
  oninput?: ((this: GlobalEventHandlers, ev: Event) => any) | null;

  // HTMLElement methods not on base Element
  click?(): void;
  focus?(options?: FocusOptions): void;
  blur?(): void;

  // Form methods
  checkValidity?(): boolean;
  reportValidity?(): boolean;
  validationMessage?: string;
  select?(): void;

  // Custom instance properties
  _a11yKeyHandler?: any;
  _a11yTrigger?: Element;
  webkitRequestFullscreen?(): Promise<void>;
  msRequestFullscreen?(): Promise<void>;
}

interface EventTarget {
  // Properties accessed on raw EventTarget (e.g. event.target)
  closest?(selector: string): Element | null;
  contains?(other: Node | null): boolean;
  querySelectorAll?(selector: string): NodeListOf<Element>;
  getAttribute?(name: string): string | null;
  setAttribute?(name: string, value: string): void;
  tagName?: string;
  id?: string;
  value?: any;
  checked?: boolean;
  disabled?: boolean;
  name?: string;
  type?: string;
  files?: FileList | null;
  dataset?: DOMStringMap;
  classList?: DOMTokenList;
  style?: CSSStyleDeclaration;
  blur?(): void;
  focus?(): void;
  click?(): void;
  checkValidity?(): boolean;

  // Custom instance properties
  _a11yTrigger?: Element;
}

interface Event {
  key?: string;
  dataTransfer?: DataTransfer | null;
}

interface Error {
  code?: string | number;
  status?: number;
}

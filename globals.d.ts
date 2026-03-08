/**
 * Global type declarations for Awards CMS
 *
 * This file declares global variables and augments DOM types
 * to support TypeScript checking of vanilla JavaScript files.
 */

// ── Application globals (defined in config.js, utils.js, etc.) ──

declare const utils: Record<string, any>;
declare const apiClient: Record<string, any>;
declare const STATE: Record<string, any>;
declare const ModuleRegistry: Record<string, any>;
declare const SUPABASE_CONFIG: Record<string, any>;
declare const supabase: any;

// Constants
declare const STATUS: Record<string, string>;
declare const MEDIA_TYPES: Record<string, string>;
declare const SECTORS: string[];
declare const REGIONS: string[];
declare const YEARS: string[];
declare const INACTIVITY_TIMEOUT: number;

// ── Module globals (defined in their respective .js files) ──

declare const awardsModule: Record<string, any>;
declare const orgsModule: Record<string, any>;
declare const winnersModule: Record<string, any>;
declare const eventsModule: Record<string, any>;
declare const paymentsModule: Record<string, any>;
declare const crmModule: Record<string, any>;
declare const marketingModule: Record<string, any>;
declare const brandingModule: Record<string, any>;
declare const entriesModule: Record<string, any>;
declare const settingsModule: Record<string, any>;
declare const dashboardModule: Record<string, any>;
declare const rbacModule: Record<string, any>;
declare const authModule: Record<string, any>;
declare const emailBuilder: Record<string, any>;
declare const emailListsModule: Record<string, any>;
declare const mediaGalleryModule: Record<string, any>;
declare const multiTenancyModule: Record<string, any>;
declare const notificationsModule: Record<string, any>;
declare const assignmentsModule: Record<string, any>;
declare const aiVettingModule: Record<string, any>;
declare const tenantModule: Record<string, any>;
declare const securityModule: Record<string, any>;
declare const gdprModule: Record<string, any>;
declare const stripeFrontend: Record<string, any>;
declare const a11yModule: Record<string, any>;
declare const actionRegistry: Record<string, any>;
declare const reportsScheduler: Record<string, any>;
declare const i18n: Record<string, any>;

// ── Third-party library globals (loaded via CDN / script tags) ──

declare const bootstrap: any;
declare const Chart: any;
declare const XLSX: any;
declare const jspdf: any;
declare const Sentry: any;
declare const Stripe: any;
declare const Choices: any;
declare const L: any;
declare const TradingView: any;
declare const QRCode: any;

// AMD/UMD define
declare function define(deps: any, factory?: any): any;

// ── Window augmentation ──
// The codebase attaches many properties to window for cross-module access.

interface Window {
  [key: string]: any;
}

// ── DOM type augmentations ──
// Vanilla JS uses generic DOM query methods that return base types,
// but code accesses subtype-specific properties without casting.

interface EventTarget {
  closest(selectors: string): HTMLElement | null;
  contains(other: Node | null): boolean;
  value: any;
  checked: boolean;
  dataset: DOMStringMap;
  style: CSSStyleDeclaration;
  files: FileList | null;
  disabled: boolean;
  click(): void;
  key: string;
  dataTransfer: DataTransfer | null;
  tagName: string;
  id: string;
  getAttribute(qualifiedName: string): string | null;
  querySelectorAll(selectors: string): NodeListOf<HTMLElement>;
  checkValidity(): boolean;
  [key: string]: any;
}

interface Node {
  querySelector(selectors: string): HTMLElement | null;
  querySelectorAll(selectors: string): NodeListOf<HTMLElement>;
  setAttribute(name: string, value: string): void;
}

interface Element {
  value: any;
  checked: boolean;
  files: FileList | null;
  disabled: boolean;
  selectedIndex: number;
  options: HTMLOptionsCollection;
  checkValidity(): boolean;
  reportValidity(): boolean;
  src: string;
  getContext(contextId: string, options?: any): any;
  style: CSSStyleDeclaration;
  dataset: DOMStringMap;
  width: number;
  height: number;
  focus(options?: FocusOptions): void;
  blur(): void;
  content: any;
  onclick: ((this: GlobalEventHandlers, ev: MouseEvent) => any) | null;
  oninput: ((this: GlobalEventHandlers, ev: Event) => any) | null;
  title: string;
  href: string;
  alt: string;
  name: string;
  type: string;
  placeholder: string;
  rel: string;
  webkitRequestFullscreen(): void;
  msRequestFullscreen(): void;
  [key: string]: any;
}

interface HTMLElement {
  value: any;
  checked: boolean;
  files: FileList | null;
  disabled: boolean;
  selectedIndex: number;
  selectedOptions: HTMLCollectionOf<HTMLOptionElement>;
  options: HTMLOptionsCollection;
  required: boolean;
  checkValidity(): boolean;
  reportValidity(): boolean;
  reset(): void;
  select(): void;
  src: string;
  href: string;
  alt: string;
  min: string;
  getContext(contextId: string, options?: any): any;
  toDataURL(type?: string, quality?: any): string;
  toBlob(callback: BlobCallback, type?: string, quality?: any): void;
  selectionStart: number | null;
  selectionEnd: number | null;
  contentWindow: Window | null;
  contentDocument: Document | null;
  [key: string]: any;
}

interface Event {
  key: string;
  dataTransfer: DataTransfer | null;
}

interface Error {
  [key: string]: any;
}

// ── Third-party Node.js modules (used in api/ files) ──

declare module 'pdfkit' {
  const PDFDocument: any;
  export = PDFDocument;
}

declare module 'fontkit' {
  const fontkit: any;
  export = fontkit;
}

declare module 'crypto-js' {
  const CryptoJS: any;
  export = CryptoJS;
}

declare module 'node-cron' {
  const cron: any;
  export = cron;
}

declare module 'qrcode' {
  const QRCode: any;
  export = QRCode;
}

declare module 'resend' {
  export class Resend {
    constructor(apiKey: string);
    emails: { send(options: any): Promise<any> };
  }
}

declare module 'stripe' {
  const Stripe: any;
  export = Stripe;
}

declare module '@supabase/supabase-js' {
  export function createClient(...args: any[]): any;
}

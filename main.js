/**
 * @module main
 * @description ES module entry point for the BTA Awards CMS — core bundle only.
 * Heavy feature modules (events, media, email, crm) are loaded lazily via
 * separate chunk files when their tabs are first activated.
 */

// Core infrastructure
export {
  SUPABASE_CONFIG,
  STATUS,
  ENTRY_STATUS,
  EVENT_STATUS,
  ATTENDEE_STATUS,
  PAGE_SIZE,
  MEDIA_TYPES,
  INACTIVITY_TIMEOUT,
  YEARS,
  SECTORS,
  REGIONS,
  STATE,
  ModuleRegistry,
} from './config.js';
export { utils, apiClient, actionRegistry } from './utils.js';

// Authentication & security
export { authModule } from './auth.js';
export { rbacModule } from './rbac.js';
export { securityModule } from './security.js';
export { a11yModule } from './accessibility.js';
export { gdprModule } from './gdpr.js';

// Core data modules
export { awardsModule } from './awards.js';
export { orgsModule } from './organisations.js';
export { winnersModule } from './winners.js';
export { entriesModule } from './entries.js';
export { assignmentsModule } from './assignments.js';
export { dashboardModule } from './dashboard.js';

// Settings & admin
export { settingsModule } from './settings.js';
export { i18n } from './i18n.js';
export { tenantModule } from './multi-tenancy.js';

// Entry workflow helpers (needed by entries core flow for rejection emails)
export { entryRevisionModule } from './entry-revision.js';

// Stripe (initialised at startup in app.js)
export { stripeFrontend } from './stripe-frontend.js';

// Communication & workflow utilities
export { notificationsModule } from './notifications.js';
export { brandingModule } from './branding.js';
export { webhooksModule } from './webhooks.js';
export { rateLimitModule } from './rate-limiting.js';

// Location system — side-effect imports (set window globals, no named exports)
import './location.js';
import './areas-manager.js';

// Global actions — side-effect import (sets window.globalActions for data-action handlers)
import './global-actions.js';

// Nominee uploads — side-effect import (sets window.nomineeUploads)
import './nominee-uploads.js';

import './nominee-voting.js'; // sets window.nomineeVoting — no named export (plain-script compatible)

// BTC price widget
import './btc-module.js';

// Application initialization (must be last)
export { reportsScheduler } from './app.js';

// ---------------------------------------------------------------------------
// LAZY CHUNKS — NOT imported here; loaded on demand by app.js loadChunk().
// events.chunk.js   : events, seating-enhancements, ticket-management, calendar,
//                     winner-pipeline, winner-announcements
// media.chunk.js    : media-gallery-new, social-media, ai-vetting
// email.chunk.js    : email-templates, email-builder, email-lists, marketing
// crm.chunk.js      : crm, payments, reporting, sponsor-portal, document-management
// admin.chunk.js    : test-data-manager
// ---------------------------------------------------------------------------

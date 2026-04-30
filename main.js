/**
 * @module main
 * @description ES module entry point for the BTA Awards CMS.
 * Imports all modules and re-exports them for tree-shaking and bundling.
 * This file is used by esbuild as the bundle entry point.
 */

// Core infrastructure
export {
  SUPABASE_CONFIG,
  STATUS,
  MEDIA_TYPES,
  INACTIVITY_TIMEOUT,
  YEARS,
  SECTORS,
  REGIONS,
  STATE,
  ModuleRegistry,
} from './config.js';
export { utils, apiClient, serverQuery, actionRegistry } from './utils.js';

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
export { eventsModule } from './events.js';
export { assignmentsModule } from './assignments.js';
export { dashboardModule } from './dashboard.js';

// Email system
export { emailTemplatesModule } from './email-templates.js';
export { emailBuilder } from './email-builder.js';
export { emailListsModule } from './email-lists.js';

// Media & content
export { mediaGalleryModule } from './media-gallery-new.js';
export { socialMediaModule } from './social-media.js';

// Business modules
export { paymentsModule } from './payments.js';
export { crmModule } from './crm.js';
export { marketingModule } from './marketing.js';
export { stripeFrontend } from './stripe-frontend.js';

// AI & vetting
export { aiVettingModule } from './ai-vetting.js';

// Settings & admin
export { settingsModule } from './settings.js';
export { i18n } from './i18n.js';
export { tenantModule } from './multi-tenancy.js';
export { testDataManager } from './test-data-manager.js';

// Reporting & analytics
export { reportingModule } from './reporting.js';
export { sponsorPortalModule } from './sponsor-portal.js';

// Event features
export { ticketModule } from './ticket-management.js';
export { seatingEnhancements } from './seating-enhancements.js';
export { calendarModule } from './calendar.js';

// Communication & workflows
export { notificationsModule } from './notifications.js';
export { entryRevisionModule } from './entry-revision.js';
export { winnerPipelineModule } from './winner-pipeline.js';
export { brandingModule } from './branding.js';
export { webhooksModule } from './webhooks.js';
export { documentModule } from './document-management.js';
export { rateLimitModule } from './rate-limiting.js';
export { winnerAnnouncementsModule } from './winner-announcements.js';
// Location system — side-effect imports (set window globals, no named exports)
import './location.js';
import './areas-manager.js';

// Nominee uploads — side-effect import (sets window.nomineeUploads)
import './nominee-uploads.js';

import './nominee-voting.js'; // sets window.nomineeVoting — no named export (plain-script compatible)

// BTC price widget
import './btc-module.js';

// Application initialization (must be last)
export { reportsScheduler } from './app.js';

#!/usr/bin/env node
/**
 * Build script for BTA Awards CMS
 * Bundles and minifies JS/CSS for production
 * Run: node build.js
 */

const fs = require('fs');
const path = require('path');

const DIST_DIR = path.join(__dirname, 'dist');

// JS files in load order (must match index.html script tags)
const JS_FILES = [
  'config.js',
  'utils.js',
  'auth.js',
  'awards.js',
  'organisations.js',
  'winners.js',
  'entries.js',
  'email-templates.js',
  'media-gallery-new.js',
  'social-media.js',
  'events.js',
  'assignments.js',
  'dashboard.js',
  'ai-vetting.js',
  'marketing.js',
  'email-builder.js',
  'email-lists.js',
  'payments.js',
  'crm.js',
  'settings.js',
  'rbac.js',
  'security.js',
  'accessibility.js',
  'gdpr.js',
  'stripe-frontend.js',
  'i18n.js',
  'multi-tenancy.js',
  'test-data-manager.js',
  'reporting.js',
  'sponsor-portal.js',
  'ticket-management.js',
  'notifications.js',
  'entry-revision.js',
  'winner-pipeline.js',
  'branding.js',
  'webhooks.js',
  'document-management.js',
  'seating-enhancements.js',
  'calendar.js',
  'rate-limiting.js',
  'winner-announcements.js',
  'app.js'
];

const CSS_FILES = [
  'styles.css',
  'modern-theme.css',
  'assignments-styles.css'
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function build() {
  const startTime = Date.now();
  console.log('Building BTA Awards CMS...\n');

  ensureDir(DIST_DIR);

  // 1. Concatenate and minify JS
  let jsContent = '';
  let totalJsSize = 0;

  JS_FILES.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      totalJsSize += content.length;
      jsContent += `\n/* === ${file} === */\n${content}\n`;
    } else {
      console.warn(`  WARN: ${file} not found, skipping`);
    }
  });

  // Try esbuild for minification, fallback to basic concatenation
  try {
    const esbuild = require('esbuild');
    const result = await esbuild.transform(jsContent, {
      minify: true,
      target: 'es2020',
      format: 'iife',
      drop: ['console', 'debugger']
    });
    fs.writeFileSync(path.join(DIST_DIR, 'app.min.js'), result.code);
    const minSize = result.code.length;
    console.log(`  JS: ${(totalJsSize / 1024).toFixed(0)}KB -> ${(minSize / 1024).toFixed(0)}KB (${((1 - minSize / totalJsSize) * 100).toFixed(0)}% reduction)`);
  } catch (e) {
    // Fallback: just concatenate without minification
    fs.writeFileSync(path.join(DIST_DIR, 'app.bundle.js'), jsContent);
    console.log(`  JS: ${(totalJsSize / 1024).toFixed(0)}KB (concatenated, not minified - install esbuild for minification)`);
  }

  // 2. Concatenate CSS
  let cssContent = '';
  let totalCssSize = 0;

  CSS_FILES.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      totalCssSize += content.length;
      cssContent += `\n/* === ${file} === */\n${content}\n`;
    }
  });

  // Try esbuild for CSS minification
  try {
    const esbuild = require('esbuild');
    const result = await esbuild.transform(cssContent, {
      loader: 'css',
      minify: true
    });
    fs.writeFileSync(path.join(DIST_DIR, 'app.min.css'), result.code);
    const minSize = result.code.length;
    console.log(`  CSS: ${(totalCssSize / 1024).toFixed(0)}KB -> ${(minSize / 1024).toFixed(0)}KB (${((1 - minSize / totalCssSize) * 100).toFixed(0)}% reduction)`);
  } catch (e) {
    fs.writeFileSync(path.join(DIST_DIR, 'app.bundle.css'), cssContent);
    console.log(`  CSS: ${(totalCssSize / 1024).toFixed(0)}KB (concatenated, not minified)`);
  }

  // 3. Copy index.html with updated script/css references
  const indexPath = path.join(__dirname, 'index.html');
  if (fs.existsSync(indexPath)) {
    let html = fs.readFileSync(indexPath, 'utf8');

    // Replace custom CSS block: everything from <!-- Custom Styles --> to </head>
    html = html.replace(
      /<!-- Custom Styles -->[\s\S]*?<\/head>/,
      '<!-- Custom Styles -->\n  <link rel="stylesheet" href="app.min.css">\n</head>'
    );

    // Replace app script block: everything from <!-- Application Scripts --> to <script src="app.js">
    // Keep only one bundled script tag
    html = html.replace(
      /\s*<!-- Application Scripts[\s\S]*?<script src="app\.js"><\/script>/,
      '\n  <script src="app.min.js"></script>'
    );

    fs.writeFileSync(path.join(DIST_DIR, 'index.html'), html);
    console.log('  HTML: rewrote index.html to use bundled app.min.js + app.min.css');
  }

  // 4. Generate build manifest
  const manifest = {
    buildTime: new Date().toISOString(),
    version: '2.1.0',
    files: {
      js: JS_FILES.filter(f => fs.existsSync(path.join(__dirname, f))),
      css: CSS_FILES.filter(f => fs.existsSync(path.join(__dirname, f)))
    },
    sizes: { jsOriginal: totalJsSize, cssOriginal: totalCssSize }
  };
  fs.writeFileSync(path.join(DIST_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));

  const elapsed = Date.now() - startTime;
  console.log(`\nBuild complete in ${elapsed}ms`);
  console.log(`Output: ${DIST_DIR}/`);
}

build().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});

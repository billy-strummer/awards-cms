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
  'location.js',
  'areas-manager.js',
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
  'nominee-uploads.js',
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
  'app.js',
  'btc-module.js',
];

const CSS_FILES = ['styles.css', 'modern-theme.css', 'assignments-styles.css'];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function build() {
  const startTime = Date.now();
  console.log('Building BTA Awards CMS...\n');

  // 0. Run lint check before building
  try {
    const { execSync } = require('child_process');
    console.log('  Lint: checking...');
    execSync('npx eslint *.js api/*.js --max-warnings 0', { stdio: 'pipe', cwd: __dirname });
    console.log('  Lint: passed ✓');
  } catch (lintErr) {
    const output = lintErr.stdout ? lintErr.stdout.toString() : '';
    const errorCount = output.match(/\d+ error/)?.[0] || 'errors found';
    console.warn(`  Lint: ${errorCount} (run "npm run lint:fix" to auto-fix)`);
    // Don't fail build on lint warnings, but log them
  }

  ensureDir(DIST_DIR);

  // 1. Bundle JS using esbuild ESM bundler with main.js entry point
  let totalJsSize = 0;
  JS_FILES.forEach((file) => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
      totalJsSize += fs.statSync(filePath).size;
    }
  });

  try {
    const esbuild = require('esbuild');
    const entryPoint = path.join(__dirname, 'main.js');

    if (fs.existsSync(entryPoint)) {
      // Primary: Use esbuild bundler with ESM entry point
      const result = await esbuild.build({
        entryPoints: [entryPoint],
        bundle: true,
        minify: true,
        target: 'es2020',
        format: 'esm',
        outfile: path.join(DIST_DIR, 'app.min.js'),
        drop: ['debugger'],
        sourcemap: false,
        metafile: true,
      });
      const minSize = fs.statSync(path.join(DIST_DIR, 'app.min.js')).size;
      const moduleCount = Object.keys(result.metafile.inputs).length;
      console.log(
        `  JS: ${(totalJsSize / 1024).toFixed(0)}KB -> ${(minSize / 1024).toFixed(0)}KB (${((1 - minSize / totalJsSize) * 100).toFixed(0)}% reduction, ${moduleCount} ES modules bundled)`
      );
    } else {
      // Fallback: concatenate and transform (legacy mode)
      let jsContent = '';
      JS_FILES.forEach((file) => {
        const filePath = path.join(__dirname, file);
        if (fs.existsSync(filePath)) {
          jsContent += `\n/* === ${file} === */\n${fs.readFileSync(filePath, 'utf8')}\n`;
        } else {
          console.warn(`  WARN: ${file} not found, skipping`);
        }
      });
      const result = await esbuild.transform(jsContent, {
        minify: true,
        target: 'es2020',
        format: 'iife',
        drop: ['debugger'],
      });
      fs.writeFileSync(path.join(DIST_DIR, 'app.min.js'), result.code);
      const minSize = result.code.length;
      console.log(
        `  JS: ${(totalJsSize / 1024).toFixed(0)}KB -> ${(minSize / 1024).toFixed(0)}KB (${((1 - minSize / totalJsSize) * 100).toFixed(0)}% reduction, legacy IIFE mode)`
      );
    }
  } catch (e) {
    // Last resort: concatenate without minification
    let jsContent = '';
    JS_FILES.forEach((file) => {
      const filePath = path.join(__dirname, file);
      if (fs.existsSync(filePath)) {
        jsContent += `\n/* === ${file} === */\n${fs.readFileSync(filePath, 'utf8')}\n`;
      }
    });
    fs.writeFileSync(path.join(DIST_DIR, 'app.min.js'), jsContent);
    console.log(
      `  JS: ${(totalJsSize / 1024).toFixed(0)}KB (concatenated, not minified - esbuild error: ${e.message})`
    );
  }

  // 2. Concatenate CSS
  let cssContent = '';
  let totalCssSize = 0;

  CSS_FILES.forEach((file) => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      totalCssSize += content.length;
      cssContent += `\n/* === ${file} === */\n${content}\n`;
    }
  });

  // Try esbuild for CSS minification
  try {
    const esbuildCss = require('esbuild');
    const result = await esbuildCss.transform(cssContent, {
      loader: 'css',
      minify: true,
    });
    fs.writeFileSync(path.join(DIST_DIR, 'app.min.css'), result.code);
    const minSize = result.code.length;
    console.log(
      `  CSS: ${(totalCssSize / 1024).toFixed(0)}KB -> ${(minSize / 1024).toFixed(0)}KB (${((1 - minSize / totalCssSize) * 100).toFixed(0)}% reduction)`
    );
  } catch (e) {
    // Fallback: use same filename so HTML references work
    fs.writeFileSync(path.join(DIST_DIR, 'app.min.css'), cssContent);
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

    // Replace app script block: everything from <!-- Application Scripts --> to the last
    // bundled script (btc-module.js follows app.js). Keep only one bundled script tag.
    html = html.replace(
      /\s*<!-- Application Scripts[\s\S]*?<script src="btc-module\.js"><\/script>/,
      '\n  <script type="module" src="app.min.js"></script>'
    );

    // Inject Supabase environment variables into meta tags
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
    html = html.replace('<meta name="supabase-url" content="">', `<meta name="supabase-url" content="${supabaseUrl}">`);
    html = html.replace(
      '<meta name="supabase-anon-key" content="">',
      `<meta name="supabase-anon-key" content="${supabaseAnonKey}">`
    );

    fs.writeFileSync(path.join(DIST_DIR, 'index.html'), html);
    console.log('  HTML: rewrote index.html to use bundled app.min.js + app.min.css');
    if (supabaseUrl) console.log('  Supabase: credentials injected from environment');
  }

  // 4. Copy public-facing pages and their assets
  // These standalone pages have their own JS/CSS (not part of the admin bundle)
  const PUBLIC_PAGES = [
    'submit-entry.html',
    'submit-entry.js',
    'vote.html',
    'public-voting.html',
    'award-nominees.html',
    'company-profile.html',
    'award_companies.html',
    'judge-portal.html',
    'judge-login.html',
    'winners-portal.html',
    'check-in.html',
    'register.html',
    'payment-success.html',
    'payment-cancelled.html',
    'submit-entry-payment.html',
    'upload-documents.html',
    'nominate.html',
  ];

  // Also copy shared assets needed by public pages
  const PUBLIC_ASSETS = ['config.js', 'BTA-LOGO-entry.jpg', 'BTA-LOGO-no-date.jpg'];

  const allPublicFiles = [...PUBLIC_PAGES, ...PUBLIC_ASSETS];
  let copiedCount = 0;

  allPublicFiles.forEach((file) => {
    const src = path.join(__dirname, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(DIST_DIR, file));
      copiedCount++;
    }
  });

  // Copy any JS files referenced by public pages that aren't in the bundle
  const publicJsFiles = [
    'vote.js',
    'public-voting.js',
    'judge-portal.js',
    'judge-login.js',
    'winners-portal.js',
    'check-in.js',
    'register.js',
    'upload-documents.js',
    'company-profile.js',
    'award-nominees.js',
    'award_companies.js',
    'submit-entry-payment.js',
    'nominate.js',
  ];

  publicJsFiles.forEach((file) => {
    const src = path.join(__dirname, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(DIST_DIR, file));
      copiedCount++;
    }
  });

  console.log(`  Public pages: copied ${copiedCount} files to dist/`);

  // 5. Generate build manifest
  const manifest = {
    buildTime: new Date().toISOString(),
    version: '2.1.0',
    files: {
      js: JS_FILES.filter((f) => fs.existsSync(path.join(__dirname, f))),
      css: CSS_FILES.filter((f) => fs.existsSync(path.join(__dirname, f))),
    },
    sizes: { jsOriginal: totalJsSize, cssOriginal: totalCssSize },
  };
  fs.writeFileSync(path.join(DIST_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));

  const elapsed = Date.now() - startTime;
  console.log(`\nBuild complete in ${elapsed}ms`);
  console.log(`Output: ${DIST_DIR}/`);
}

build().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});

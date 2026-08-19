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
  'ui-init.js',
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

  // 0a. Guard: Vercel Hobby plan allows exactly 12 serverless functions
  const apiFiles = fs.readdirSync('./api').filter((f) => f.endsWith('.js') && !f.startsWith('_'));
  if (apiFiles.length > 12) {
    console.error(`ERROR: ${apiFiles.length} API functions exceed the Vercel Hobby limit of 12`);
    console.error(`Functions found: ${apiFiles.join(', ')}`);
    process.exit(1);
  }

  // 0b. Run lint check before building — failures abort the build
  const { execSync } = require('child_process');
  console.log('  Lint: checking...');
  execSync('npx eslint *.js api/*.js --max-warnings 0', { stdio: 'inherit', cwd: __dirname });
  console.log('  Lint: passed ✓');

  ensureDir(DIST_DIR);

  // 1. Bundle JS using esbuild ESM bundler with main.js entry point
  let totalJsSize = 0;
  JS_FILES.forEach((file) => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
      totalJsSize += fs.statSync(filePath).size;
    }
  });

  // Lazy chunks: each entry bundles a group of heavy modules as a plain IIFE
  // that registers itself on window via ModuleRegistry.register().
  const LAZY_CHUNKS = [
    { name: 'events', entry: 'chunks/events-entry.js', outfile: 'events.chunk.js' },
    { name: 'media', entry: 'chunks/media-entry.js', outfile: 'media.chunk.js' },
    { name: 'email', entry: 'chunks/email-entry.js', outfile: 'email.chunk.js' },
    { name: 'crm', entry: 'chunks/crm-entry.js', outfile: 'crm.chunk.js' },
    { name: 'admin', entry: 'chunks/admin-entry.js', outfile: 'admin.chunk.js' },
  ];

  try {
    const esbuild = require('esbuild');
    const entryPoint = path.join(__dirname, 'main.js');

    if (fs.existsSync(entryPoint)) {
      // Primary: Use esbuild bundler with ESM entry point (core bundle only)
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
        `  JS core: ${(totalJsSize / 1024).toFixed(0)}KB source -> ${(minSize / 1024).toFixed(0)}KB (${moduleCount} modules in core bundle)`
      );

      // Build each lazy chunk as a self-contained IIFE
      let totalChunkSize = 0;
      for (const chunk of LAZY_CHUNKS) {
        const chunkEntry = path.join(__dirname, chunk.entry);
        if (!fs.existsSync(chunkEntry)) {
          console.warn(`  WARN: chunk entry not found: ${chunk.entry}`);
          continue;
        }
        await esbuild.build({
          entryPoints: [chunkEntry],
          bundle: true,
          minify: true,
          target: 'es2020',
          format: 'iife',
          outfile: path.join(DIST_DIR, chunk.outfile),
          drop: ['debugger'],
          sourcemap: false,
          // Core globals (utils, apiClient, STATE, ModuleRegistry) are referenced
          // as bare names in source; esbuild leaves them as globals since they are
          // never imported — they are already on window from the core bundle.
        });
        const chunkSize = fs.statSync(path.join(DIST_DIR, chunk.outfile)).size;
        totalChunkSize += chunkSize;
        const chunkKb = (chunkSize / 1024).toFixed(0);
        const chunkWarn = chunkSize > 150 * 1024 ? ' ⚠️  LARGE (>150KB — consider splitting)' : '';
        console.log(`  JS chunk [${chunk.name}]: ${chunkKb}KB → ${chunk.outfile}${chunkWarn}`);
      }
      console.log(
        `  JS chunks total: ${(totalChunkSize / 1024).toFixed(0)}KB across ${LAZY_CHUNKS.length} lazy chunks`
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

  // 3. Assemble HTML from src/partials/ (or fall back to root index.html)
  const partialsManifest = path.join(__dirname, 'src', 'partials', 'manifest.json');
  let html;

  if (fs.existsSync(partialsManifest)) {
    const partials = JSON.parse(fs.readFileSync(partialsManifest, 'utf8'));
    const partialsDir = path.join(__dirname, 'src', 'partials');
    html = partials
      .map((file) => {
        const filePath = path.join(partialsDir, file);
        if (!fs.existsSync(filePath)) throw new Error(`Partial not found: src/partials/${file}`);
        return fs.readFileSync(filePath, 'utf8');
      })
      .join('');
    console.log(`  HTML: assembled from ${partials.length} partial(s) in src/partials/`);
  } else {
    const indexPath = path.join(__dirname, 'index.html');
    if (!fs.existsSync(indexPath)) throw new Error('index.html not found and no partials manifest');
    html = fs.readFileSync(indexPath, 'utf8');
    console.log('  HTML: using root index.html (no partials manifest found)');
  }

  // Replace custom CSS block: everything from <!-- Custom Styles --> to </head>
  html = html.replace(
    /<!-- Custom Styles -->[\s\S]*?<\/head>/,
    '<!-- Custom Styles -->\n  <link rel="stylesheet" href="app.min.css">\n</head>'
  );

  // Replace app script block: everything from <!-- Application Scripts --> to the last
  // bundled script (btc-module.js follows app.js). Keep only one bundled script tag.
  // Also inject <link rel="prefetch"> hints for all lazy chunks so the browser
  // downloads them at idle time and serves them from cache on first tab click.
  const chunkPrefetches = LAZY_CHUNKS.map((c) => `  <link rel="prefetch" as="script" href="${c.outfile}">`).join('\n');
  html = html.replace(
    /\s*<!-- Application Scripts[\s\S]*?<script src="btc-module\.js"><\/script>/,
    `\n${chunkPrefetches}\n  <script type="module" src="app.min.js"></script>`
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

  // 4. Copy public-facing pages and their assets
  // These standalone pages have their own JS/CSS (not part of the admin bundle)
  const PUBLIC_PAGES = [
    'home.html',
    'home-blue.html',
    'home-blue1.html',
    'home-blue2.html',
    'home-blue3.html',
    'home2.html',
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
    'industry-leader.html',
    'winner-certificate.html',
    'public-winners.html',
    'about.html',
    'privacy-policy.html',
    'terms-and-conditions.html',
    'cookie-policy.html',
    'faqs.html',
    'become-a-sponsor.html',
    'cookie-consent.js',
  ];

  // Also copy shared assets needed by public pages
  const PUBLIC_ASSETS = [
    'robots.txt',
    'config.js',
    'images/logos/non-stacked/BTA_Corporate_Horizontal-Black-and-White-01.png',
    'images/logos/non-stacked/BTA_Corporate_Horizontal-Black-and-White-02.png',
    'images/logos/non-stacked/BTA_Corporate_Horizontal-Texture.png',
    'images/logos/non-stacked/BTA_Corporate_Horizontal-Texture.jpg',
    'images/logos/non-stacked/BTA_Corporate_Horizontal-gold-white.png',
    'hero-video.mp4',
  ];

  const allPublicFiles = [...PUBLIC_PAGES, ...PUBLIC_ASSETS];
  let copiedCount = 0;

  allPublicFiles.forEach((file) => {
    const src = path.join(__dirname, file);
    const dest = path.join(DIST_DIR, file);
    if (fs.existsSync(src)) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
      copiedCount++;
    }
  });

  // Copy any JS files referenced by public pages that aren't in the bundle
  const publicJsFiles = [
    'vote.js',
    'public-voting.js',
    'nominee-voting.js',
    'judge-portal.js',
    'judge-login.js',
    'winners-portal-app.js',
    'check-in-app.js',
    'register-app.js',
    'upload-documents.js',
    'company-profile-app.js',
    'award-nominees-app.js',
    'award-companies-app.js',
    'submit-entry-payment.js',
    'nominate.js',
    'industry-leader.js',
    'winner-certificate.js',
    'public-winners-app.js',
    'public-utils.js',
    'footer-year.js',
    'global-actions.js',
    'home.js',
    'home2.js',
    'home-data.js',
    'hero-video-init.js',
    'home-inline.js',
  ];

  publicJsFiles.forEach((file) => {
    const src = path.join(__dirname, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(DIST_DIR, file));
      copiedCount++;
    }
  });

  console.log(`  Public pages: copied ${copiedCount} files to dist/`);

  // 4b. Copy images/ directory recursively (category images, etc.)
  function copyDirRecursive(src, dest) {
    if (!fs.existsSync(src)) return 0;
    ensureDir(dest);
    let count = 0;
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        count += copyDirRecursive(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
        count++;
      }
    }
    return count;
  }
  const imageCount = copyDirRecursive(path.join(__dirname, 'images'), path.join(DIST_DIR, 'images'));
  if (imageCount > 0) console.log(`  Images: copied ${imageCount} files to dist/images/`);

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

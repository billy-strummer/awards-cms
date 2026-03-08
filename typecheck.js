#!/usr/bin/env node
/* eslint-env node */
/**
 * TypeScript type-checking wrapper for Awards CMS.
 *
 * Runs tsc and filters out errors from node_modules (which get pulled in
 * via require() in API files despite exclude settings in jsconfig.json).
 */
const { execSync } = require('child_process');

try {
  execSync('npx -p typescript tsc --project jsconfig.json --noEmit --allowJs --checkJs', {
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  process.exit(0);
} catch (err) {
  const output = (err.stdout || '').toString() + (err.stderr || '').toString();
  const lines = output.split('\n');
  const filtered = lines.filter((line) => !line.includes('node_modules/') && line.trim() !== '');
  const errorLines = filtered.filter((line) => line.includes('error TS'));
  if (errorLines.length > 0) {
    console.error(filtered.join('\n'));
    console.error(`\nFound ${errorLines.length} type error(s).`);
    process.exit(1);
  }
  process.exit(0);
}

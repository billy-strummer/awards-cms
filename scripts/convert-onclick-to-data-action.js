#!/usr/bin/env node
/**
 * Convert inline onclick= handlers to data-action= attributes in HTML files.
 *
 * Handles patterns like:
 *   onclick="moduleName.method()"           → data-action="moduleName.method"
 *   onclick="moduleName.method('arg')"      → data-action="moduleName.method" data-args='["arg"]'
 *   onclick="moduleName.method('a','b')"    → data-action="moduleName.method" data-args='["a","b"]'
 *   onclick="moduleName.method(varName)"    → data-action="moduleName.method" data-args='["__VAR__varName"]'
 *
 * Complex inline JS (multi-statement, DOM manipulation) is left as-is with
 * a comment flagging it for manual review.
 */

const fs = require('fs');
const path = require('path');

const files = process.argv.slice(2);
if (files.length === 0) {
  console.log('Usage: node convert-onclick-to-data-action.js <file1.html> [file2.html ...]');
  process.exit(1);
}

// Pattern: simple function call — moduleName.method(args)
const SIMPLE_CALL = /^(\w+(?:\.\w+)+)\((.*)\)$/;

function parseArgs(argsStr) {
  if (!argsStr || argsStr.trim() === '') return [];

  const args = [];
  let depth = 0;
  let current = '';
  let inString = null;

  for (let i = 0; i < argsStr.length; i++) {
    const ch = argsStr[i];
    if (inString) {
      current += ch;
      if (ch === inString && argsStr[i - 1] !== '\\') inString = null;
    } else if (ch === "'" || ch === '"') {
      current += ch;
      inString = ch;
    } else if (ch === '(' || ch === '[' || ch === '{') {
      depth++;
      current += ch;
    } else if (ch === ')' || ch === ']' || ch === '}') {
      depth--;
      current += ch;
    } else if (ch === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) args.push(current.trim());
  return args;
}

function convertArg(arg) {
  // String literal
  if ((arg.startsWith("'") && arg.endsWith("'")) || (arg.startsWith('"') && arg.endsWith('"'))) {
    return arg.slice(1, -1);
  }
  // Number
  if (/^-?\d+(\.\d+)?$/.test(arg)) {
    return Number(arg);
  }
  // Boolean
  if (arg === 'true') return true;
  if (arg === 'false') return false;
  if (arg === 'null') return null;
  // Variable reference — can't be serialized to JSON
  return `__VAR__${arg}`;
}

let totalConverted = 0;
let totalSkipped = 0;

for (const file of files) {
  const filePath = path.resolve(file);
  let html = fs.readFileSync(filePath, 'utf8');
  let converted = 0;
  let skipped = 0;

  // Match onclick="..." (both " and ' as delimiters)
  html = html.replace(/\s+onclick=(["'])([\s\S]*?)\1/gi, (match, quote, handler) => {
    const trimmed = handler.trim().replace(/;$/, '');

    // Skip empty
    if (!trimmed) return match;

    // Try simple function call pattern
    const m = trimmed.match(SIMPLE_CALL);
    if (m) {
      const funcPath = m[1];
      const rawArgs = m[2].trim();
      const args = parseArgs(rawArgs);

      // Check if any arg has a __VAR__ reference (can't be fully serialized)
      const convertedArgs = args.map(convertArg);
      const hasVarRef = convertedArgs.some(a => typeof a === 'string' && a.startsWith('__VAR__'));

      if (hasVarRef) {
        skipped++;
        return match; // Leave as-is
      }

      converted++;
      if (args.length === 0) {
        return ` data-action="${funcPath}"`;
      }
      // Use single quotes for data-args since we're inside double-quoted attribute
      return ` data-action="${funcPath}" data-args="${JSON.stringify(convertedArgs).replace(/"/g, '&quot;')}"`;
    }

    // Complex handler — skip
    skipped++;
    return match;
  });

  fs.writeFileSync(filePath, html, 'utf8');
  console.log(`${path.basename(file)}: ${converted} converted, ${skipped} skipped (complex/variable handlers)`);
  totalConverted += converted;
  totalSkipped += skipped;
}

console.log(`\nTotal: ${totalConverted} converted, ${totalSkipped} skipped`);

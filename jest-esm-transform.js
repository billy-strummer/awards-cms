/**
 * Custom Jest transform that strips ES module export statements.
 * This allows source files to use `export { ... }` for the esbuild ESM bundler
 * while still being loadable via `require()` in Jest tests.
 */
module.exports = {
  process(sourceText, _sourcePath) {
    // Strip export statements (export { foo, bar };) from the end of files
    const transformed = sourceText.replace(
      /^export\s*\{[^}]*\}\s*;?\s*$/gm,
      '/* [jest-esm-transform] export stripped */'
    );
    return { code: transformed };
  },
};

/*
 * Build step: bundle the split source files (index.html, styles.css, engine.js,
 * app.js) into a single self-contained HTML file you can email, share, or open
 * straight from disk with no server and no dependencies.
 *
 *   node build.js   ->   dist/index.html
 *
 * The split source files in the repo root are the editable version; dist/index.html
 * is just those four files inlined into one. Re-run after any change.
 */
const fs = require("fs");
const path = require("path");

const root = __dirname;
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");

const css = read("styles.css");
const engine = read("engine.js");
const app = read("app.js");
let html = read("index.html");

html = html
  .replace('<link rel="stylesheet" href="styles.css" />', `<style>\n${css}\n</style>`)
  .replace('<script src="engine.js"></script>', `<script>\n${engine}\n</script>`)
  .replace('<script src="app.js"></script>', `<script>\n${app}\n</script>`);

fs.mkdirSync(path.join(root, "dist"), { recursive: true });
fs.writeFileSync(path.join(root, "dist", "index.html"), html);
console.log("Built dist/index.html (%d bytes) — open it in any browser.", html.length);

#!/usr/bin/env node
/* Sets every js/css "?v=" in index.html to a short hash of that file's content,
 * and the service-worker cache name to a hash of all of them. A file that changed
 * gets a new URL (phones fetch it); an unchanged one keeps its URL (stays cached).
 * No more counting versions by hand.
 *   node tools/bump-versions.js          → update index.html + sw.js
 *   node tools/bump-versions.js --check  → exit 1 if something is out of date (CI)
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = path.resolve(__dirname, "..");
const check = process.argv.includes("--check");
const hash = text => crypto.createHash("sha1").update(text).digest("hex").slice(0, 8);

const indexPath = path.join(root, "index.html");
const swPath = path.join(root, "sw.js");
const index = fs.readFileSync(indexPath, "utf8");
const sw = fs.readFileSync(swPath, "utf8");

const seen = new Map();
const missing = [];
const nextIndex = index.replace(/((?:src|href)=")((?:js|css)\/[^"?]+\.(?:js|css))\?v=([^"]*)"/g, (whole, start, file) => {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) { missing.push(file); return whole; }
  const version = hash(fs.readFileSync(full));
  seen.set(file, version);
  return `${start}${file}?v=${version}"`;
});

// the cache name follows every file + index.html itself (without its own ?v= values)
const shellHash = hash([...seen.entries()].sort().map(([file, version]) => `${file}:${version}`).join("|") + hash(nextIndex.replace(/\?v=[0-9a-f]+/g, "")));
const nextSw = sw.replace(/const CACHE_NAME = "mylife-pwa-[^"]*";/, `const CACHE_NAME = "mylife-pwa-${shellHash}";`);

const changed = nextIndex !== index || nextSw !== sw;
if (missing.length) console.log(`⚠️ listed in index.html but missing: ${missing.join(", ")}`);
if (check) {
  console.log(changed ? "✗ versions out of date — run: node tools/bump-versions.js" : `✓ ${seen.size} files, versions up to date (cache ${shellHash})`);
  process.exit(changed || missing.length ? 1 : 0);
}
if (nextIndex !== index) fs.writeFileSync(indexPath, nextIndex);
if (nextSw !== sw) fs.writeFileSync(swPath, nextSw);
console.log(changed ? `✓ updated ${seen.size} file versions, cache mylife-pwa-${shellHash}` : `✓ already up to date (${seen.size} files)`);

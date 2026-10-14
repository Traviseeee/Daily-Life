const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");

const entries = [
  "index.html",
  "manifest.webmanifest",
  "sw.js",
  "assets",
  "css",
  "js",
  "icons",
  "images"
];

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

for (const entry of entries) {
  const source = path.join(root, entry);
  if (!fs.existsSync(source)) continue;

  const target = path.join(dist, entry);
  fs.cpSync(source, target, { recursive: true });
}

console.log("Static Vercel deployment copied to dist");

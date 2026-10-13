const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "www");
const entries = [
  "index.html",
  "manifest.webmanifest",
  "sw.js",
  "assets",
  "css",
  "js"
];

function resetDir(target) {
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(target, { recursive: true });
}

function copyEntry(name) {
  const source = path.join(root, name);
  const destination = path.join(output, name);
  if (!fs.existsSync(source)) return;
  fs.cpSync(source, destination, { recursive: true });
}

resetDir(output);
entries.forEach(copyEntry);
console.log(`Copied MYLIFE web app to ${output}`);

'use strict';
// Copies native module prebuilds to dist/ so they're accessible
// when bridge.cjs resolves __dirname as the dist/ directory.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

const natives = [
  { pkg: '@julusian/freetype2', name: 'freetype2' },
];

for (const { pkg, name } of natives) {
  const src = path.join(ROOT, 'node_modules', pkg, 'prebuilds');
  const dest = path.join(ROOT, 'dist', 'prebuilds');
  if (fs.existsSync(src)) {
    copyDir(src, dest);
    console.log(`copied ${name} prebuilds → dist/prebuilds`);
  } else {
    console.warn(`prebuilds not found for ${pkg}, skipping`);
  }
}

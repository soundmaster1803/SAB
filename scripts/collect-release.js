'use strict';
/**
 * collect-release.js — copies final installers + cleaners into releases/<version>/
 * Run: node scripts/collect-release.js
 */

const fs   = require('fs');
const path = require('path');

const ROOT    = path.join(__dirname, '..');
const pkg     = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const version = pkg.version;                           // e.g. "1.0.0-beta"
const RELEASE = path.join(ROOT, 'release');
const OUT     = path.join(ROOT, 'releases', `v${version}`);

fs.mkdirSync(OUT, { recursive: true });

const files = [
  { src: path.join(RELEASE, `SAB-${version}-universal.dmg`),  label: 'Mac universal DMG' },
  { src: path.join(RELEASE, `SAB Setup ${version}.exe`),      label: 'Windows installer' },
  { src: path.join(RELEASE, 'SAB-Cleaner.app'),               label: 'Mac cleaner app',  dir: true },
  { src: path.join(RELEASE, 'SAB-Cleaner.exe'),               label: 'Windows cleaner' },
];

let ok = true;
for (const { src, label, dir } of files) {
  if (!fs.existsSync(src)) {
    console.error(`✗ missing: ${label} (${src})`);
    ok = false;
    continue;
  }
  const dest = path.join(OUT, path.basename(src));
  if (dir) {
    fs.cpSync(src, dest, { recursive: true });
  } else {
    fs.copyFileSync(src, dest);
  }
  console.log(`✓ ${label} → releases/v${version}/${path.basename(src)}`);
}

if (ok) {
  console.log(`\nrelease folder ready: releases/v${version}/`);
} else {
  console.error('\nsome files missing — run npm run app:pack + npm run app:cleaners first');
  process.exit(1);
}

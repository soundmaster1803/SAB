'use strict';
/**
 * build-cleaners.js — собирает SAB-Cleaner.app (Mac) и SAB-Cleaner.exe (Windows)
 * Запуск: node scripts/build-cleaners.js
 * Требования: macOS (osacompile + NSIS из electron-builder cache)
 */

const { spawnSync } = require('child_process');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const ROOT    = path.join(__dirname, '..');
const RELEASE = path.join(ROOT, 'release');
fs.mkdirSync(RELEASE, { recursive: true });

// ─── Mac .app (osacompile) ────────────────────────────────────────────────────

function buildMacCleaner() {
  const script = path.join(ROOT, 'scripts', 'SAB-Cleaner.applescript');
  const outApp = path.join(RELEASE, 'SAB-Cleaner.app');

  if (fs.existsSync(outApp)) fs.rmSync(outApp, { recursive: true });

  const r = spawnSync('osacompile', ['-o', outApp, script]);
  if (r.status !== 0) {
    console.error('osacompile failed:', r.stderr?.toString());
    return false;
  }
  console.log('✓ SAB-Cleaner.app →', outApp);
  return true;
}

// ─── Windows .exe (NSIS) ─────────────────────────────────────────────────────

function findMakensis() {
  const base = path.join(
    os.homedir(), 'Library', 'Caches', 'electron-builder', 'nsis'
  );
  if (!fs.existsSync(base)) return null;
  // Find any nsis version folder
  for (const ver of fs.readdirSync(base)) {
    const bin = path.join(base, ver, 'mac', 'makensis');
    if (fs.existsSync(bin)) return { bin, nsisDir: path.join(base, ver) };
  }
  return null;
}

function buildWinCleaner() {
  const nsis = findMakensis();
  if (!nsis) {
    console.warn('⚠  NSIS not found in electron-builder cache.');
    console.warn('   Run "npm run app:pack:win" once first to download it.');
    return false;
  }

  const script = path.join(ROOT, 'scripts', 'SAB-Cleaner.nsi');
  const tmpNsi = path.join(os.tmpdir(), 'SAB-Cleaner-build.nsi');
  const outExe = path.join(RELEASE, 'SAB-Cleaner.exe');

  fs.copyFileSync(script, tmpNsi);

  const r = spawnSync(nsis.bin, [
    `-XOutFile ${outExe}`,
    tmpNsi,
  ], {
    cwd: nsis.nsisDir,
    env: { ...process.env, NSISDIR: nsis.nsisDir },
  });

  if (r.status !== 0) {
    console.error('makensis failed:', r.stderr?.toString() || r.stdout?.toString());
    return false;
  }

  // NSIS sometimes resolves the path relative to its own dir — check both places
  const tmpExe = path.join(os.tmpdir(), 'SAB-Cleaner.exe');
  if (!fs.existsSync(outExe) && fs.existsSync(tmpExe)) {
    fs.copyFileSync(tmpExe, outExe);
  }

  if (!fs.existsSync(outExe)) {
    console.error('SAB-Cleaner.exe not found after compilation');
    return false;
  }

  console.log('✓ SAB-Cleaner.exe →', outExe);
  return true;
}

// ─── Run ─────────────────────────────────────────────────────────────────────

let ok = true;
if (process.platform === 'darwin') {
  ok = buildMacCleaner() && ok;
  ok = buildWinCleaner() && ok;
} else if (process.platform === 'win32') {
  console.log('Win32: only Windows cleaner is built here (Mac .app requires macOS)');
  ok = buildWinCleaner() && ok;
}

process.exit(ok ? 0 : 1);

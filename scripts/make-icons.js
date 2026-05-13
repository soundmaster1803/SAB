#!/usr/bin/env node
/**
 * make-icons.js — генерирует icon.icns (macOS) и icon.ico (Windows)
 *
 * Использование:
 *   node scripts/make-icons.js              — создаёт placeholder (синий квадрат)
 *   node scripts/make-icons.js icon.png     — конвертирует твой PNG 1024×1024
 *
 * Требования: macOS (использует sips + iconutil для .icns)
 * Для .ico — встроенный Node.js, сторонних зависимостей нет.
 */

'use strict';

const { execSync, spawnSync } = require('child_process');
const { deflateSync } = require('zlib');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const ASSETS = path.join(__dirname, '..', 'electron', 'assets');
const SOURCE_PNG = process.argv[2]
  ? path.resolve(process.argv[2])
  : null;

// ─── Minimal PNG generator (solid colour, any size) ──────────────────────────

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (const b of buf) c = (crcTable[(c ^ b) & 0xFF] ^ (c >>> 8)) >>> 0;
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const d = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const len = Buffer.alloc(4); len.writeUInt32BE(d.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, d])));
  return Buffer.concat([len, t, d, crc]);
}

function makeSolidPng(size, r, g, b) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB

  const row = Buffer.alloc(1 + size * 3);
  for (let i = 0; i < size; i++) {
    row[1 + i * 3] = r;
    row[2 + i * 3] = g;
    row[3 + i * 3] = b;
  }
  const raw = Buffer.concat(Array.from({ length: size }, () => row));

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ─── ICO builder (embeds a PNG into an ICO container) ────────────────────────

function makeIco(pngBuf) {
  // ICO with a single 256×256 entry (PNG compressed, supported Win Vista+)
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = icon
  header.writeUInt16LE(1, 4); // count: 1 image

  const entry = Buffer.alloc(16);
  entry[0] = 0;   // width  (0 = 256)
  entry[1] = 0;   // height (0 = 256)
  entry[2] = 0;   // colour count
  entry[3] = 0;   // reserved
  entry.writeUInt16LE(1, 4);              // planes
  entry.writeUInt16LE(32, 6);             // bit count
  entry.writeUInt32LE(pngBuf.length, 8);  // data size
  entry.writeUInt32LE(6 + 16, 12);        // data offset (after header + 1 entry)

  return Buffer.concat([header, entry, pngBuf]);
}

// ─── macOS .icns via sips + iconutil ─────────────────────────────────────────

const ICONSET_SIZES = [
  [16,  'icon_16x16'],
  [32,  'icon_16x16@2x'],
  [32,  'icon_32x32'],
  [64,  'icon_32x32@2x'],
  [64,  'icon_64x64'],       // not official but harmless
  [128, 'icon_64x64@2x'],
  [128, 'icon_128x128'],
  [256, 'icon_128x128@2x'],
  [256, 'icon_256x256'],
  [512, 'icon_256x256@2x'],
  [512, 'icon_512x512'],
  [1024,'icon_512x512@2x'],
];

function buildIcns(sourcePng) {
  const iconsetDir = path.join(os.tmpdir(), 'sab_icon.iconset');
  fs.mkdirSync(iconsetDir, { recursive: true });

  for (const [size, name] of ICONSET_SIZES) {
    const out = path.join(iconsetDir, `${name}.png`);
    const r = spawnSync('sips', ['-z', String(size), String(size), sourcePng, '--out', out]);
    if (r.status !== 0) {
      console.error('sips failed:', r.stderr?.toString());
      process.exit(1);
    }
  }

  const icnsOut = path.join(ASSETS, 'icon.icns');
  const r = spawnSync('iconutil', ['-c', 'icns', iconsetDir, '-o', icnsOut]);
  if (r.status !== 0) {
    console.error('iconutil failed:', r.stderr?.toString());
    process.exit(1);
  }

  fs.rmSync(iconsetDir, { recursive: true, force: true });
  console.log('✓ icon.icns →', icnsOut);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

fs.mkdirSync(ASSETS, { recursive: true });

let sourcePngPath;

if (SOURCE_PNG) {
  if (!fs.existsSync(SOURCE_PNG)) {
    console.error('File not found:', SOURCE_PNG);
    process.exit(1);
  }
  sourcePngPath = SOURCE_PNG;
  console.log('Using source PNG:', sourcePngPath);
} else {
  // Generate a 1024×1024 placeholder (SAB blue #007AFF)
  sourcePngPath = path.join(os.tmpdir(), 'sab_placeholder_1024.png');
  const placeholder = makeSolidPng(1024, 0x00, 0x7A, 0xFF);
  fs.writeFileSync(sourcePngPath, placeholder);
  console.log('Generated placeholder PNG (SAB blue, 1024×1024)');
}

// ── icon.icns (macOS only) ────────────────────────────────────────────────────
if (process.platform === 'darwin') {
  buildIcns(sourcePngPath);
} else {
  console.log('⚠  Skipping .icns — run on macOS to generate it');
}

// ── icon.ico (Windows, works on any platform) ─────────────────────────────────
const png256 = SOURCE_PNG
  ? (() => {
      // Resize source to 256×256 using sips if on macOS, otherwise use as-is
      if (process.platform === 'darwin') {
        const tmp = path.join(os.tmpdir(), 'sab_256.png');
        spawnSync('sips', ['-z', '256', '256', sourcePngPath, '--out', tmp]);
        return fs.readFileSync(tmp);
      }
      return fs.readFileSync(sourcePngPath);
    })()
  : makeSolidPng(256, 0x00, 0x7A, 0xFF);

const icoPath = path.join(ASSETS, 'icon.ico');
fs.writeFileSync(icoPath, makeIco(png256));
console.log('✓ icon.ico  →', icoPath);

console.log('\nDone. electron-builder will pick up icons from electron/assets/.');
console.log('When you get the final icon, run:');
console.log('  node scripts/make-icons.js your-icon-1024.png');

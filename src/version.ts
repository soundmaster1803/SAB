/**
 * version.ts
 *
 * Single authoritative source for the runtime version string.
 * Reads the VERSION file at startup — do not duplicate this string elsewhere.
 *
 * Resolution order:
 *   1. process.cwd()/VERSION  — works when running from project root (dev + prod)
 *   2. <script-dir>/../VERSION — fallback when cwd differs from project root
 */

import fs from 'fs';
import path from 'path';

function readVersion(): string {
  const candidates = [
    path.join(process.cwd(), 'VERSION'),
    path.join(path.dirname(process.argv[1] ?? ''), '../VERSION'),
  ];
  for (const p of candidates) {
    try {
      const v = fs.readFileSync(p, 'utf-8').trim();
      if (v) return v;
    } catch {}
  }
  return '0.0.0';
}

export const APP_VERSION: string = readVersion();

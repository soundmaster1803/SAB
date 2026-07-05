/**
 * api/routes/presets.ts
 *
 * Named camera-configuration presets, file-backed. A preset is a bundle of bulk
 * control actions (the same op vocabulary as POST /api/cameras/bulk). Applying a
 * preset is done client-side by replaying its actions through /bulk, so the
 * honest per-camera partial-failure report is preserved. This module only
 * stores / lists / deletes the preset JSON.
 *
 *   GET    /api/presets            — list all presets
 *   PUT    /api/presets/:name      — create or replace a preset { actions: [...] }
 *   DELETE /api/presets/:name      — remove a preset
 */
import { Router } from 'express';
import * as fs from 'fs';
import * as path from 'path';

export interface PresetAction { op: string; params: Record<string, unknown>; label: string }
export interface Preset { name: string; description?: string; actions: PresetAction[]; savedAt: number }

function presetsPath(): string {
  // Store next to config.json (SAB_CONFIG_PATH override or cwd).
  const cfg = process.env.SAB_CONFIG_PATH;
  const dir = cfg ? path.dirname(cfg) : process.cwd();
  return path.join(dir, 'presets.json');
}

function load(): Preset[] {
  try {
    const raw = fs.readFileSync(presetsPath(), 'utf-8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

function save(list: Preset[]): void {
  try { fs.writeFileSync(presetsPath(), JSON.stringify(list, null, 2), 'utf-8'); }
  catch (e: any) { console.error(`[presets] save failed: ${e.message}`); }
}

export function createPresetRoutes(): Router {
  const router = Router();

  router.get('/api/presets', (_req, res) => { res.json({ presets: load() }); });

  router.put('/api/presets/:name', (req, res) => {
    const name = String(req.params.name).trim();
    if (!name) { res.status(400).json({ error: 'name required' }); return; }
    const body = req.body as { description?: string; actions?: unknown };
    if (!Array.isArray(body.actions)) { res.status(400).json({ error: 'actions must be an array' }); return; }
    const preset: Preset = {
      name,
      ...(typeof body.description === 'string' ? { description: body.description } : {}),
      actions: body.actions as PresetAction[],
      savedAt: Date.now(),
    };
    const list = load().filter(p => p.name !== name);
    list.push(preset);
    list.sort((a, b) => a.name.localeCompare(b.name));
    save(list);
    res.json({ ok: true });
  });

  router.delete('/api/presets/:name', (req, res) => {
    const name = String(req.params.name);
    save(load().filter(p => p.name !== name));
    res.json({ ok: true });
  });

  return router;
}

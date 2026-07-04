/**
 * api/routes/sony-props.ts
 *
 * Generic device-property access — the foundation for "control everything".
 *
 * Routes:
 *   GET  /api/sony/catalog                — full PTP3 property catalog (for UI)
 *   GET  /api/cameras/:id/prop/:code      — read one property (live value + enum list + meta)
 *   POST /api/cameras/:id/prop            — set one property { code, value, force? }
 *
 * Set is gated by the knowledge layer's safeToWrite flag; risky/unknown props
 * require an explicit { force: true }. Values are packed to the exact wire width
 * from the PTP3 catalog datatype, so props absent from the poll blob still work.
 */

import { Router } from 'express';
import type { CameraManager } from '../../sony/manager';
import { getPropKnowledge } from '../../sony/protocol/prop-knowledge';
import { getPtp3Prop, getPtp3Values, getPtp3Catalog } from '../../sony/protocol/ptp3-catalog';

function ts(): string { return new Date().toISOString().slice(11, 23); }
function log(msg: string) { console.log(`[${ts()}] [UI] ${msg}`); }
function err(msg: string) { console.error(`[${ts()}] [UI] ERROR: ${msg}`); }

/** Parse a property code from "0xD001", "D001", or a decimal string/number. */
function parsePropCode(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isInteger(raw)) return raw;
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  const n = /^0x/i.test(s) ? parseInt(s, 16) : /^[0-9A-Fa-f]{3,4}$/.test(s) && /[A-Fa-f]/.test(s) ? parseInt(s, 16) : Number(s);
  return Number.isInteger(n) && n > 0 && n <= 0xFFFF ? n : null;
}

export interface SonyPropRouteDeps {
  manager: CameraManager;
}

export function createSonyPropRoutes({ manager }: SonyPropRouteDeps): Router {
  const router = Router();

  // ── Full catalog (static reference data) ──────────────────────────────────
  router.get('/api/sony/catalog', (_req, res) => {
    res.json({ properties: getPtp3Catalog() });
  });

  // ── Read one property from a camera ───────────────────────────────────────
  router.get('/api/cameras/:id/prop/:code', (req, res) => {
    const id = req.params.id;
    const code = parsePropCode(req.params.code);
    if (code === null) { res.status(400).json({ error: 'invalid property code' }); return; }
    const client = manager.getClient(id);
    if (!client) { res.status(404).json({ error: 'not found' }); return; }
    const [value, list] = client.scanProp(code);
    res.json({
      code: `0x${code.toString(16).toUpperCase()}`,
      value,
      present: value !== null,
      liveList: list,
      catalog: getPtp3Prop(code),
      values: getPtp3Values(code),
      knowledge: getPropKnowledge(code) ?? null,
    });
  });

  // ── Set one property on a camera ──────────────────────────────────────────
  // Body: { code: "0xD001" | number, value: number, force?: boolean }
  router.post('/api/cameras/:id/prop', async (req, res) => {
    const id = req.params.id;
    const body = req.body as { code?: unknown; value?: unknown; force?: unknown };
    const code = parsePropCode(body.code);
    const value = typeof body.value === 'number' ? body.value : null;
    const force = body.force === true;
    if (code === null) { res.status(400).json({ error: 'invalid property code' }); return; }
    if (value === null) { res.status(400).json({ error: 'value must be a number' }); return; }

    const client = manager.getClient(id);
    if (!client) { res.status(404).json({ error: 'not found' }); return; }
    if (!client.state.connected) { res.status(503).json({ error: 'not connected' }); return; }

    const catalog = getPtp3Prop(code);
    const knowledge = getPropKnowledge(code);

    // Read-only gate: the reference marks the property Get-only.
    if (catalog?.getSet === 'Get') {
      res.status(400).json({ error: `property 0x${code.toString(16)} is read-only` }); return;
    }
    // Safety gate: only knowledge-confirmed safe writes proceed without force.
    const safe = knowledge?.safeToWrite === true;
    if (!safe && !force) {
      res.status(403).json({
        error: `property 0x${code.toString(16)} is not marked safe to write — resend with { "force": true }`,
        safety: knowledge?.safety ?? 'unknown',
      });
      return;
    }

    const dtype = catalog?.dataType ?? knowledge?.dataType ?? '';
    log(`SET prop cam="${id}" code=0x${code.toString(16)} value=${value} dtype=${dtype || '?'} force=${force}`);
    try {
      await client.setPropTyped(code, value, dtype);
      res.json({ ok: true });
    } catch (e: any) {
      err(`set prop failed: ${e.message}`);
      res.status(500).json({ error: e.message });
    }
  });

  return router;
}

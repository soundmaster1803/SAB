/**
 * sony/protocol/ptp3-catalog.ts
 *
 * Authoritative raw-PTP device-property catalog, generated from the
 * "Camera Control PTP 3 Reference v2.02.00" (see docs/research/sony-sdk/).
 *
 * This is the wire-value source of truth: property codes, datatypes, enum
 * value → label maps, and Get/Set capability. Unlike CrSDK enums, these values
 * match what SAB actually sends over PTP/IP.
 *
 * The knowledge layer (prop-knowledge.ts) owns semantics/safety/UI hints; this
 * catalog owns the raw wire facts. Prefer this catalog for enum labels and
 * datatype-correct packing.
 */

import catalogData from '../../../knowledge/sony/ptp3-catalog.json';

export type Ptp3DataType =
  | 'UINT8' | 'INT8' | 'UINT16' | 'INT16' | 'UINT32' | 'INT32' | 'UINT64' | 'STR';

export interface Ptp3Prop {
  /** Hex string, e.g. "0xD001". */
  code: string;
  name: string;
  /** PTP datatype label; may be absent when the reference omitted it. */
  dataType?: string;
  /** "Get/Set" | "Get" | "Set" when known. */
  getSet?: string;
  /** "enum" | "range" | "none". */
  form?: string;
  /** Enum value (hex/decimal string) → human label. */
  values?: Record<string, string>;
}

const props = (catalogData as { properties: Ptp3Prop[] }).properties;

const byCode = new Map<number, Ptp3Prop>();
for (const p of props) {
  byCode.set(parseInt(p.code, 16), p);
}

/** Look up a property by numeric code. Null when the reference does not list it. */
export function getPtp3Prop(code: number): Ptp3Prop | null {
  return byCode.get(code) ?? null;
}

/** Enum value → label map for a property (numeric keys), or null. */
export function getPtp3Values(code: number): Record<number, string> | null {
  const p = byCode.get(code);
  if (!p?.values) return null;
  const out: Record<number, string> = {};
  for (const [k, v] of Object.entries(p.values)) {
    const n = k.startsWith('0x') || k.startsWith('0X') ? parseInt(k, 16) : Number(k);
    if (Number.isFinite(n)) out[n] = v;
  }
  return out;
}

/** The whole catalog (read-only) — for serving to the UI. */
export function getPtp3Catalog(): Ptp3Prop[] {
  return props;
}

/** Byte width for a PTP datatype label; null for variable/unknown. */
export function ptp3ByteWidth(dataType: string | undefined): number | null {
  switch (dataType) {
    case 'INT8': case 'UINT8':  return 1;
    case 'INT16': case 'UINT16': return 2;
    case 'INT32': case 'UINT32': return 4;
    case 'UINT64': return 8;
    default: return null;
  }
}

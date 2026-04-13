import fs from 'fs';
import path from 'path';
import type { SonyPTPClient } from '../../sony/ptp-client';
import { getSonyRuntimeState } from '../../sony/state/runtime';
import { getSonyModelSpec } from '../../sony/models';
import { getPropKnowledge } from '../../sony/protocol/prop-knowledge.js';

type DebugControlKind = 'step' | 'set' | 'btn' | 'read';

interface StaticPropDef {
  name: string;
  cat: string;
  control: DebugControlKind;
  decode: (v: number) => string;
}

interface CapabilityCatalogEntry {
  id: string;
  propCode?: string;
  category?: string;
  decodedFormat?: string;
  readable?: boolean;
  writable?: boolean;
  pollable?: boolean;
  uiRelevant?: boolean;
  alertRelevant?: boolean;
  presetRelevant?: boolean;
  controlType?: string | null;
  enumValues?: Record<string, string>;
  notes?: string;
}

interface ControlSemanticsEntry {
  id: string;
  propCode: string;
  controlType: string;
  safeToSetDirectly?: boolean;
  requiresMode?: string | null;
  uiWidget?: string | null;
  notes?: string;
}

interface ControlCatalogEntry {
  id: string;
  controlCode: string;
  name: string;
  category?: string;
  controlType: string;
  risk?: string;
  notes?: string;
}

interface PollingPropertyEntry {
  id: string;
  propCode: string;
  reason?: string;
}

interface PollingGroupsFile {
  HIGH?: { intervalMs: number; properties: PollingPropertyEntry[] };
  MEDIUM?: { intervalMs: number; properties: PollingPropertyEntry[] };
  LOW?: { intervalMs: number; properties: PollingPropertyEntry[] };
  ON_DEMAND?: { intervalMs: number | null; properties: PollingPropertyEntry[] };
}

interface LivePropEntry {
  propCode: number;
  dataType: number;
  currentValue: number;
  defaultValue: number;
  formFlag: number;
  enumValues: number[];
  range?: { min: number; max: number; step: number };
}

interface KnowledgeRow {
  capability?: CapabilityCatalogEntry;
  semantics?: ControlSemanticsEntry;
  control?: ControlCatalogEntry;
  pollingGroup?: 'HIGH' | 'MEDIUM' | 'LOW' | 'ON_DEMAND';
  pollingReason?: string;
}

const KNOWLEDGE_ROOT = path.resolve(process.cwd(), 'knowledge/sony');

function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

const CAPABILITY_CATALOG = readJsonFile<CapabilityCatalogEntry[]>(
  path.join(KNOWLEDGE_ROOT, 'capability-catalog.json'),
  [],
);
const CONTROL_SEMANTICS = readJsonFile<ControlSemanticsEntry[]>(
  path.join(KNOWLEDGE_ROOT, 'control-semantics.json'),
  [],
);
const CONTROL_CATALOG = readJsonFile<ControlCatalogEntry[]>(
  path.join(KNOWLEDGE_ROOT, 'control-catalog.json'),
  [],
);
const POLLING_GROUPS = readJsonFile<PollingGroupsFile>(
  path.join(KNOWLEDGE_ROOT, 'polling-groups.json'),
  {},
);

function tsHex(value: number, width = 4): string {
  return `0x${(value >>> 0).toString(16).toUpperCase().padStart(width, '0')}`;
}

function parseHexLike(value?: string): number | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  const parsed = normalized.startsWith('0x') ? Number.parseInt(normalized.slice(2), 16) : Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function signed16(value: number): number {
  return value > 32767 ? value - 65536 : value;
}

function enumMap(map: Record<number, string>) {
  return (value: number) => map[value] ?? tsHex(value, value > 0xFFFF ? 8 : 4);
}

function formatTime(value: number): string {
  return value > 0 ? `${Math.floor(value / 60)}m ${value % 60}s` : '—';
}

function formatShutter(value: number): string {
  if (!value || value === 0xFFFFFFFF) return '—';
  const num = (value >> 16) & 0xFFFF;
  const den = value & 0xFFFF;
  if (!num || !den) return '—';
  if (num === 1) return `1/${den}`;
  if (den === 10) return `${(num / 10).toFixed(1)}"`;
  return `${num}/${den}`;
}

function formatIso(value: number): string {
  if (!value) return '—';
  if (value === 0x00FFFFFF) return 'AUTO';
  const masked = value & 0xFFFF;
  return masked === 0xFFFF ? 'AUTO' : String(masked);
}

function formatEv(value: number): string {
  const ev = value / 1000;
  return ev === 0 ? '0 EV' : `${ev > 0 ? '+' : ''}${ev.toFixed(2)} EV`;
}

function formatAB(value: number): string {
  const signed = signed16(value);
  return signed > 0 ? `A+${signed}` : signed < 0 ? `B${Math.abs(signed)}` : '0';
}

function formatGM(value: number): string {
  const signed = signed16(value);
  return signed > 0 ? `G+${signed}` : signed < 0 ? `M${Math.abs(signed)}` : '0';
}

const STATIC_PROP_CATALOG = new Map<number, StaticPropDef>([
  [0x5005, { name: 'White Balance', cat: 'color', control: 'set', decode: enumMap({ 2: 'Auto', 4: 'Daylight', 0x8001: 'Shade', 0x8002: 'Cloudy', 0x8003: 'Tungsten', 0x8004: 'Fluorescent', 0x8006: 'Color Temp', 0x8007: 'Custom1', 0x8008: 'Custom2', 0x8009: 'Custom3', 0x800A: 'ATW', 0x800B: 'ATW Lock', 0x800C: 'AWB Lock' }) }],
  [0x5007, { name: 'F-Number', cat: 'exposure', control: 'step', decode: value => value ? `f/${(value / 100).toFixed(1)}` : '—' }],
  [0x500A, { name: 'Focus Mode', cat: 'focus', control: 'set', decode: enumMap({ 1: 'MF', 2: 'AF', 0x8004: 'DMF', 0x8005: 'AF-S', 0x8006: 'AF-C', 0x8007: 'AF-A' }) }],
  [0x500B, { name: 'Metering Mode', cat: 'exposure', control: 'set', decode: enumMap({ 1: 'Average', 2: 'CenterWeighted', 3: 'MultiSpot', 4: 'CenterSpot', 0x8001: 'MultiSeg', 0x8002: 'Center', 0x8004: 'Spot', 0x8006: 'Highlight' }) }],
  [0x500C, { name: 'Flash Mode', cat: 'exposure', control: 'set', decode: enumMap({ 1: 'Auto', 2: 'Off', 3: 'FillFlash', 4: 'RedEye Auto', 5: 'RedEye Fill' }) }],
  [0x500E, { name: 'Exposure Mode', cat: 'exposure', control: 'set', decode: enumMap({ 1: 'M', 2: 'P', 3: 'A', 4: 'S', 0x8050: 'Intelligent', 0x8052: 'Panorama', 0x8060: 'Movie', 0x8061: 'Audio Rec' }) }],
  [0x5010, { name: 'EV Compensation', cat: 'exposure', control: 'step', decode: formatEv }],
  [0x5013, { name: 'Drive Mode', cat: 'exposure', control: 'set', decode: enumMap({ 1: 'Single', 0x8001: 'Cont Hi', 0x8002: 'Cont Mid', 0x8003: 'Cont Lo', 0x8004: 'Timer 2s', 0x8005: 'Timer 10s', 0x8010: 'Interval' }) }],
  [0xD000, { name: 'T-Number', cat: 'exposure', control: 'read', decode: value => value ? `T/${(value / 100).toFixed(1)}` : '—' }],
  [0xD004, { name: 'Focal Distance (m)', cat: 'focus', control: 'read', decode: value => value ? `${(value / 1000).toFixed(2)} m` : '—' }],
  [0xD005, { name: 'Focal Distance (ft)', cat: 'focus', control: 'read', decode: value => value ? `${(value / 1000).toFixed(2)} ft` : '—' }],
  [0xD006, { name: 'Focal Distance Unit', cat: 'focus', control: 'set', decode: enumMap({ 1: 'Meter', 2: 'Feet' }) }],
  [0xD007, { name: 'Focus Mode Setting', cat: 'focus', control: 'set', decode: value => tsHex(value) }],
  [0xD00C, { name: 'WB Mode (Cinema)', cat: 'color', control: 'set', decode: value => tsHex(value) }],
  [0xD00D, { name: 'WB Tint', cat: 'color', control: 'set', decode: value => String(signed16(value)) }],
  [0xD00E, { name: 'Shutter Angle', cat: 'exposure', control: 'set', decode: value => value ? `${(value / 100).toFixed(2)}°` : '—' }],
  [0xD010, { name: 'Shutter Mode', cat: 'exposure', control: 'read', decode: enumMap({ 1: 'Speed', 2: 'Angle', 3: 'ECS' }) }],
  [0xD016, { name: 'Shutter Speed Value', cat: 'exposure', control: 'set', decode: formatShutter }],
  [0xD017, { name: 'Shutter Speed Current', cat: 'exposure', control: 'read', decode: formatShutter }],
  [0xD018, { name: 'ND Filter', cat: 'exposure', control: 'set', decode: enumMap({ 1: 'Off', 2: 'Auto', 0x10002: 'ND4', 0x10003: 'ND8', 0x10004: 'ND16', 0x10005: 'ND32', 0x10006: 'ND64', 0x10007: 'ND128' }) }],
  [0xD019, { name: 'ND Filter Mode', cat: 'exposure', control: 'read', decode: enumMap({ 1: 'Manual', 2: 'Auto' }) }],
  [0xD01A, { name: 'ND Filter Mode Setting', cat: 'exposure', control: 'set', decode: enumMap({ 1: 'Manual', 2: 'Auto' }) }],
  [0xD01B, { name: 'ND Filter Value', cat: 'exposure', control: 'set', decode: value => tsHex(value, 8) }],
  [0xD01C, { name: 'Gain Control Setting', cat: 'exposure', control: 'set', decode: enumMap({ 1: 'Manual', 2: 'Auto', 3: 'ISO' }) }],
  [0xD01D, { name: 'Gain Unit', cat: 'exposure', control: 'set', decode: enumMap({ 1: 'dB', 2: 'ISO' }) }],
  [0xD01E, { name: 'Gain dB', cat: 'exposure', control: 'step', decode: value => `${(value / 10).toFixed(1)} dB` }],
  [0xD01F, { name: 'Gain dB Current', cat: 'exposure', control: 'read', decode: value => `${(value / 10).toFixed(1)} dB` }],
  [0xD020, { name: 'Gain Base ISO', cat: 'exposure', control: 'set', decode: value => value ? `ISO ${value}` : '—' }],
  [0xD022, { name: 'Exposure Index (EI)', cat: 'exposure', control: 'step', decode: formatIso }],
  [0xD07A, { name: 'System Error Info', cat: 'alerts', control: 'read', decode: value => value === 0 ? 'OK' : tsHex(value, 8) }],
  [0xD07B, { name: 'Lens Model', cat: 'system', control: 'read', decode: value => tsHex(value, 8) }],
  [0xD120, { name: 'Rec Duration', cat: 'recording', control: 'read', decode: formatTime }],
  [0xD1BB, { name: 'Camera Error Status', cat: 'alerts', control: 'read', decode: value => value === 0 ? 'OK' : tsHex(value, 8) }],
  [0xD1BC, { name: 'System Error Status', cat: 'alerts', control: 'read', decode: value => value === 0 ? 'OK' : tsHex(value, 8) }],
  [0xD200, { name: 'Flash Compensation', cat: 'exposure', control: 'step', decode: formatEv }],
  [0xD201, { name: 'DRO / D-Lighting', cat: 'color', control: 'set', decode: enumMap({ 0: 'Off', 1: 'Auto', 0x11: 'Lv1', 0x12: 'Lv2', 0x13: 'Lv3', 0x14: 'Lv4', 0x15: 'Lv5' }) }],
  [0xD204, { name: 'Battery %', cat: 'battery', control: 'read', decode: value => `${value}%` }],
  [0xD205, { name: 'Battery Level Icon', cat: 'battery', control: 'read', decode: enumMap({ 0: 'Empty', 1: 'Level1', 2: 'Level2', 3: 'Level3', 4: 'Full', 5: 'AC' }) }],
  [0xD20D, { name: 'Shutter Speed', cat: 'exposure', control: 'step', decode: formatShutter }],
  [0xD20E, { name: 'Battery Level (step)', cat: 'battery', control: 'read', decode: enumMap({ 0: 'Empty', 1: 'Level1', 2: 'Level2', 3: 'Full' }) }],
  [0xD20F, { name: 'Color Temperature', cat: 'color', control: 'step', decode: value => value ? `${value} K` : '—' }],
  [0xD210, { name: 'WB Shift G/M', cat: 'color', control: 'set', decode: formatGM }],
  [0xD211, { name: 'Aspect Ratio', cat: 'color', control: 'set', decode: enumMap({ 1: '3:2', 2: '16:9', 3: '4:3', 4: '1:1' }) }],
  [0xD213, { name: 'AF Status', cat: 'focus', control: 'read', decode: enumMap({ 1: 'Not focused', 2: 'Focused', 3: 'Tracking failed', 4: 'N/A' }) }],
  [0xD217, { name: 'AE Lock', cat: 'system', control: 'read', decode: enumMap({ 0: 'Unlocked', 1: 'Locked' }) }],
  [0xD218, { name: 'Battery Remain', cat: 'battery', control: 'read', decode: value => value > 100 ? '100% (AC)' : `${value}%` }],
  [0xD21B, { name: 'Picture Effect', cat: 'color', control: 'set', decode: enumMap({ 0x8000: 'Off', 0x8001: 'ToyCamera', 0x8002: 'PopColor', 0x8003: 'Poster', 0x8004: 'Retro', 0x8007: 'HiContrastMono', 0x800A: 'RichtoneMono' }) }],
  [0xD21C, { name: 'WB Shift A/B', cat: 'color', control: 'set', decode: formatAB }],
  [0xD21D, { name: 'Rec State', cat: 'recording', control: 'btn', decode: enumMap({ 0: 'IDLE', 1: 'RECORDING', 2: 'STANDBY', 4: 'PAUSED' }) }],
  [0xD21E, { name: 'ISO', cat: 'exposure', control: 'step', decode: formatIso }],
  [0xD21F, { name: 'FE Lock', cat: 'system', control: 'read', decode: enumMap({ 0: 'Unlocked', 1: 'Locked' }) }],
  [0xD221, { name: 'Live View Status', cat: 'system', control: 'read', decode: enumMap({ 0: 'Disabled', 1: 'Enabled' }) }],
  [0xD22C, { name: 'Focus Area', cat: 'color', control: 'set', decode: enumMap({ 1: 'Wide', 2: 'Zone', 3: 'Center', 4: 'Flex-S', 5: 'Flex-M', 6: 'Flex-L', 7: 'Expand Flex', 8: 'Track Wide', 9: 'Track Zone', 10: 'Track Center' }) }],
  [0xD235, { name: 'NearFar Enable', cat: 'system', control: 'read', decode: enumMap({ 0: 'Disabled', 1: 'Enabled' }) }],
  [0xD23F, { name: 'Picture Profile', cat: 'color', control: 'set', decode: enumMap({ 0: 'Off', 1: 'PP1', 2: 'PP2', 3: 'PP3', 4: 'PP4', 5: 'PP5', 6: 'PP6', 7: 'PP7', 8: 'PP8', 9: 'PP9', 10: 'PP10', 11: 'PP11' }) }],
  [0xD241, { name: 'Movie File Format', cat: 'recording', control: 'set', decode: enumMap({ 0x10001: 'XAVC S 4K', 0x10002: 'XAVC S HD', 0x20001: 'XAVC HS 4K', 0x20002: 'XAVC HS HD', 0x30001: 'XAVC S-I 4K', 0x30002: 'XAVC S-I HD', 0x40001: 'AVCHD', 0x50001: 'XAVC I 4K', 0x50002: 'XAVC I HD' }) }],
  [0xD242, { name: 'Rec Setting', cat: 'recording', control: 'set', decode: value => tsHex(value, 8) }],
  [0xD248, { name: 'Slot1 Status', cat: 'media', control: 'read', decode: enumMap({ 0: 'NoMedia', 1: 'Normal', 2: 'Error', 3: 'Recording', 4: 'FormatError' }) }],
  [0xD249, { name: 'Slot1 Remaining Shots', cat: 'media', control: 'read', decode: value => `${value} shots` }],
  [0xD24A, { name: 'Slot1 Remaining Time', cat: 'media', control: 'read', decode: formatTime }],
  [0xD251, { name: 'Overheating State', cat: 'alerts', control: 'read', decode: enumMap({ 0: 'Normal', 1: 'Warning', 2: 'Error' }) }],
  [0xD256, { name: 'Slot2 Status', cat: 'media', control: 'read', decode: enumMap({ 0: 'NoMedia', 1: 'Normal', 2: 'Error', 3: 'Recording', 4: 'FormatError' }) }],
  [0xD257, { name: 'Slot2 Remaining Shots', cat: 'media', control: 'read', decode: value => `${value} shots` }],
  [0xD258, { name: 'Slot2 Remaining Time', cat: 'media', control: 'read', decode: formatTime }],
  [0xD286, { name: 'Rec Frame Rate', cat: 'recording', control: 'set', decode: value => tsHex(value, 8) }],
  [0xD2C1, { name: 'S1 Button', cat: 'capture', control: 'btn', decode: enumMap({ 1: 'Up', 2: 'Down' }) }],
  [0xD2C2, { name: 'S2 Button', cat: 'capture', control: 'btn', decode: enumMap({ 1: 'Up', 2: 'Down' }) }],
  [0xD2C3, { name: 'AEL Button', cat: 'capture', control: 'btn', decode: enumMap({ 1: 'Up', 2: 'Down' }) }],
  [0xD2C4, { name: 'AFL Button', cat: 'capture', control: 'btn', decode: enumMap({ 1: 'Up', 2: 'Down' }) }],
  [0xD2C8, { name: 'Movie Rec Button', cat: 'recording', control: 'btn', decode: enumMap({ 1: 'Up', 2: 'Down' }) }],
  [0xD2D1, { name: 'MF Near/Far Step', cat: 'focus', control: 'step', decode: value => `step ${value}` }],
  [0xD380, { name: 'Focus Position Raw', cat: 'focus', control: 'read', decode: value => String(value) }],
  [0xD381, { name: 'Focus Position %', cat: 'focus', control: 'read', decode: value => `${value}%` }],
  [0xD3C2, { name: 'Slot1 Remain (alt)', cat: 'media', control: 'read', decode: formatTime }],
  [0xD3C4, { name: 'Slot3 Remain (alt)', cat: 'media', control: 'read', decode: formatTime }],
  [0xD450, { name: 'Stream Setting', cat: 'streaming', control: 'set', decode: value => tsHex(value, 8) }],
  [0xD451, { name: 'Stream Resolution', cat: 'streaming', control: 'set', decode: value => tsHex(value, 8) }],
  [0xD452, { name: 'Stream Framerate', cat: 'streaming', control: 'set', decode: value => String(value) }],
  [0xD453, { name: 'Stream Codec', cat: 'streaming', control: 'set', decode: value => tsHex(value, 8) }],
  [0xD454, { name: 'Stream Quality', cat: 'streaming', control: 'set', decode: value => tsHex(value, 8) }],
  [0xD455, { name: 'Stream URL', cat: 'streaming', control: 'read', decode: value => tsHex(value, 8) }],
  [0xD456, { name: 'Stream State', cat: 'streaming', control: 'read', decode: enumMap({ 0: 'Stopped', 1: 'Running', 2: 'Error' }) }],
  [0xD511, { name: 'Stream Status', cat: 'streaming', control: 'read', decode: value => tsHex(value, 8) }],
]);

const KNOWN_PROP_CODES = new Set<number>();
const KNOWLEDGE_BY_PROP = new Map<number, KnowledgeRow>();

function mergeKnowledge(code: number, patch: Partial<KnowledgeRow>) {
  const current = KNOWLEDGE_BY_PROP.get(code) ?? {};
  KNOWLEDGE_BY_PROP.set(code, { ...current, ...patch });
  KNOWN_PROP_CODES.add(code);
}

for (const [code] of STATIC_PROP_CATALOG) KNOWN_PROP_CODES.add(code);

for (const entry of CAPABILITY_CATALOG) {
  const code = parseHexLike(entry.propCode);
  if (code === null) continue;
  mergeKnowledge(code, { capability: entry });
}

for (const entry of CONTROL_SEMANTICS) {
  const code = parseHexLike(entry.propCode);
  if (code === null) continue;
  mergeKnowledge(code, { semantics: entry });
}

for (const entry of CONTROL_CATALOG) {
  const code = parseHexLike(entry.controlCode);
  if (code === null) continue;
  mergeKnowledge(code, { control: entry });
}

for (const groupName of ['HIGH', 'MEDIUM', 'LOW', 'ON_DEMAND'] as const) {
  const group = POLLING_GROUPS[groupName];
  for (const prop of group?.properties ?? []) {
    const code = parseHexLike(prop.propCode);
    if (code === null) continue;
    mergeKnowledge(code, {
      pollingGroup: groupName,
      ...(prop.reason ? { pollingReason: prop.reason } : {}),
    });
  }
}

const RUNTIME_CONTROL_MAP: Record<number, string> = {
  0x5007: 'ui+bridge',
  0x5010: 'api-ready',
  0xD20D: 'ui+bridge',
  0xD20F: 'ui+bridge',
  0xD21E: 'ui+bridge',
  0xD2C1: 'ui',
  0xD2C8: 'ui',
  0xD2D1: 'bridge',
};

function labelFromCapability(entry?: CapabilityCatalogEntry): string | null {
  if (!entry) return null;
  return entry.decodedFormat || entry.id || null;
}

function enumLabelMap(entry?: CapabilityCatalogEntry): Map<number, string> {
  const result = new Map<number, string>();
  for (const [rawKey, rawValue] of Object.entries(entry?.enumValues ?? {})) {
    const code = parseHexLike(rawKey);
    if (code !== null) result.set(code, rawValue);
  }
  return result;
}

function decodeValue(code: number, value: number, knowledge?: KnowledgeRow): string {
  const staticDef = STATIC_PROP_CATALOG.get(code);
  if (staticDef) return staticDef.decode(value);

  const enumLabels = enumLabelMap(knowledge?.capability);
  const enumLabel = enumLabels.get(value);
  if (enumLabel) return enumLabel;

  const capability = knowledge?.capability;
  if (capability?.decodedFormat?.toLowerCase().includes('kelvin')) return `${value} K`;
  if (capability?.decodedFormat?.toLowerCase().includes('percent')) return `${value}%`;
  if (capability?.decodedFormat?.toLowerCase().includes('time')) return formatTime(value);

  return tsHex(value, value > 0xFFFF ? 8 : 4);
}

function deriveControl(code: number, knowledge?: KnowledgeRow): DebugControlKind {
  const staticDef = STATIC_PROP_CATALOG.get(code);
  if (staticDef) return staticDef.control;

  const semantics = knowledge?.semantics?.controlType;
  if (semantics === 'step') return 'step';
  if (semantics === 'enum' || semantics === 'absolute') return 'set';
  if (semantics === 'button') return 'btn';
  if (knowledge?.capability?.writable) return 'set';
  return 'read';
}

function deriveName(code: number, knowledge?: KnowledgeRow): string {
  return STATIC_PROP_CATALOG.get(code)?.name
    ?? knowledge?.control?.name
    ?? labelFromCapability(knowledge?.capability)
    ?? knowledge?.capability?.id
    ?? tsHex(code);
}

function deriveCategory(code: number, knowledge?: KnowledgeRow): string {
  return STATIC_PROP_CATALOG.get(code)?.cat
    ?? knowledge?.capability?.category
    ?? knowledge?.control?.category
    ?? 'other';
}

function getModelKnowledge(model: string | undefined, spec: ReturnType<typeof getSonyModelSpec>) {
  if (!model && !spec) return null;
  const candidates = new Set<string>();
  if (model) candidates.add(model.toLowerCase());
  for (const modelId of spec?.modelIds ?? []) {
    candidates.add(modelId.toLowerCase());
  }
  for (const file of fs.existsSync(path.join(KNOWLEDGE_ROOT, 'models')) ? fs.readdirSync(path.join(KNOWLEDGE_ROOT, 'models')) : []) {
    const stem = file.replace(/\.json$/i, '').toLowerCase();
    if (candidates.has(stem)) {
      const filePath = path.join(KNOWLEDGE_ROOT, 'models', file);
      const data = readJsonFile<Record<string, unknown> | null>(filePath, null);
      const capabilityKeys = Array.isArray(data?.capabilities)
        ? data.capabilities
        : Object.keys((data?.capabilities as Record<string, unknown> | undefined) ?? {});
      return { file, capabilityKeys };
    }
  }
  return null;
}

function summarizeModelCoverage(liveCodes: number[], spec: ReturnType<typeof getSonyModelSpec>, modelKnowledge: ReturnType<typeof getModelKnowledge>) {
  const matchedCapabilities = liveCodes.filter(code => KNOWLEDGE_BY_PROP.has(code) || STATIC_PROP_CATALOG.has(code) || !!getPropKnowledge(code)).length;
  const actionable = liveCodes.filter(code => RUNTIME_CONTROL_MAP[code]).length;
  return {
    livePropCount: liveCodes.length,
    matchedKnowledgeProps: matchedCapabilities,
    actionableProps: actionable,
    specMatched: !!spec,
    knowledgeModelMatched: !!modelKnowledge,
    registeredCapabilityCount: spec ? Object.values(spec.capabilities).filter(Boolean).length : 0,
  };
}

export function buildSonyDebugPayload(client: SonyPTPClient) {
  const state = client.state;
  const spec = state.model ? getSonyModelSpec(state.model) : null;
  const modelKnowledge = getModelKnowledge(state.model, spec);
  const runtime = getSonyRuntimeState(state);
  const liveProps = client.scanAllProps();
  const liveCodes = liveProps.map(prop => prop.propCode);
  const coverage = summarizeModelCoverage(liveCodes, spec, modelKnowledge);

  const props = liveProps
    .map(prop => {
      const knowledge = KNOWLEDGE_BY_PROP.get(prop.propCode);
      // Fallback to the TypeScript protocol knowledge layer for props not in the JSON catalogs
      const pk = getPropKnowledge(prop.propCode);

      const readable = knowledge?.capability?.readable ?? true;
      const writable = knowledge?.capability?.writable ?? pk?.writable ?? deriveControl(prop.propCode, knowledge) !== 'read';
      const enumLabels = enumLabelMap(knowledge?.capability);

      // Decode: static catalog → prop-knowledge enum table → JSON catalog → format hints → hex
      function decodeProp(value: number): string {
        const staticDef = STATIC_PROP_CATALOG.get(prop.propCode);
        if (staticDef) return staticDef.decode(value);
        if (pk?.enumDecoding && pk.enumDecoding[value] !== undefined) return pk.enumDecoding[value]!;
        const enumLabel = enumLabels.get(value);
        if (enumLabel) return enumLabel;
        const cap = knowledge?.capability;
        if (cap?.decodedFormat?.toLowerCase().includes('kelvin')) return `${value} K`;
        if (cap?.decodedFormat?.toLowerCase().includes('percent')) return `${value}%`;
        if (cap?.decodedFormat?.toLowerCase().includes('time')) return formatTime(value);
        return tsHex(value, value > 0xFFFF ? 8 : 4);
      }

      const decoded = decodeProp(prop.currentValue);
      const defaultDecoded = decodeProp(prop.defaultValue);
      const runtimeControl = RUNTIME_CONTROL_MAP[prop.propCode] ?? 'none';

      // Name/category/control: static → JSON → prop-knowledge.ts
      const name = STATIC_PROP_CATALOG.get(prop.propCode)?.name
        ?? knowledge?.control?.name
        ?? labelFromCapability(knowledge?.capability)
        ?? knowledge?.capability?.id
        ?? pk?.name
        ?? tsHex(prop.propCode);

      const category = STATIC_PROP_CATALOG.get(prop.propCode)?.cat
        ?? knowledge?.capability?.category
        ?? knowledge?.control?.category
        ?? pk?.category
        ?? 'other';

      // Poll group: JSON catalog → prop-knowledge.ts (converting to uppercase display format)
      const pollGroup: string | null = knowledge?.pollingGroup
        ?? (pk?.pollPriority === 'on-demand' ? 'ON_DEMAND'
           : pk?.pollPriority === 'skip'      ? null
           : pk?.pollPriority                 ? pk.pollPriority.toUpperCase()
           : null);

      const uiRelevant = knowledge?.capability?.uiRelevant
        ?? (pk ? pk.uiWidget !== 'debug-only' && pk.uiWidget !== 'none' : false);
      const alertRelevant = knowledge?.capability?.alertRelevant ?? pk?.alertRelevant ?? false;

      const notes: string[] = [
        knowledge?.capability?.notes,
        knowledge?.semantics?.notes,
        knowledge?.control?.notes,
        pk?.notes,
      ].filter((n): n is string => !!n);

      return {
        code: tsHex(prop.propCode),
        codeNumber: prop.propCode,
        name,
        category,
        dataType: tsHex(prop.dataType),
        readable,
        writable,
        control: deriveControl(prop.propCode, knowledge),
        runtimeControl,
        pollGroup,
        pollReason: knowledge?.pollingReason ?? null,
        current: prop.currentValue,
        currentHex: tsHex(prop.currentValue, prop.currentValue > 0xFFFF ? 8 : 4),
        currentDecoded: decoded,
        default: prop.defaultValue,
        defaultHex: tsHex(prop.defaultValue, prop.defaultValue > 0xFFFF ? 8 : 4),
        defaultDecoded,
        enumValues: prop.enumValues.map(value => ({
          value,
          hex: tsHex(value, value > 0xFFFF ? 8 : 4),
          label: decodeProp(value),
          current: value === prop.currentValue,
        })),
        range: prop.range ?? null,
        uiRelevant,
        alertRelevant,
        presetRelevant: knowledge?.capability?.presetRelevant ?? false,
        capabilityId: knowledge?.capability?.id ?? pk?.semanticId ?? null,
        semantics: knowledge?.semantics ?? null,
        controlCatalog: knowledge?.control ?? null,
        notes,
        sourceFlags: {
          staticCatalog: STATIC_PROP_CATALOG.has(prop.propCode),
          capabilityCatalog: !!knowledge?.capability,
          controlSemantics: !!knowledge?.semantics,
          controlCatalog: !!knowledge?.control,
          propKnowledgeLayer: !!pk,
        },
      };
    })
    .sort((a, b) => a.category.localeCompare(b.category) || a.codeNumber - b.codeNumber);

  return {
    id: state.id,
    name: state.name,
    ip: state.ip,
    connected: state.connected,
    model: state.model ?? null,
    manufacturer: client.deviceManufacturer || null,
    firmware: client.deviceFirmware || null,
    serial: client.deviceSerial || null,
    hasPollBlob: client.lastPollBlob !== null,
    pollBlobBytes: client.lastPollBlob?.length ?? 0,
    spec: spec ?? null,
    modelKnowledge: modelKnowledge ? { file: modelKnowledge.file, capabilityKeys: modelKnowledge.capabilityKeys } : null,
    runtime,
    coverage,
    props,
  };
}

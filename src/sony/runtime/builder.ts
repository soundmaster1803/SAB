/**
 * sony/runtime/builder.ts
 *
 * Builds and updates the RuntimeCameraModel from live device data.
 *
 * The builder takes live polling results (SonyLivePropEntry[]) and device
 * identity information, then:
 *   1. Filters out vendor markers (0x8000, 0x9000)
 *   2. Matches each prop code against the protocol knowledge layer
 *   3. Classifies matched props as RuntimePropDescriptor (knownProps)
 *   4. Classifies unmatched props as UnknownPropDescriptor (unknownProps)
 *   5. Derives RuntimeCapabilities from the observed prop set
 *   6. Computes poll tier membership for each prop
 *
 * The camera's live data is always authoritative. Knowledge layer enrichment
 * is additive — it never overrides observed values.
 */

import {
  getPropKnowledge,
  isVendorMarker,
  type PropKnowledgeEntry,
} from '../protocol/prop-knowledge.js';
import type { SonyLivePropEntry } from '../ptp-client.js';
import type {
  RuntimeCameraModel,
  RuntimePropDescriptor,
  UnknownPropDescriptor,
  RuntimeCapabilities,
  SafetyLevel,
  PollPriority,
  UIWidget,
} from './types.js';

// ─── Identity helpers ─────────────────────────────────────────────────────────

export interface CameraIdentity {
  cameraId: string;
  model: string;
  firmware: string;
  manufacturer: string;
  serial: string;
}

function detectPtpVersion(model: string, firmware: string): { ptpVersion: string; sessionMode: 'ptp2' | 'ptp3' } {
  // PTP3 cameras include model families: FX30, ZV-E10 II, FX6 (newer FW), FX3, A7 IV+
  // This is a best-effort heuristic based on known model strings.
  // The runtime model enriches this if we observe PTP3-only prop codes.
  const ptpModels = /FX30|FX3|FX6|ZV-E10M2|ZV-E10 II|A7 IV|A7R V|A7C II|A1|A9 III|Z200|PXW-Z200/i;
  if (ptpModels.test(model)) {
    return { ptpVersion: 'PTP3', sessionMode: 'ptp3' };
  }
  return { ptpVersion: 'PTP2', sessionMode: 'ptp2' };
}

// ─── Safety derivation ────────────────────────────────────────────────────────

function deriveSafety(knowledge: PropKnowledgeEntry | null, writable: boolean): SafetyLevel {
  if (knowledge) return knowledge.safety;
  if (!writable) return 'read-only';
  return 'safe'; // unknown writable props default to safe with caution
}

function derivePollPriority(knowledge: PropKnowledgeEntry | null): PollPriority {
  if (knowledge) return knowledge.pollPriority;
  return 'on-demand'; // unknown props: do not poll automatically
}

function deriveUiWidget(knowledge: PropKnowledgeEntry | null, writable: boolean): UIWidget {
  if (knowledge) return knowledge.uiWidget;
  return writable ? 'debug-only' : 'debug-only';
}

// ─── Capability derivation ────────────────────────────────────────────────────

const CAPABILITY_PROP_MAP: ReadonlyArray<[keyof RuntimeCapabilities, number[]]> = [
  ['hasISO',               [0xD21E]],
  ['hasShutter',           [0xD20D]],
  ['hasFNumber',           [0x5007]],
  ['hasExpComp',           [0x5010]],
  ['hasExposureMode',      [0x500E]],
  ['hasRecState',          [0xD21D]],
  ['hasMovieRecButton',    [0xD2C8]],
  ['hasBattery',           [0xD218]],
  ['hasFocusMode',         [0x500A]],
  ['hasMfNearFar',         [0xD2D1]],
  ['hasFocusPosition',     [0xE042, 0xE043]],
  ['hasSubjectRecognition',[0xD060, 0xD157]],
  ['hasAfTransitionSpeed', [0xD061]],
  ['hasWhiteBalance',      [0x5005]],
  ['hasColorTemp',         [0xD20F]],
  ['hasWbTint',            [0xD21C, 0xD210]],
  ['hasTouchOperation',    [0xD047]],
  ['hasMonitorLut',        [0xD04D]],
  ['hasGammaDisplayAssist',[0xD1FE]],
  ['hasHdmiOsd',           [0xD079]],
  ['hasHdmiTimecodeControl',[0xD186]],
  ['hasSilentMode',        [0xD0DB]],
  ['hasStabilization',     [0xD0DA]],
  ['hasPictureProfile',    [0xD23F]],
  ['hasCreativeLook',      [0xD0FA]],
  ['hasSAndQ',             [0xD052, 0xD0D0]],
  ['hasIntervalRec',       [0xD055]],
  ['hasUserBits',          [0xD0D4, 0xD0D8]],
  ['hasFocusBracketing',   [0xD0AB]],
  ['hasTallyLamps',        [0xD513]],
  ['hasStreaming',         [0xD450, 0xD456]],
  ['hasNdFilter',          [0xD018]],
  ['hasBodyKeyLock',       [0xD04A]],
];

function deriveCapabilities(observedCodes: Set<number>): RuntimeCapabilities {
  const caps: Partial<RuntimeCapabilities> = {};
  for (const [flag, codes] of CAPABILITY_PROP_MAP) {
    caps[flag] = codes.some(code => observedCodes.has(code));
  }
  return caps as RuntimeCapabilities;
}

// ─── Poll tier assignment ─────────────────────────────────────────────────────

function assignPollTiers(knownProps: Map<number, RuntimePropDescriptor>): {
  highPriorityProps: number[];
  lowPriorityProps: number[];
  onDemandProps: number[];
  skipProps: number[];
} {
  const high: number[] = [];
  const low: number[] = [];
  const onDemand: number[] = [];
  const skip: number[] = [];

  for (const [code, prop] of knownProps) {
    switch (prop.pollPriority) {
      case 'high':      high.push(code); break;
      case 'low':       low.push(code); break;
      case 'on-demand': onDemand.push(code); break;
      case 'skip':      skip.push(code); break;
    }
  }

  high.sort((a, b) => a - b);
  low.sort((a, b) => a - b);
  onDemand.sort((a, b) => a - b);
  skip.sort((a, b) => a - b);

  return { highPriorityProps: high, lowPriorityProps: low, onDemandProps: onDemand, skipProps: skip };
}

// ─── Build ────────────────────────────────────────────────────────────────────

/**
 * Build a RuntimeCameraModel from live device data.
 *
 * Call this once at connect time with the results of the first full poll scan.
 * Update it subsequently via `updateRuntimeModel()` on each polling cycle.
 *
 * @param identity    Camera identity fields from GetDeviceInfo
 * @param liveProps   All prop entries from the first scanAllProps() result
 * @returns           A fresh RuntimeCameraModel
 */
export function buildRuntimeCameraModel(
  identity: CameraIdentity,
  liveProps: SonyLivePropEntry[],
): RuntimeCameraModel {
  const now = Date.now();
  const { ptpVersion, sessionMode } = detectPtpVersion(identity.model, identity.firmware);

  const knownProps = new Map<number, RuntimePropDescriptor>();
  const unknownProps = new Map<number, UnknownPropDescriptor>();

  for (const entry of liveProps) {
    const { propCode } = entry;

    // Skip vendor extension base markers — they are not camera properties
    if (isVendorMarker(propCode)) continue;

    const knowledge = getPropKnowledge(propCode);

    if (knowledge) {
      // Known prop: enrich and classify
      const writable = knowledge.writable;
      const descriptor: RuntimePropDescriptor = {
        propCode,
        dataType: entry.dataType,
        currentValue: entry.currentValue,
        defaultValue: entry.defaultValue,
        formFlag: entry.formFlag,
        enumValues: entry.enumValues,
        ...(entry.range ? { range: entry.range } : {}),
        knowledge,
        source: 'live+enriched',
        observed: true,
        safety: deriveSafety(knowledge, writable),
        pollPriority: derivePollPriority(knowledge),
        uiWidget: deriveUiWidget(knowledge, writable),
        writable,
      };
      knownProps.set(propCode, descriptor);
    } else {
      // Unknown prop: preserve with full raw detail
      const modelContext = `${identity.model} fw=${identity.firmware}`;
      const descriptor: UnknownPropDescriptor = {
        propCode,
        dataType: entry.dataType,
        currentValue: entry.currentValue,
        defaultValue: entry.defaultValue,
        formFlag: entry.formFlag,
        enumValues: entry.enumValues,
        ...(entry.range ? { range: entry.range } : {}),
        protocolVersion: ptpVersion,
        modelContext,
        confidence: 'unknown',
        safeToWrite: false,
        visibility: 'debug',
        promotionState: 'unknown',
      };
      unknownProps.set(propCode, descriptor);
    }
  }

  const observedCodes = new Set([...knownProps.keys(), ...unknownProps.keys()]);
  const capabilities = deriveCapabilities(observedCodes);
  const tiers = assignPollTiers(knownProps);

  return {
    cameraId: identity.cameraId,
    model: identity.model,
    firmware: identity.firmware,
    manufacturer: identity.manufacturer,
    serial: identity.serial,
    ptpVersion,
    sessionMode,
    builtAt: now,
    lastUpdatedAt: now,
    knownProps,
    unknownProps,
    capabilities,
    ...tiers,
  };
}

/**
 * Update an existing RuntimeCameraModel with new polling data.
 *
 * Only updates currentValue fields — does not reclassify props or change
 * poll tier assignments. Call `buildRuntimeCameraModel` to fully rebuild.
 *
 * Unknown prop codes that appear for the first time in an update cycle
 * are added to `unknownProps`.
 *
 * @param model     The existing RuntimeCameraModel to update (mutated in place)
 * @param liveProps Fresh prop entries from the latest scanAllProps() result
 */
export function updateRuntimeModel(
  model: RuntimeCameraModel,
  liveProps: SonyLivePropEntry[],
): void {
  model.lastUpdatedAt = Date.now();

  for (const entry of liveProps) {
    const { propCode } = entry;
    if (isVendorMarker(propCode)) continue;

    const known = model.knownProps.get(propCode);
    if (known) {
      // Update live value; preserve everything else
      known.currentValue = entry.currentValue;
      if (entry.enumValues.length > 0) {
        known.enumValues = entry.enumValues;
      }
      if (entry.range) {
        known.range = entry.range;
      }
      continue;
    }

    const unknown = model.unknownProps.get(propCode);
    if (unknown) {
      unknown.currentValue = entry.currentValue;
      continue;
    }

    // New unknown prop appearing after initial build
    const modelContext = `${model.model} fw=${model.firmware}`;
    model.unknownProps.set(propCode, {
      propCode,
      dataType: entry.dataType,
      currentValue: entry.currentValue,
      defaultValue: entry.defaultValue,
      formFlag: entry.formFlag,
      enumValues: entry.enumValues,
      ...(entry.range ? { range: entry.range } : {}),
      protocolVersion: model.ptpVersion,
      modelContext,
      confidence: 'unknown',
      safeToWrite: false,
      visibility: 'debug',
      promotionState: 'unknown',
    });
  }
}

// ─── Serialisation helpers ────────────────────────────────────────────────────

/**
 * Serialize a RuntimeCameraModel to a plain JSON-compatible object.
 * Maps are converted to arrays for transport.
 */
export function serializeRuntimeModel(model: RuntimeCameraModel): object {
  return {
    cameraId: model.cameraId,
    model: model.model,
    firmware: model.firmware,
    manufacturer: model.manufacturer,
    serial: model.serial,
    ptpVersion: model.ptpVersion,
    sessionMode: model.sessionMode,
    builtAt: model.builtAt,
    lastUpdatedAt: model.lastUpdatedAt,
    capabilities: model.capabilities,
    pollTiers: {
      high: model.highPriorityProps,
      low: model.lowPriorityProps,
      onDemand: model.onDemandProps,
      skip: model.skipProps,
    },
    knownPropCount: model.knownProps.size,
    unknownPropCount: model.unknownProps.size,
    knownProps: [...model.knownProps.values()].map(p => ({
      propCode: `0x${p.propCode.toString(16).toUpperCase().padStart(4, '0')}`,
      propCodeNum: p.propCode,
      name: p.knowledge?.name ?? `Unknown_0x${p.propCode.toString(16).toUpperCase()}`,
      semanticId: p.knowledge?.semanticId ?? null,
      category: p.knowledge?.category ?? 'other',
      dataType: p.dataType,
      currentValue: p.currentValue,
      currentValueHex: `0x${(p.currentValue >>> 0).toString(16).toUpperCase().padStart(p.currentValue > 0xFFFF ? 8 : 4, '0')}`,
      defaultValue: p.defaultValue,
      formFlag: p.formFlag,
      enumValues: p.enumValues.map(v => ({
        value: v,
        hex: `0x${(v >>> 0).toString(16).toUpperCase().padStart(v > 0xFFFF ? 8 : 4, '0')}`,
        label: p.knowledge?.enumDecoding?.[v] ?? null,
        current: v === p.currentValue,
      })),
      range: p.range ?? null,
      source: p.source,
      safety: p.safety,
      pollPriority: p.pollPriority,
      uiWidget: p.uiWidget,
      writable: p.writable,
      confidence: p.knowledge?.confidence ?? 'unknown',
      alertRelevant: p.knowledge?.alertRelevant ?? false,
      notes: p.knowledge?.notes ?? null,
    })).sort((a, b) => a.propCodeNum - b.propCodeNum),
    unknownProps: [...model.unknownProps.values()].map(p => ({
      propCode: `0x${p.propCode.toString(16).toUpperCase().padStart(4, '0')}`,
      propCodeNum: p.propCode,
      dataType: p.dataType,
      currentValue: p.currentValue,
      currentValueHex: `0x${(p.currentValue >>> 0).toString(16).toUpperCase().padStart(p.currentValue > 0xFFFF ? 8 : 4, '0')}`,
      defaultValue: p.defaultValue,
      formFlag: p.formFlag,
      enumValues: p.enumValues,
      range: p.range ?? null,
      protocolVersion: p.protocolVersion ?? null,
      modelContext: p.modelContext ?? null,
      confidence: p.confidence,
      safeToWrite: p.safeToWrite,
      visibility: p.visibility,
      promotionState: p.promotionState,
      candidateInterpretation: p.candidateInterpretation ?? null,
    })).sort((a, b) => a.propCodeNum - b.propCodeNum),
  };
}

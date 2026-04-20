/**
 * atem/discovery.ts
 *
 * mDNS / Bonjour discovery of Blackmagic ATEM switchers on the local network.
 *
 * Which service type do ATEM switchers advertise?
 *   Confirmed on hardware (ATEM Mini Pro, firmware 2026-era):
 *       _switcher_ctrl._udp.local.
 *       instance name = model name, e.g. "ATEM Mini Pro"
 *       hostname      = "ATEM-Mini-Pro.local."
 *       port          = 9910  (same port the control protocol uses)
 *       TXT           = { unique_id: "<32-hex>" }
 *
 *   Older Blackmagic SDK docs mention `_blackmagic._tcp.local.` — we browse
 *   that too for forward-compatibility with older or larger ATEM models.
 *
 * We browse for a bounded interval, collect responses, dedup by IPv4 address,
 * and return a list the operator can pick from in the UI. This is read-only:
 * we never connect to a discovered device here. Selection + connect remains
 * the operator's explicit action.
 */
import { Bonjour, type BrowserConfig, type Service } from 'bonjour-service';

export interface DiscoveredAtem {
  /** First IPv4 address advertised by the device. */
  ip: string;
  /** mDNS service instance name. For ATEM Mini family this IS the model name. */
  name: string;
  /** mDNS hostname, trailing dot stripped (e.g. "ATEM-Mini-Pro.local"). */
  hostname: string;
  /** Advertised port (ATEM control protocol uses 9910). */
  port: number;
  /** Best-effort model hint from TXT record, if present. */
  model?: string;
  /** Unique device id from TXT (`unique_id`), used to distinguish same-model devices. */
  uniqueId?: string;
  /** Firmware version from TXT record, if present. */
  firmware?: string;
}

const IPV4_RE = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

/**
 * Known Blackmagic switcher service types. Order matters for log readability;
 * dedup is by IPv4 so a device that answers on multiple types is merged.
 *
 * If you ever add a new family (e.g. Constellation, 4 M/E), confirm the
 * service type with `dns-sd -B <type>._<proto> local.` on a machine with the
 * device on the LAN and add the entry here.
 */
const SERVICE_TYPES: BrowserConfig[] = [
  { type: 'switcher_ctrl', protocol: 'udp' }, // ATEM Mini / Mini Pro / Extreme (confirmed)
  { type: 'blackmagic',    protocol: 'tcp' }, // Legacy (per Blackmagic SDK docs)
];

function pickModelFromTxt(txt: unknown): string | undefined {
  if (!txt || typeof txt !== 'object') return undefined;
  const t = txt as Record<string, unknown>;
  const candidates = ['model', 'type', 'product', 'productname', 'productName'];
  for (const k of candidates) {
    const v = t[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
}

function pickUniqueIdFromTxt(txt: unknown): string | undefined {
  if (!txt || typeof txt !== 'object') return undefined;
  const t = txt as Record<string, unknown>;
  const candidates = ['unique_id', 'uniqueId', 'uid', 'id'];
  for (const k of candidates) {
    const v = t[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
}

function pickFirmwareFromTxt(txt: unknown): string | undefined {
  if (!txt || typeof txt !== 'object') return undefined;
  const t = txt as Record<string, unknown>;
  const candidates = ['firmware', 'version', 'fw', 'ver'];
  for (const k of candidates) {
    const v = t[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
}

/**
 * Browse for ATEM switchers on the LAN for `timeoutMs` and return the
 * accumulated list. Always resolves (never rejects) — failures are logged
 * and produce an empty array so the UI can display a "no devices" state
 * cleanly.
 */
export function discoverAtems(timeoutMs = 3000): Promise<DiscoveredAtem[]> {
  return new Promise((resolve) => {
    const found = new Map<string, DiscoveredAtem>();
    let bonjour: Bonjour | null = null;
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      try { bonjour?.destroy(); } catch { /* noop */ }
      resolve(Array.from(found.values()));
    };

    const onService = (svc: Service) => {
      const ipv4 = (svc.addresses ?? []).find((a) => IPV4_RE.test(a));
      if (!ipv4) return;
      if (found.has(ipv4)) return;
      const entry: DiscoveredAtem = {
        ip: ipv4,
        name: svc.name || 'ATEM',
        hostname: (svc.host || '').replace(/\.$/, ''),
        port: svc.port || 9910,
      };
      // For the _switcher_ctrl family the service instance name is already the
      // human model ("ATEM Mini Pro"). Prefer an explicit TXT hint when
      // present, otherwise fall back to the instance name.
      const modelHint = pickModelFromTxt(svc.txt) ?? svc.name;
      if (modelHint) entry.model = modelHint;
      const uid = pickUniqueIdFromTxt(svc.txt);
      if (uid) entry.uniqueId = uid;
      const fw = pickFirmwareFromTxt(svc.txt);
      if (fw) entry.firmware = fw;
      found.set(ipv4, entry);
    };

    try {
      bonjour = new Bonjour();
      for (const cfg of SERVICE_TYPES) {
        const browser = bonjour.find(cfg, onService);
        browser.on?.('error', () => { /* swallow — return what we have */ });
      }
    } catch (e) {
      // mDNS socket bind failures (sandbox / permissions) — return empty.
      console.warn(`[atem/discovery] mDNS init failed: ${(e as Error).message}`);
      finish();
      return;
    }

    setTimeout(finish, Math.max(250, timeoutMs));
  });
}

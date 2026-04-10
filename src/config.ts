import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

export interface CameraConfig {
  id: string;
  name: string;
  ip: string;
  atemInput: number;
  atemControlEnabled: boolean;
  guid?: string;
}

export interface AppConfig {
  atemIp: string;
  cameras: CameraConfig[];
}

// Anchor config.json to the location of the running file, not cwd.
// - ESM dev (tsx src/index.ts): import.meta.url = file:///…/src/config.ts → one level up = project root
// - CJS bundle (node dist/bridge.cjs): import.meta is empty — fall back to process.argv[1]
let CONFIG_PATH: string;
try {
  const __filename = fileURLToPath(import.meta.url);   // throws in CJS bundle
  CONFIG_PATH = join(dirname(__filename), '../config.json');
} catch {
  // CJS bundle: argv[1] is the path to bridge.cjs; config.json lives one dir up (project root / Beta dir)
  CONFIG_PATH = join(dirname(process.argv[1] ?? ''), '../config.json');
}

const DEFAULT_CONFIG: AppConfig = {
  atemIp: '',
  cameras: [],
};

export function loadConfig(): AppConfig {
  if (!fs.existsSync(CONFIG_PATH)) {
    saveConfig(DEFAULT_CONFIG);
    return { ...DEFAULT_CONFIG, cameras: [] };
  }
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(raw) as AppConfig;
  } catch {
    console.error('[Config] Failed to parse config.json, using defaults');
    return { ...DEFAULT_CONFIG, cameras: [] };
  }
}

export function saveConfig(config: AppConfig): void {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

export function addCamera(config: AppConfig, camera: CameraConfig): AppConfig {
  const updated = { ...config, cameras: [...config.cameras, camera] };
  saveConfig(updated);
  return updated;
}

export function removeCamera(config: AppConfig, id: string): AppConfig {
  const updated = { ...config, cameras: config.cameras.filter(c => c.id !== id) };
  saveConfig(updated);
  return updated;
}

export function updateCameraGuid(id: string, guid: string): void {
  const config = loadConfig();
  const cam = config.cameras.find(c => c.id === id);
  if (cam) {
    cam.guid = guid;
    saveConfig(config);
  }
}

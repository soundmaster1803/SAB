import * as crypto from 'crypto';
import { EventEmitter } from 'events';
import { SonyPTPClient, type CameraState } from './ptp-client';
import type { CameraConfig } from '../config';
import { updateCameraGuid } from '../config';

export type { CameraConfig };

function ts(): string { return new Date().toISOString().slice(11, 23); }
function log(msg: string)  { console.log(`[${ts()}] [Manager] ${msg}`); }
function err(msg: string)  { console.error(`[${ts()}] [Manager] ERROR: ${msg}`); }

const RECONNECT_DELAY_MS = 5000;

export class CameraManager extends EventEmitter {
  private clients = new Map<string, SonyPTPClient>();
  private configs = new Map<string, CameraConfig>();

  constructor() {
    super();
    log('CameraManager ready');
  }

  addCamera(config: CameraConfig): void {
    let guid: Buffer;
    if (config.guid) {
      guid = Buffer.from(config.guid, 'hex');
    } else {
      guid = crypto.randomBytes(16);
      config.guid = guid.toString('hex');
      updateCameraGuid(config.id, config.guid);
    }

    const client = new SonyPTPClient(config.ip, guid);
    client.state.id   = config.id;
    client.state.name = config.name;
    this.clients.set(config.id, client);
    this.configs.set(config.id, config);

    client.on('stateUpdate', () => {
      this.emit('camerasStateChanged', this.getAllStates());
    });

    this.emit('cameraAdded', client, config);
    this.connectWithRetry(client, config);
  }

  private connectWithRetry(client: SonyPTPClient, config: CameraConfig): void {
    log(`Connecting to "${config.name}" @ ${config.ip}...`);
    client.connect()
      .then(() => {
        client.state.connected = true;
        client.startPolling(200);
        log(`"${config.name}" is ONLINE (${config.ip})`);

        // Auto-reconnect when the camera drops connection after a successful connect.
        // Uses stateUpdate because ptp-client emits it (with connected=false) on socket close.
        const onStateUpdate = () => {
          if (client.state.connected) return;
          // Camera was removed — don't reconnect
          if (!this.clients.has(config.id) || this.clients.get(config.id) !== client) {
            client.off('stateUpdate', onStateUpdate);
            return;
          }
          client.off('stateUpdate', onStateUpdate);
          log(`"${config.name}" dropped — reconnecting in ${RECONNECT_DELAY_MS / 1000}s`);
          setTimeout(() => {
            if (this.clients.has(config.id) && this.clients.get(config.id) === client) {
              this.connectWithRetry(client, config);
            }
          }, RECONNECT_DELAY_MS);
        };
        client.on('stateUpdate', onStateUpdate);
      })
      .catch((e: Error) => {
        err(`"${config.name}" (${config.ip}) connect FAILED: ${e.message}`);
        if (this.clients.has(config.id)) {
          log(`"${config.name}" — retry in ${RECONNECT_DELAY_MS / 1000}s`);
          setTimeout(() => {
            if (this.clients.has(config.id)) {
              this.connectWithRetry(client, config);
            }
          }, RECONNECT_DELAY_MS);
        }
      });
  }

  addConnectedClient(config: CameraConfig, client: SonyPTPClient): void {
    client.state.id   = config.id;
    client.state.name = config.name;
    client.state.connected = true;
    this.clients.set(config.id, client);
    this.configs.set(config.id, config);
    client.startPolling(200);
    client.on('stateUpdate', () => {
      this.emit('camerasStateChanged', this.getAllStates());
    });
    log(`"${config.name}" added as pre-connected client`);
  }

  removeCamera(id: string): void {
    const client = this.clients.get(id);
    const config = this.configs.get(id);
    if (!client) { log(`removeCamera: "${id}" already removed`); return; }
    log(`Removing camera "${config?.name ?? id}"`);
    // Remove from maps first so the reconnect timer check fails immediately.
    this.clients.delete(id);
    this.configs.delete(id);
    // Stop polling and detach all listeners before tearing down the socket
    // so no stateUpdate events or error logs fire after removal.
    client.stopPolling();
    client.removeAllListeners();
    client.disconnect();
    log(`Camera "${config?.name ?? id}" removed`);
  }

  updateCameraConfig(id: string, partial: Partial<CameraConfig>): void {
    const cfg = this.configs.get(id);
    if (!cfg) { err(`updateCameraConfig: camera "${id}" not found`); return; }
    Object.assign(cfg, partial);
    log(`Config updated for "${cfg.name}": ${JSON.stringify(partial)}`);
  }

  findByAtemInput(atemInput: number): { client: SonyPTPClient; config: CameraConfig } | null {
    for (const [id, cfg] of this.configs) {
      if (cfg.atemInput === atemInput) {
        return { client: this.clients.get(id)!, config: cfg };
      }
    }
    return null;
  }

  getClient(id: string): SonyPTPClient | undefined {
    return this.clients.get(id);
  }

  async startAllRecording(): Promise<void> {
    const tasks: Promise<void>[] = [];
    for (const client of this.clients.values()) {
      if (client.state.connected && client.state.recState !== 1) {
        tasks.push(client.toggleRecord().catch((e: Error) => err(`startAllRecording toggleRecord failed: ${e.message}`)));
      }
    }
    await Promise.all(tasks);
  }

  async stopAllRecording(): Promise<void> {
    const tasks: Promise<void>[] = [];
    for (const client of this.clients.values()) {
      if (client.state.connected && client.state.recState === 1) {
        tasks.push(client.toggleRecord().catch((e: Error) => err(`stopAllRecording toggleRecord failed: ${e.message}`)));
      }
    }
    await Promise.all(tasks);
  }

  getAllStates(): CameraState[] {
    return Array.from(this.clients.values()).map(c => c.state);
  }

  getAllConfigs(): CameraConfig[] {
    return Array.from(this.configs.values());
  }
}

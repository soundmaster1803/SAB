/**
 * api/ws/broadcaster.ts
 *
 * WebSocket server setup and state/log broadcast for the operator UI.
 *
 * Responsibilities:
 *   - Create and configure the WebSocketServer (shares the HTTP server port)
 *   - Handle client connect / disconnect / error lifecycle
 *   - Batch and flush log entries to WS clients (150ms window)
 *   - Broadcast full camera + ATEM state every 500ms
 *
 * Does not own:
 *   - Express app or HTTP route registration
 *   - Camera or ATEM config mutations
 *   - View-model formatting (delegates to api/viewmodels/camera)
 */

import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import type { CameraManager } from '../../sony/manager';
import type { ATEMListener } from '../../atem/listener';
import type { AppConfig } from '../../config';
import { logBus } from '../../logger';
import { deriveATEMState } from '../../atem/state/derived';
import { uiState } from '../viewmodels/camera';

function ts(): string { return new Date().toISOString().slice(11, 23); }
function log(msg: string) { console.log(`[${ts()}] [WS] ${msg}`); }
function err(msg: string) { console.error(`[${ts()}] [WS] ERROR: ${msg}`); }

export interface BroadcasterOptions {
  /** The http.Server that the WSS will piggyback on (shared port). */
  server: http.Server;
  manager: CameraManager;
  atemListener: ATEMListener;
  /**
   * Getter for the current app config.
   * A getter is required because route handlers reassign appConfig (addCamera, etc.)
   * and the broadcast loop must always read the live reference.
   */
  getAppConfig: () => AppConfig;
  /** App version string injected from package.json, included in every state message. */
  appVersion: string;
}

/**
 * Wire up the WebSocket server and start broadcasting.
 * Returns the WebSocketServer instance for callers that need it.
 */
export function createBroadcaster({
  server,
  manager,
  atemListener,
  getAppConfig,
  appVersion,
}: BroadcasterOptions): WebSocketServer {

  // ── WebSocket server — shares port 7777 with HTTP ──────────────────────────
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws, req) => {
    log(`Client connected from ${req.socket.remoteAddress}`);
    ws.on('close', () => log('Client disconnected'));
    ws.on('error', (e) => err(`Client error: ${e.message}`));
  });
  wss.on('error', (e) => err(`WebSocketServer error: ${e.message}`));

  // ── Log broadcast — batched, 150ms flush window ───────────────────────────
  // Prevents flooding WS clients at 25+ msg/sec during active ATEM control.
  // If no clients are connected the batch is simply discarded.
  let _logBatch: Array<{ category: string; text: string; timestamp: string }> = [];
  let _logTimer: ReturnType<typeof setTimeout> | null = null;

  logBus.on('log', (entry: { category: string; text: string; timestamp: string }) => {
    _logBatch.push(entry);
    if (!_logTimer) {
      _logTimer = setTimeout(() => {
        if (_logBatch.length > 0 && wss.clients.size > 0) {
          const msg = JSON.stringify({ type: 'logs', entries: _logBatch });
          wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(msg); });
        }
        _logBatch = [];
        _logTimer = null;
      }, 150);
    }
  });

  // ── State broadcast — every 500ms ─────────────────────────────────────────
  setInterval(() => {
    const appConfig = getAppConfig();
    const atemRaw = atemListener.getRawState();
    const atemDerived = deriveATEMState(atemRaw);

    // O(1) per camera — build lookup map once per broadcast instead of O(n²) find()
    const cfgMap = new Map<string, any>(appConfig.cameras?.map((c: any) => [c.id, c]) ?? []);

    const msg = JSON.stringify({
      type: 'state',
      version: appVersion,
      cameras: manager.getAllStates().map(state => {
        const cfg = cfgMap.get(state.id);
        return { ...uiState(state), atemInput: cfg?.atemInput ?? 0, atemControlEnabled: cfg?.atemControlEnabled ?? false };
      }),
      atemIp: appConfig.atemIp,
      atemConnected: atemRaw.connected,
      atemModel: atemRaw.model,
      inputCount: atemRaw.knownInputIds.length,
      tally: atemDerived.tally,
      topology: atemDerived.topology,
    });
    wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(msg); });
  }, 500);

  return wss;
}

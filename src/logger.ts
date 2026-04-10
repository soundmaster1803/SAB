import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

const LOG_PATH     = path.resolve(process.cwd(), 'logs.txt');
const LOG_PATH_OLD = LOG_PATH + '.old';
const LOG_MAX_BYTES = 5 * 1024 * 1024; // rotate at 5 MB

const KNOWN_CATEGORIES = ['[ATEM]', '[SONY]', '[RAW]', '[BRIDGE]', '[UI]'];

function parseCategory(line: string): string {
  for (const cat of KNOWN_CATEGORIES) {
    if (line.includes(cat)) return cat.slice(1, -1);
  }
  return 'SYSTEM';
}

// Emits 'log' events: { category, text, timestamp }
// Server subscribes and broadcasts to WS clients.
export const logBus = new EventEmitter();
logBus.setMaxListeners(20);

// ── Async write stream ─────────────────────────────────────────────────────
let _stream: fs.WriteStream | null = null;
let _bytesWritten = 0;

function getStream(): fs.WriteStream {
  if (!_stream) {
    _stream = fs.createWriteStream(LOG_PATH, { flags: 'a' });
    _stream.on('error', () => {}); // swallow FS errors — don't crash the app
  }
  return _stream;
}

function rotateIfNeeded(): void {
  if (_bytesWritten < LOG_MAX_BYTES) return;
  if (_stream) { _stream.end(); _stream = null; }
  try { fs.renameSync(LOG_PATH, LOG_PATH_OLD); } catch (_e) {}
  _bytesWritten = 0;
}

export function initLogger(): void {
  const header = `${'═'.repeat(60)}\nSession started: ${new Date().toISOString()}\n${'═'.repeat(60)}\n`;
  try { fs.writeFileSync(LOG_PATH, header); } catch (_e) {}
  _bytesWritten = header.length;

  const _log   = console.log.bind(console);
  const _warn  = console.warn.bind(console);
  const _error = console.error.bind(console);

  const write = (prefix: string, args: unknown[]) => {
    const line = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
    const ts = new Date().toISOString().slice(11, 23);
    const clean = line.replace(/^\[\d{2}:\d{2}:\d{2}\.\d{3}\]\s*/, '');
    const full = `[${ts}]${prefix} ${clean}\n`;

    rotateIfNeeded();
    _bytesWritten += full.length;
    getStream().write(full); // non-blocking async write

    const category = parseCategory(full);
    logBus.emit('log', { category, text: clean, timestamp: `[${ts}]` });
  };

  console.log   = (...args: unknown[]) => { _log(...args);   write('',      args); };
  console.warn  = (...args: unknown[]) => { _warn(...args);  write(' WARN', args); };
  console.error = (...args: unknown[]) => { _error(...args); write(' ERR',  args); };
}

export function appendLog(msg: string): void {
  const ts = new Date().toISOString().slice(11, 23);
  const full = `[${ts}] [UI] >> ${msg}\n`;
  rotateIfNeeded();
  _bytesWritten += full.length;
  getStream().write(full);
  logBus.emit('log', { category: 'UI', text: msg, timestamp: `[${ts}]` });
}

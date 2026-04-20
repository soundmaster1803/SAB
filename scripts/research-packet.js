#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const query = args.join(' ').trim();

if (!query) {
  console.error('Usage: node scripts/research-packet.js "your research query"');
  process.exit(1);
}

const lower = query.toLowerCase();

function hasAny(words) {
  return words.some((w) => lower.includes(w));
}

let domain = 'general';
if (hasAny(['sony', 'ptp', 'camera', 'focus', 'iris', 'iso', 'shutter', 'wb'])) domain = 'sony';
else if (hasAny(['atem', 'switcher', 'tally', 'discovery', 'mdns'])) domain = 'atem';
else if (hasAny(['bridge', 'intent', 'mapping', 'anti-loop', 'sync'])) domain = 'bridge';
else if (hasAny(['ui', 'panel', 'layout', 'css'])) domain = 'ui';
else if (hasAny(['api', 'route', 'endpoint', 'websocket', 'ws'])) domain = 'api';

let source = 'local-notes';
if (hasAny(['pdf', 'manual', 'reference', 'protocol', 'api doc'])) source = 'open-notebooklm';

const packet = {
  query,
  source,
  domain,
  expectedFormat: 'short-summary-with-excerpts',
  maxChars: 4000,
  needExactNames: hasAny(['exact', 'точн', 'prop', 'code', 'command', 'field']),
  suggestedLocalPaths: domain === 'sony'
    ? ['knowledge/protocol/sony/']
    : domain === 'atem'
    ? ['knowledge/protocol/atem/']
    : ['knowledge/protocol/'],
};

console.log(JSON.stringify(packet, null, 2));

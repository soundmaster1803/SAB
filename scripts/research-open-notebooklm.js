#!/usr/bin/env node
const fs = require('fs');

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  let packet;
  try {
    packet = JSON.parse(input || '{}');
  } catch (e) {
    console.error('Expected JSON packet on stdin');
    process.exit(1);
  }

  const result = {
    source: packet.source || 'open-notebooklm',
    status: 'stub',
    message: 'Binding stub only. Connect this script to local Open NotebookLM interface.',
    query: packet.query || null,
    expectedFormat: packet.expectedFormat || null,
    nextStep: 'Implement local tool call and normalize result into summary/excerpts format.'
  };

  console.log(JSON.stringify(result, null, 2));
});

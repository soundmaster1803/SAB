#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const task = process.argv.slice(2).join(' ').trim();
if (!task) {
  console.error('Usage: node scripts/execution-packet.js "your task here"');
  process.exit(1);
}

const routerPath = path.join(process.cwd(), 'scripts', 'task-router.js');
const { execFileSync } = require('child_process');
const raw = execFileSync('node', [routerPath, task], { encoding: 'utf8' });
const router = JSON.parse(raw);

const packet = {
  task: router.task,
  executor: router.recommendedExecutor,
  readFirst: router.readFirst,
  candidateFiles: router.candidateFiles,
  knowledgeSources: router.knowledgeSources,
  constraints: router.constraints,
  validation: router.validation,
  instructions: [
    'Classify task and confirm scope from provided docs only',
    'Read only the listed docs and then only the necessary source files',
    'Do not use dist/ or public/ as source of truth',
    'Make minimal changes only',
    'Run validation after changes',
    'Summarize changed files and risks briefly'
  ]
};

console.log(JSON.stringify(packet, null, 2));

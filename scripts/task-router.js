#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const task = process.argv.slice(2).join(' ').trim();

if (!task) {
  console.error('Usage: node scripts/task-router.js "your task here"');
  process.exit(1);
}

const configPath = path.join(ROOT, 'router.config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const lower = task.toLowerCase();

function hasAny(words) {
  return words.some((w) => lower.includes(w));
}

function uniq(arr) {
  return [...new Set(arr)];
}

const matches = [];

if (hasAny(['ui', 'интерфейс', 'кнопк', 'панел', 'css', 'layout', 'верст', 'стил'])) matches.push('ui');
if (hasAny(['api', 'route', 'endpoint', 'роут', 'эндпоинт', 'websocket', 'ws', 'glue'])) matches.push('api');
if (hasAny(['atem', 'switcher', 'свитчер', 'tally', 'discovery', 'mdns'])) matches.push('atem');
if (hasAny(['sony', 'camera', 'камера', 'ptp', 'focus', 'iris', 'iso', 'shutter', 'wb'])) matches.push('sony');
if (hasAny(['bridge', 'mapping', 'intent', 'anti-loop', 'throttle', 'sync'])) matches.push('bridge');

const taskTypes = matches.length ? uniq(matches) : ['general'];
if (taskTypes.includes('ui') && taskTypes.includes('api')) taskTypes.push('ui_api_glue');

let readFirst = [...config.defaultReadFirst];
let candidateFiles = [];
let validation = [];
let recommendedExecutor = 'codex';

for (const type of taskTypes) {
  const domain = config.domains[type];
  if (!domain) continue;
  readFirst.push(...domain.docs);
  candidateFiles.push(...domain.files);
  validation.push(...domain.validation);
  if (domain.executor === 'claude') recommendedExecutor = 'claude';
}

const researchHints = [];
let knowledgeSources = ['project_docs', 'code_search'];
if (hasAny(['research', 'исслед', 'почему', 'как работает', 'объясни', 'pdf', 'protocol', 'api reference'])) {
  knowledgeSources.push('protocol_docs');
  researchHints.push(`Use research layer if needed. Preferred source: ${config.research.defaultSource}`);
  if (recommendedExecutor !== 'claude') recommendedExecutor = 'local-llm';
}
if (hasAny(['архитект', 'architecture', 'refactor', 'рефактор'])) {
  knowledgeSources.push('architecture_docs');
  recommendedExecutor = 'claude';
}

const packet = {
  task,
  taskTypes: uniq(taskTypes),
  recommendedExecutor,
  readFirst: uniq(readFirst),
  knowledgeSources: uniq(knowledgeSources),
  candidateFiles: uniq(candidateFiles),
  constraints: config.doNotTouch.map((p) => `Do not use ${p} as working source/context`),
  validation: uniq(validation.length ? validation : ['npm run typecheck']),
  researchHints,
};

console.log(JSON.stringify(packet, null, 2));

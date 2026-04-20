#!/usr/bin/env node
const fs = require('fs');

const raw = fs.readFileSync(0, 'utf8').trim();
let data;
try {
  data = JSON.parse(raw);
} catch {
  console.log(JSON.stringify({ ok: false, reason: 'invalid_json', fallback: 'rule-based' }, null, 2));
  process.exit(0);
}

const allowedTaskTypes = new Set(['general','ui','api','atem','sony','bridge','research','architecture','ui_api_glue','local-simple','local-tool','cloud-complex']);
const allowedExecutors = new Set(['local-llm','local-tool','codex','claude']);

function arr(v){ return Array.isArray(v) ? v : []; }
function str(v, d=''){ return typeof v === 'string' ? v : d; }

const taskTypes = arr(data.taskTypes).map(String).filter(v => allowedTaskTypes.has(v));
const recommendedExecutor = allowedExecutors.has(data.recommendedExecutor) ? data.recommendedExecutor : 'local-llm';
const normalized = {
  ok: taskTypes.length > 0,
  taskTypes: taskTypes.length ? taskTypes : ['general'],
  recommendedExecutor,
  readFirst: arr(data.readFirst).filter(v => typeof v === 'string'),
  candidateFiles: arr(data.candidateFiles).filter(v => typeof v === 'string'),
  knowledgeSources: arr(data.knowledgeSources).filter(v => typeof v === 'string'),
  validation: arr(data.validation).filter(v => typeof v === 'string'),
  researchHints: arr(data.researchHints).filter(v => typeof v === 'string'),
  rawFallbackReason: str(data.rawFallbackReason, '')
};
console.log(JSON.stringify(normalized, null, 2));

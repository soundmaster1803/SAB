#!/usr/bin/env node
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const task = process.argv.slice(2).join(' ').trim();
if (!task) {
  console.error('Usage: node scripts/local-llm-router.js "your task here"');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'router.config.json'), 'utf8'));
const model = config.localLlm?.model || 'qwen2.5:7b-instruct';
const systemPrompt = `You are a local task router for SAB.
Return strict compact JSON only, no markdown.
Use this exact shape:
{"taskTypes":[],"recommendedExecutor":"codex","readFirst":[],"candidateFiles":[],"knowledgeSources":[],"validation":[],"researchHints":[]}
Use SAB conventions: src/ and frontend/src/ are source of truth; dist/ and public/ are not source of truth.`;

const userPrompt = `Task: ${task}`;

const payload = {
  model,
  stream: false,
  format: 'json',
  options: { num_predict: 220, temperature: 0.1 },
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ]
};

const raw = execFileSync('curl', [
  '-s',
  'http://127.0.0.1:11434/api/chat',
  '-H', 'Content-Type: application/json',
  '-d', JSON.stringify(payload)
], { encoding: 'utf8', timeout: 120000 });

const parsed = JSON.parse(raw);
let content = parsed?.message?.content || '{}';
content = content.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
try {
  const json = JSON.parse(content);
  console.log(JSON.stringify(json, null, 2));
} catch (e) {
  console.log(JSON.stringify({ raw: content }, null, 2));
}

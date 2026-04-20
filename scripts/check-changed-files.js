#!/usr/bin/env node
const { execSync } = require('child_process');

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8' }).trim();
}

const output = run('git diff --name-only');
const files = output ? output.split('\n').filter(Boolean) : [];

const risky = files.filter((f) =>
  f.startsWith('dist/') ||
  f.startsWith('public/') ||
  f.startsWith('node_modules/') ||
  f.startsWith('frontend/node_modules/') ||
  f.startsWith('.claude/')
);

const summary = {
  changedFiles: files,
  changedCount: files.length,
  riskyFiles: risky,
  riskyCount: risky.length,
  ok: risky.length === 0,
};

console.log(JSON.stringify(summary, null, 2));
if (risky.length > 0) process.exit(2);

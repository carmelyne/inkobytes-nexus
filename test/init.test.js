import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { chdir, cwd } from 'process';
import init from '../src/commands/init.js';
import doctor from '../src/commands/doctor.js';
import { resetConfig } from '../src/lib/config.js';

function inTempRepo(fn) {
  const previous = cwd();
  const root = mkdtempSync(join(tmpdir(), 'nexus-init-'));
  chdir(root);
  resetConfig();

  try {
    return fn(root);
  } finally {
    chdir(previous);
    resetConfig();
  }
}

function captureLogs(fn) {
  const originalLog = console.log;
  const lines = [];
  console.log = (...args) => lines.push(args.join(' '));

  try {
    fn();
  } finally {
    console.log = originalLog;
  }

  return lines.join('\n');
}

test('init creates managed agent guides that doctor accepts', () => {
  inTempRepo((root) => {
    captureLogs(() => init([]));

    const output = captureLogs(() => doctor([]));
    const codexGuide = readFileSync(join(root, '.codex', 'AGENTS.md'), 'utf-8');

    assert.match(output, /All checked Nexus categories are ready/);
    assert.equal(codexGuide.match(/NEXUS-AGENT-PROTOCOL:START/g).length, 1);
    assert.equal(codexGuide.match(/This project uses Nexus for multi-agent coordination\./g).length, 1);
    assert.match(codexGuide, /### Fresh File Truth/);
    assert.match(codexGuide, /cached model memory/);
  });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { chdir, cwd } from 'process';
import init from '../src/commands/init.js';
import soul from '../src/commands/soul.js';
import doctor from '../src/commands/doctor.js';
import { resetConfig } from '../src/lib/config.js';

function inTempRepo(fn) {
  const previous = cwd();
  const root = mkdtempSync(join(tmpdir(), 'nexus-soul-'));
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

test('soul creates and applies a local overlay outside doctor-managed block', () => {
  inTempRepo((root) => {
    captureLogs(() => init([]));

    captureLogs(() => soul([]));

    const overlay = readFileSync(join(root, '.nexus', 'local', 'agent-overlay.md'), 'utf-8');
    const codexGuide = readFileSync(join(root, '.codex', 'AGENTS.md'), 'utf-8');

    assert.match(overlay, /Local Soul Overlay/);
    assert.match(codexGuide, /NEXUS-LOCAL-SOUL:START \.nexus\/local\/agent-overlay\.md/);
    assert.ok(codexGuide.indexOf('NEXUS-LOCAL-SOUL:START') < codexGuide.indexOf('NEXUS-AGENT-PROTOCOL:START'));
    assert.match(captureLogs(() => doctor([])), /All checked Nexus categories are ready/);
  });
});

test('soul refreshes existing overlay blocks from local file', () => {
  inTempRepo((root) => {
    captureLogs(() => init([]));
    captureLogs(() => soul([]));

    writeFileSync(join(root, '.nexus', 'local', 'agent-overlay.md'), '# Agent Overlay\n\nWarm pair-dev tone.\n', 'utf-8');
    captureLogs(() => soul([]));

    const codexGuide = readFileSync(join(root, '.codex', 'AGENTS.md'), 'utf-8');
    assert.match(codexGuide, /Warm pair-dev tone\./);
    assert.equal(codexGuide.match(/NEXUS-LOCAL-SOUL:START/g).length, 1);
  });
});

test('soul status reports overlay state', () => {
  inTempRepo((root) => {
    captureLogs(() => init([]));
    captureLogs(() => soul([]));

    const output = captureLogs(() => soul(['--status']));

    assert.match(output, /Nexus soul status/);
    assert.match(output, /\.codex\/AGENTS\.md: applied/);
  });
});

test('soul remove deletes overlay blocks but keeps overlay file', () => {
  inTempRepo((root) => {
    captureLogs(() => init([]));
    captureLogs(() => soul([]));

    const output = captureLogs(() => soul(['--remove']));
    const codexGuide = readFileSync(join(root, '.codex', 'AGENTS.md'), 'utf-8');
    const overlay = readFileSync(join(root, '.nexus', 'local', 'agent-overlay.md'), 'utf-8');

    assert.match(output, /Removed local soul overlay/);
    assert.doesNotMatch(codexGuide, /NEXUS-LOCAL-SOUL/);
    assert.match(overlay, /Local Soul Overlay/);
  });
});

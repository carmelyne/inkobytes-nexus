import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { chdir, cwd } from 'process';
import init from '../src/commands/init.js';
import persona from '../src/commands/persona.js';
import doctor from '../src/commands/doctor.js';
import { resetConfig } from '../src/lib/config.js';

function inTempRepo(fn) {
  const previous = cwd();
  const root = mkdtempSync(join(tmpdir(), 'nexus-persona-'));
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

test('persona creates and applies a local overlay outside doctor-managed block', () => {
  inTempRepo((root) => {
    captureLogs(() => init([]));

    captureLogs(() => persona([]));

    const overlay = readFileSync(join(root, '.nexus', 'local', 'agent-overlay.md'), 'utf-8');
    const codexGuide = readFileSync(join(root, '.codex', 'AGENTS.md'), 'utf-8');

    assert.match(overlay, /Local Persona Overlay/);
    assert.match(codexGuide, /NEXUS-LOCAL-PERSONA:START \.nexus\/local\/agent-overlay\.md/);
    assert.ok(codexGuide.indexOf('NEXUS-LOCAL-PERSONA:START') < codexGuide.indexOf('NEXUS-AGENT-PROTOCOL:START'));
    assert.match(captureLogs(() => doctor([])), /All checked Nexus categories are ready/);
  });
});

test('persona refreshes existing overlay blocks from local file', () => {
  inTempRepo((root) => {
    captureLogs(() => init([]));
    captureLogs(() => persona([]));

    writeFileSync(join(root, '.nexus', 'local', 'agent-overlay.md'), '# Agent Overlay\n\nWarm pair-dev tone.\n', 'utf-8');
    captureLogs(() => persona([]));

    const codexGuide = readFileSync(join(root, '.codex', 'AGENTS.md'), 'utf-8');
    assert.match(codexGuide, /Warm pair-dev tone\./);
    assert.equal(codexGuide.match(/NEXUS-LOCAL-PERSONA:START/g).length, 1);
  });
});

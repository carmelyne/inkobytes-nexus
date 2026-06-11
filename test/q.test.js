import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { chdir, cwd } from 'process';
import q from '../src/commands/q.js';
import { resetConfig } from '../src/lib/config.js';

function inTempRepo(fn) {
  const previous = cwd();
  const root = mkdtempSync(join(tmpdir(), 'nexus-q-'));
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

test('q prints an agent lane', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_Q_CODEX.md'), `# Nexus Queue Lane - @codex

## Active

- [~] TASK/Codex: Build thing
  - Id: build-thing
  - Status: In Progress

## Completed
`, 'utf-8');

    const output = captureLogs(() => q(['@codex']));

    assert.match(output, /# Nexus Queue Lane - @codex/);
    assert.match(output, /Id: build-thing/);
  });
});

test('q done writes a lane-local receipt without mutating the master queue', () => {
  inTempRepo((root) => {
    const queue = `# Nexus Queue

## Ready Queue

- [ ] TASK/Codex: Build thing
  - Id: build-thing
  - Status: Delegated
  - Lane: _NEXUS_Q_CODEX.md
`;
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), queue, 'utf-8');
    writeFileSync(join(root, '_NEXUS_Q_CODEX.md'), `# Nexus Queue Lane - @codex

## Active

- [~] TASK/Codex: Build thing
  - Id: build-thing
  - Status: In Progress
  - Source: _NEXUS_QUEUE.md
  - Lane: _NEXUS_Q_CODEX.md
  - Receipt: pending reconciliation

## Completed
`, 'utf-8');

    const output = captureLogs(() => q(['done', 'build-thing', '@codex']));
    const lane = readFileSync(join(root, '_NEXUS_Q_CODEX.md'), 'utf-8');
    const queueAfter = readFileSync(join(root, '_NEXUS_QUEUE.md'), 'utf-8');

    assert.match(output, /Receipt written for build-thing in _NEXUS_Q_CODEX\.md/);
    assert.match(output, /Master queue unchanged; run `nexus queue reconcile`/);
    assert.doesNotMatch(lane, /TASK\/Codex: Build thing/);
    assert.match(lane, /- \[x\] build-thing/);
    assert.match(lane, /Receipt: pending reconciliation/);
    assert.equal(queueAfter, queue);
  });
});

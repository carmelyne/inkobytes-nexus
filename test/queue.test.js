import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { chdir, cwd } from 'process';
import queue from '../src/commands/queue.js';
import { resetConfig } from '../src/lib/config.js';

function inTempRepo(fn) {
  const previous = cwd();
  const root = mkdtempSync(join(tmpdir(), 'nexus-queue-'));
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

test('queue reconcile batches pending lane receipts back into the master queue', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), `# Nexus Queue

## Ready Queue

- [ ] TASK/Codex: Build thing
  - Id: build-thing
  - Status: Delegated
  - Depends on: none
  - Files: src/build.js
  - Auto-flow: yes
  - Delegated to: @codex
  - Delegated at: 2026-06-11T08:00:00.000Z
  - Lane: _NEXUS_Q_CODEX.md
  - Receipt: pending
`, 'utf-8');
    writeFileSync(join(root, '_NEXUS_Q_CODEX.md'), `# Nexus Queue Lane - @codex

## Active

## Completed

- [x] build-thing
  - Id: build-thing
  - Agent: @codex
  - Completed at: 2026-06-11T09:00:00.000Z
  - Receipt: pending reconciliation
`, 'utf-8');

    const output = captureLogs(() => queue(['reconcile']));
    const master = readFileSync(join(root, '_NEXUS_QUEUE.md'), 'utf-8');
    const lane = readFileSync(join(root, '_NEXUS_Q_CODEX.md'), 'utf-8');

    assert.match(output, /build-thing: reconciled from _NEXUS_Q_CODEX\.md/);
    assert.match(master, /- \[x\] TASK\/Codex: Build thing/);
    assert.match(master, /Status: Done/);
    assert.match(master, /Done: 2026-06-11/);
    assert.match(master, /Completed by: @codex/);
    assert.match(master, /Completed at: 2026-06-11T09:00:00\.000Z/);
    assert.match(master, /Receipt: reconciled at /);
    assert.match(lane, /Receipt: reconciled at /);
    assert.match(lane, /Reconciled at: /);
  });
});

test('queue reconcile refuses duplicate pending receipts for the same task id', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), `# Nexus Queue

## Ready Queue

- [ ] TASK/Codex: Build thing
  - Id: build-thing
  - Status: Delegated
  - Lane: _NEXUS_Q_CODEX.md
`, 'utf-8');
    writeFileSync(join(root, '_NEXUS_Q_CODEX.md'), `# Nexus Queue Lane - @codex

## Active

## Completed

- [x] build-thing
  - Id: build-thing
  - Agent: @codex
  - Completed at: 2026-06-11T09:00:00.000Z
  - Receipt: pending reconciliation

- [x] build-thing
  - Id: build-thing
  - Agent: @codex
  - Completed at: 2026-06-11T09:01:00.000Z
  - Receipt: pending reconciliation
`, 'utf-8');

    assert.throws(() => queue(['reconcile']), /Duplicate pending receipts: build-thing/);
  });
});

test('queue reconcile reports when there are no pending lane receipts', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), '# Nexus Queue\n\n## Ready Queue\n', 'utf-8');

    const output = captureLogs(() => queue(['reconcile']));

    assert.match(output, /No pending lane receipts to reconcile/);
  });
});

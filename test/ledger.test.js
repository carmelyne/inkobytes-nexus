import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { chdir, cwd } from 'process';
import ledger, { appendCompletedLedgerEntries, readLedgerEntries } from '../src/commands/ledger.js';
import { resetConfig } from '../src/lib/config.js';

function inTempRepo(fn) {
  const previous = cwd();
  const root = mkdtempSync(join(tmpdir(), 'nexus-ledger-'));
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

test('appendCompletedLedgerEntries records checked queue tasks once', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), [
      '- [x] TASK/Codex: Build Nexus completed task ledger',
      '  - Id: nexus-ledger',
      '  - Epic: Dashboard observability',
      '  - Files: src/commands/ledger.js, _NEXUS_LEDGER.md',
      '  - Cost: medium',
      '- [ ] TASK/Codex: Not done',
      '  - Id: not-done',
      '  - Epic: Dashboard observability',
      '  - Files: src/commands/ledger.js',
      '  - Cost: small',
    ].join('\n'), 'utf-8');

    const count = appendCompletedLedgerEntries({
      target: 'src/commands/ledger.js',
      agent: '@codex',
      sha: 'abc123',
      commit: 'nexus-ledger: add ledger',
    });
    const secondCount = appendCompletedLedgerEntries({
      target: 'src/commands/ledger.js',
      agent: '@codex',
      sha: 'abc123',
      commit: 'nexus-ledger: add ledger',
    });

    assert.equal(count, 1);
    assert.equal(secondCount, 0);
    const ledgerText = readFileSync(join(root, '_NEXUS_LEDGER.md'), 'utf-8');
    assert.match(ledgerText, /## nexus-ledger/);
    assert.match(ledgerText, /- Title: Build Nexus completed task ledger/);
    assert.doesNotMatch(ledgerText, /not-done/);
  });
});

test('ledger --json emits entries and totals', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_LEDGER.md'), [
      '# Nexus Completed Task Ledger',
      '',
      '## nexus-ledger',
      '',
      '- Id: nexus-ledger',
      '- Title: Build Nexus completed task ledger',
      '- Agent: @codex',
      '- Epic: Dashboard observability',
      '- Cost: medium',
      '- Completed At: 2026-05-31T12:00:00.000Z',
      '- Files: src/commands/ledger.js, _NEXUS_LEDGER.md',
      '- SHA: abc123',
      '- Commit: feat: add ledger',
      '',
    ].join('\n'), 'utf-8');

    const entries = readLedgerEntries();
    assert.equal(entries.length, 1);
    assert.deepEqual(entries[0].files, ['src/commands/ledger.js', '_NEXUS_LEDGER.md']);

    const output = captureLogs(() => ledger(['--json']));
    const payload = JSON.parse(output);
    assert.equal(payload.entries[0].id, 'nexus-ledger');
    assert.equal(payload.totals.completedTasks, 1);
    assert.equal(payload.totals.byAgent['@codex'], 1);
  });
});

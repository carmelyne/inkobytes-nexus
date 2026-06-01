import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { chdir, cwd } from 'process';
import { spawnSync } from 'child_process';
import next from '../src/commands/next.js';
import { resetConfig } from '../src/lib/config.js';

function inTempRepo(fn) {
  const previous = cwd();
  const root = mkdtempSync(join(tmpdir(), 'nexus-next-'));
  chdir(root);
  resetConfig();

  try {
    spawnSync('git', ['init'], { cwd: root, stdio: 'pipe' });
    spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd: root, stdio: 'pipe' });
    spawnSync('git', ['config', 'user.name', 'Test Agent'], { cwd: root, stdio: 'pipe' });
    writeFileSync(join(root, '_NEXUS.md'), '# Nexus Blackboard\n', 'utf-8');
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

test('next prints manually pinned related drills from queue', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), `# Nexus Queue

## Runways

- @codex: Data hygiene

## Ready Queue

- [ ] TASK/Codex: Clean up customer records
  - Id: cleanup-customer-records
  - Epic: Data hygiene
  - Status: Ready
  - Depends on: none
  - Files: src/db/cleanup.js
  - Affinity: db, safety
  - Drills: data-mutation-delete-rows, task-contract
  - Cost: small
  - Auto-flow: yes
  - Review: approved
  - Approved by: human
  - Notes: Use the human-approved scope.
`, 'utf-8');

    const output = captureLogs(() => next(['@codex']));

    assert.match(output, /Task: cleanup-customer-records/);
    assert.match(output, /Related Drills:/);
    assert.match(output, /- data-mutation-delete-rows/);
    assert.match(output, /- task-contract/);
    assert.match(output, /nexus drill show <id>/);
  });
});

test('next surfaces obvious related drills from task metadata', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), `# Nexus Queue

## Runways

- @codex: Database maintenance

## Ready Queue

- [ ] TASK/Codex: Add customer database cleanup migration
  - Id: customer-db-cleanup
  - Epic: Database maintenance
  - Status: Ready
  - Depends on: none
  - Files: migrations/024_customer_cleanup.sql
  - Affinity: database, migration
  - Cost: small
  - Auto-flow: yes
  - Review: approved
  - Approved by: human
  - Notes: Persisted data maintenance.
`, 'utf-8');

    const output = captureLogs(() => next(['@codex']));

    assert.match(output, /Related Drills:/);
    assert.match(output, /- data-mutation-delete-rows/);
    assert.match(output, /- task-contract/);
  });
});

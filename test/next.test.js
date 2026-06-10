import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
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

function writeAutonomy(root, level) {
  mkdirSync(join(root, '.nexus'), { recursive: true });
  writeFileSync(join(root, '.nexus', 'config.json'), JSON.stringify({ autonomy: level }), 'utf-8');
  resetConfig();
}

const CONTRACT_QUEUE = `# Nexus Queue

## Ready Queue

- [ ] TASK/Codex: Fully specified task
  - Id: good-task
  - Epic: Loop readiness
  - Status: Ready
  - Depends on: none
  - Files: src/good.js
  - Affinity: cli
  - Cost: small
  - Auto-flow: yes
  - Review: approved
  - Approved by: human
  - Notes: Complete contract, safe to flow.

- [ ] TASK/Codex: Under-specified task
  - Id: vague-task
  - Epic: Loop readiness
  - Status: Ready
  - Depends on: none
  - Files: src/vague.js
  - Affinity: cli
  - Auto-flow: yes
  - Review: approved
`;

test('next at autonomy 1 skips contract-failing auto-flow tasks and prints the missing fields', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), CONTRACT_QUEUE, 'utf-8');
    writeAutonomy(root, 1);

    const output = captureLogs(() => next(['@codex']));

    assert.match(output, /Task: good-task/);
    assert.match(output, /Task contract \(autonomy 1\): skipped 1 auto-flow task/);
    assert.match(output, /vague-task: needs Approved by: human, non-empty Notes, non-empty Cost/);
    assert.match(output, /Repair the fields in _NEXUS_QUEUE\.md or move the task to ## Proposed Queue\./);
  });
});

test('next at autonomy 0 keeps legacy behavior — review-approved tasks flow without the full contract', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), CONTRACT_QUEUE, 'utf-8');
    writeAutonomy(root, 0);

    const output = captureLogs(() => next(['@codex']));

    assert.doesNotMatch(output, /Task contract/);
    assert.match(output, /Task: (good-task|vague-task)/);
  });
});

test('next at autonomy 1 stands by with contract report when every auto-flow task fails', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), `# Nexus Queue

## Ready Queue

- [ ] TASK/Codex: Under-specified task
  - Id: vague-task
  - Status: Ready
  - Depends on: none
  - Files: src/vague.js
  - Auto-flow: yes
`, 'utf-8');
    writeAutonomy(root, 1);

    const output = captureLogs(() => next(['@codex']));

    assert.match(output, /vague-task: needs Review: approved, Approved by: human, non-empty Notes, non-empty Cost/);
    assert.match(output, /No safe auto-flow tasks available for @codex\. Standby\./);
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

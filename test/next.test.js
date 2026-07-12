import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { chdir, cwd } from 'process';
import { spawnSync } from 'child_process';
import next from '../src/commands/next.js';
import init from '../src/commands/init.js';
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

test('next in a freshly initialized repo stands by and points to sample tasks', () => {
  inTempRepo(() => {
    captureLogs(() => init([]));

    const output = captureLogs(() => next(['@Agent-1']));

    assert.match(output, /No safe auto-flow tasks available for @Agent-1\. Standby\./);
    assert.match(output, /Sample tasks found: hello-main, hello-utils/);
    assert.match(output, /documentation only/);
    assert.match(output, /Status: Ready and Auto-flow: yes after human approval/);
    assert.doesNotMatch(output, /Task: hello-main/);
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

test('next surfaces declared task primitives in the suggestion', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), `# Nexus Queue

## Ready Queue

- [ ] TASK/Codex: Ship the widget
  - Id: widget-task
  - Epic: Loop readiness
  - Status: Ready
  - Depends on: none
  - Files: src/widget.js
  - Affinity: cli
  - Cost: small
  - Auto-flow: yes
  - Review: approved
  - Approved by: human
  - Notes: Build the widget.
  - Goal: Give users a widget.
  - Outcome: Running nexus widget prints the widget.
  - Constraints: Touch only src/widget.js.
  - Stop If: The widget needs a new dependency.
  - Evidence: test/widget.test.js covers the print path.
`, 'utf-8');

    const output = captureLogs(() => next(['@codex']));

    assert.match(output, /Task: widget-task/);
    assert.match(output, /Goal: Give users a widget\./);
    assert.match(output, /Outcome: Running nexus widget prints the widget\./);
    assert.match(output, /Constraints: Touch only src\/widget\.js\./);
    assert.match(output, /Stop If: The widget needs a new dependency\./);
    assert.match(output, /Evidence: test\/widget\.test\.js covers the print path\./);
    assert.doesNotMatch(output, /Primitives missing/);
  });
});

test('next reports missing primitives as advisory without skipping the task', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), CONTRACT_QUEUE, 'utf-8');
    writeAutonomy(root, 1);

    const output = captureLogs(() => next(['@codex']));

    assert.match(output, /Task: good-task/);
    assert.match(output, /Primitives missing: Goal, Outcome, Constraints, Stop If, Evidence \(advisory at autonomy 1; doctor requires them at autonomy 2\)/);
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

test('next --take delegates the selected task into the agent lane and marks the master stub', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), `# Nexus Queue

## Ready Queue

- [ ] TASK/Codex: Ship the widget
  - Id: widget-task
  - Epic: Loop readiness
  - Status: Ready
  - Depends on: none
  - Files: src/widget.js
  - Affinity: cli
  - Cost: small
  - Auto-flow: yes
  - Review: approved
  - Approved by: human
  - Notes: Build the widget.
  - Goal: Give users a widget.
  - Outcome: Running nexus widget prints the widget.
  - Constraints: Touch only src/widget.js.
  - Stop If: The widget needs a new dependency.
  - Evidence: test/widget.test.js covers the print path.
`, 'utf-8');

    const output = captureLogs(() => next(['@codex', '--take']));
    const lane = readFileSync(join(root, '_NEXUS_Q_CODEX.md'), 'utf-8');
    const queue = readFileSync(join(root, '_NEXUS_QUEUE.md'), 'utf-8');

    assert.match(output, /Delegated: widget-task -> _NEXUS_Q_CODEX\.md/);
    assert.match(lane, /- \[~\] TASK\/Codex: Ship the widget/);
    assert.match(lane, /Goal: Give users a widget\./);
    assert.match(lane, /Outcome: Running nexus widget prints the widget\./);
    assert.match(lane, /Constraints: Touch only src\/widget\.js\./);
    assert.match(lane, /Stop If: The widget needs a new dependency\./);
    assert.match(lane, /Evidence: test\/widget\.test\.js covers the print path\./);
    assert.match(queue, /Status: Delegated/);
    assert.match(queue, /Delegated to: @codex/);
    assert.match(queue, /Lane: _NEXUS_Q_CODEX\.md/);
    assert.match(queue, /Receipt: pending/);
  });
});

test('next skips delegated lane tasks until they are reconciled', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), `# Nexus Queue

## Ready Queue

- [ ] TASK/Codex: First task
  - Id: first-task
  - Epic: Loop readiness
  - Status: Ready
  - Depends on: none
  - Files: src/first.js
  - Affinity: cli
  - Cost: small
  - Auto-flow: yes
  - Review: approved
  - Approved by: human
  - Notes: First task.

- [ ] TASK/Codex: Second task
  - Id: second-task
  - Epic: Loop readiness
  - Status: Ready
  - Depends on: none
  - Files: src/second.js
  - Affinity: cli
  - Cost: small
  - Auto-flow: yes
  - Review: approved
  - Approved by: human
  - Notes: Second task.
`, 'utf-8');

    captureLogs(() => next(['@codex', '--take']));
    const output = captureLogs(() => next(['@codex']));

    assert.match(output, /Task: second-task/);
    assert.doesNotMatch(output, /Task: first-task/);
  });
});

test('next --take at autonomy 1 refuses to delegate contract-failing tasks', () => {
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

    const output = captureLogs(() => next(['@codex', '--take']));

    assert.match(output, /No safe auto-flow tasks available for @codex\. Standby\./);
    assert.throws(() => readFileSync(join(root, '_NEXUS_Q_CODEX.md'), 'utf-8'), /ENOENT/);
  });
});

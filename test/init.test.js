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
    const agyGuide = readFileSync(join(root, '.agy', 'AGENTS.md'), 'utf-8');
    const constitution = readFileSync(join(root, '_NEXUS_CONSTITUTION.md'), 'utf-8');
    const queue = readFileSync(join(root, '_NEXUS_QUEUE.md'), 'utf-8');
    const gitignore = readFileSync(join(root, '.gitignore'), 'utf-8');

    assert.match(output, /All checked Nexus categories are ready/);
    assert.match(readFileSync(join(root, 'DECISIONS.md'), 'utf-8'), /Local agent work decisions live here/);
    assert.match(gitignore, /DECISIONS\.md/);
    assert.match(gitignore, /docs-priv\//);
    assert.equal(queue.match(/Review: approved/g).length, 2);
    assert.equal(queue.match(/Approved by: human/g).length, 2);
    assert.equal(codexGuide.match(/NEXUS-AGENT-PROTOCOL:START/g).length, 1);
    assert.equal(codexGuide.match(/This project uses Nexus for multi-agent coordination\./g).length, 1);
    assert.match(codexGuide, /### Current File State/);
    assert.match(codexGuide, /atomic lock-and-read boundary/);
    assert.match(codexGuide, /read a shared file before claiming it, treat that read as stale after claim succeeds/);
    assert.match(codexGuide, /claim appears stale/);
    assert.match(codexGuide, /### Drills/);
    assert.match(codexGuide, /Drill guidance is defined in `_NEXUS_CONSTITUTION\.md`/);
    assert.match(codexGuide, /If the situation resembles a drill, use that drill before acting/);
    assert.doesNotMatch(codexGuide, /recipes\/task-contract\.md/);
    assert.match(codexGuide, /### Delegated Work/);
    assert.match(codexGuide, /Lead agents own the repo effects of their subagents/);
    assert.match(codexGuide, /Claim the full path scope before delegating shared-file work/);
    assert.match(codexGuide, /Mention delegated work in release or standup notes/);
    assert.match(codexGuide, /### Git Write Safety/);
    assert.match(codexGuide, /Direct user instruction can override queue order/);
    assert.match(codexGuide, /announce `Standby` with what you are waiting for/);
    assert.match(codexGuide, /Never infer from similar folder names or cached context/);
    assert.match(codexGuide, /untrack them; do not delete local folders/);
    assert.match(codexGuide, /Agent instruction files are shared protocol files/);
    assert.match(codexGuide, /assigned work zones/);
    assert.match(codexGuide, /cached model memory/);
    assert.match(codexGuide, /nexus doctor` is cheap, local, and idempotent/);
    assert.match(codexGuide, /Security, Package Privacy, Git Privacy, or supply-chain findings/);
    assert.match(codexGuide, /specific version publish date/);
    assert.match(codexGuide, /DECISIONS\.md/);
    assert.match(codexGuide, /mention them in `_NEXUS_STANDUP\.md` only when active agents need to coordinate around them/);
    assert.match(codexGuide, /Memory entries are session handoffs/);
    assert.match(codexGuide, /create the current month folder under `.codex\/memories` if it is missing/);
    assert.match(codexGuide, /Do not create or repair other agents' memory folders manually/);
    assert.match(codexGuide, /# YYYY-MM-DD-HHMM - <topic>/);
    assert.match(codexGuide, /Read `USER\.md` if present/);
    assert.doesNotMatch(codexGuide, /Pong/);
    assert.match(agyGuide, /\.agy\/CONTINUITY\.md/);
    assert.match(constitution, /## 5\. Drill Guidance/);
    assert.match(constitution, /## 8\. Delegated Work/);
    assert.match(constitution, /Subagents can be an implementation detail; their repo effects cannot be invisible/);
    assert.match(constitution, /Do not use standup as the permanent decision ledger/);
    assert.match(constitution, /Blocked or unsafe to proceed[\s\S]*Found a bug[\s\S]*Removing a dependency[\s\S]*Task is broad[\s\S]*Touching persisted data/);
    assert.match(constitution, /drills\/nexus-agent-protocol\/cases\/blocked\.yaml/);
    assert.match(constitution, /drills\/nexus-agent-protocol\/cases\/issue-found\.yaml/);
  });
});

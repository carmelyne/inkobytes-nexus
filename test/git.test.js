import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { chdir, cwd } from 'process';
import { spawnSync } from 'child_process';
import { resetConfig } from '../src/lib/config.js';
import { stageAndCommit } from '../src/lib/git.js';

function inTempRepo(fn) {
  const previous = cwd();
  const root = mkdtempSync(join(tmpdir(), 'nexus-git-'));
  chdir(root);
  resetConfig();
  try {
    return fn(root);
  } finally {
    chdir(previous);
    resetConfig();
  }
}

function initGitRepo(root) {
  spawnSync('git', ['init'], { cwd: root, encoding: 'utf-8' });
  spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd: root, encoding: 'utf-8' });
  spawnSync('git', ['config', 'user.name', 'Test User'], { cwd: root, encoding: 'utf-8' });
  spawnSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: root, encoding: 'utf-8' });
}

test('stageAndCommit succeeds on a real git repo with a new file', () => {
  inTempRepo((root) => {
    initGitRepo(root);
    writeFileSync(join(root, 'agent-output.md'), 'hello world\n', 'utf-8');
    const result = stageAndCommit('agent-output.md', 'add agent-output.md');
    assert.equal(result.success, true);
    assert.match(result.sha, /^[0-9a-f]{40}$/);
  });
});

test('stageAndCommit uses explicit agent attribution when provided', () => {
  inTempRepo((root) => {
    initGitRepo(root);
    writeFileSync(join(root, 'agent-output.md'), 'hello world\n', 'utf-8');

    const result = stageAndCommit('agent-output.md', 'add agent-output.md', '@codex');

    assert.equal(result.success, true);
    const log = spawnSync('git', ['log', '-1', '--pretty=%s'], { cwd: root, encoding: 'utf-8' }).stdout.trim();
    assert.equal(log, '[@codex] add agent-output.md');
  });
});

test('stageAndCommit keeps generic attribution when no agent is provided', () => {
  inTempRepo((root) => {
    initGitRepo(root);
    writeFileSync(join(root, 'agent-output.md'), 'hello world\n', 'utf-8');

    const result = stageAndCommit('agent-output.md', 'add agent-output.md');

    assert.equal(result.success, true);
    const log = spawnSync('git', ['log', '-1', '--pretty=%s'], { cwd: root, encoding: 'utf-8' }).stdout.trim();
    assert.equal(log, '[Agent] add agent-output.md');
  });
});

test('stageAndCommit returns success with nothing-to-commit when file is unchanged', () => {
  inTempRepo((root) => {
    initGitRepo(root);
    writeFileSync(join(root, 'stable.txt'), 'no changes\n', 'utf-8');
    stageAndCommit('stable.txt', 'initial commit');
    const result = stageAndCommit('stable.txt', 'try again');
    assert.equal(result.success, true);
    assert.ok(result.message && result.message.includes('Nothing to commit'));
  });
});

test('stageAndCommit returns { success: false } when called outside a git repo', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, 'orphan.txt'), 'no git here\n', 'utf-8');
    const result = stageAndCommit('orphan.txt', 'will fail');
    assert.equal(result.success, false);
    assert.equal(typeof result.message, 'string');
  });
});

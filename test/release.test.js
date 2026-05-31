import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { chdir, cwd } from 'process';
import { spawnSync } from 'child_process';
import { stageAndCommit } from '../src/lib/git.js';
import release from '../src/commands/release.js';
import { acquireLock } from '../src/lib/lockManager.js';
import { resetConfig } from '../src/lib/config.js';

function inTempRepo(fn) {
  const previous = cwd();
  const root = mkdtempSync(join(tmpdir(), 'nexus-release-'));
  chdir(root);
  resetConfig();

  try {
    spawnSync('git', ['init'], { cwd: root, stdio: 'pipe' });
    spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd: root, stdio: 'pipe' });
    spawnSync('git', ['config', 'user.name', 'Test Agent'], { cwd: root, stdio: 'pipe' });
    return fn(root);
  } finally {
    chdir(previous);
    resetConfig();
  }
}

test('stageAndCommit returns clear message when git index stays locked', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, 'file.txt'), 'hello\n', 'utf-8');
    mkdirSync(join(root, '.git'), { recursive: true });
    writeFileSync(join(root, '.git', 'index.lock'), '', 'utf-8');

    const result = stageAndCommit('file.txt', 'test locked release', 1, 1);

    assert.equal(result.success, false);
    assert.match(result.message, /Git index stayed locked/);
  });
});

test('release appends structured report entry', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, 'file.txt'), 'hello\n', 'utf-8');
    spawnSync('git', ['add', 'file.txt'], { cwd: root, stdio: 'pipe' });
    spawnSync('git', ['commit', '-m', 'init'], { cwd: root, stdio: 'pipe' });
    writeFileSync(join(root, 'file.txt'), 'hello again\n', 'utf-8');
    acquireLock('file.txt', '@codex', 'test release report');

    release(['file.txt', 'test release report']);

    const report = readFileSync(join(root, '_NEXUS_REPORT.md'), 'utf-8');
    assert.match(report, /## \[\d\d:\d\d:\d\d\] file\.txt/);
    assert.match(report, /- Agent: @codex/);
    assert.match(report, /- Target: file\.txt/);
    assert.match(report, /- SHA: [0-9a-f]{40}/);
    assert.match(report, /- Commit: test release report/);
    assert.doesNotMatch(report, /Done claim:/);
    assert.doesNotMatch(report, /Adversarial result:/);
    const log = spawnSync('git', ['log', '-1', '--pretty=%s'], { cwd: root, encoding: 'utf-8' }).stdout.trim();
    assert.equal(log, '[@codex] test release report');
  });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { chdir, cwd } from 'process';
import { spawnSync } from 'child_process';
import resume from '../src/commands/resume.js';
import { resetConfig } from '../src/lib/config.js';

function inTempRepo(fn) {
  const previous = cwd();
  const root = mkdtempSync(join(tmpdir(), 'nexus-resume-'));
  chdir(root);
  resetConfig();

  try {
    spawnSync('git', ['init'], { cwd: root, stdio: 'pipe' });
    spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd: root, stdio: 'pipe' });
    spawnSync('git', ['config', 'user.name', 'Test Agent'], { cwd: root, stdio: 'pipe' });
    writeFileSync(join(root, 'README.md'), '# Test\n', 'utf-8');
    spawnSync('git', ['add', 'README.md'], { cwd: root, stdio: 'pipe' });
    spawnSync('git', ['commit', '-m', 'init'], { cwd: root, stdio: 'pipe' });
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

test('resume prints local repo facts without project memory duplication', () => {
  inTempRepo((root) => {
    mkdirSync(join(root, '.codex', 'memories', '2026-May'), { recursive: true });
    writeFileSync(join(root, '.codex', 'CONTINUITY.md'), '# CONTINUITY\nGoal: Test\nState: Done\n', 'utf-8');
    writeFileSync(join(root, '.codex', 'memories', '2026-May', 'test.md'), '# Test memory\n', 'utf-8');
    writeFileSync(join(root, 'dirty.txt'), 'dirty\n', 'utf-8');

    const output = captureLogs(() => resume([]));

    assert.match(output, /Nexus resume/);
    assert.match(output, /Dirty files: 2/);
    assert.match(output, /\?\? dirty\.txt/);
    assert.match(output, /\.codex\/memories\/2026-May\/test\.md/);
    assert.match(output, /Goal: Test/);
  });
});

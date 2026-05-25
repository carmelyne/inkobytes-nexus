import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { chdir, cwd } from 'process';
import { spawnSync } from 'child_process';
import start from '../src/commands/start.js';
import { resetConfig } from '../src/lib/config.js';

function inTempRepo(fn) {
  const previous = cwd();
    const root = mkdtempSync(join(tmpdir(), 'nexus-start-'));
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

test('start prints selected agent-local repo facts without project memory duplication', () => {
  inTempRepo((root) => {
    mkdirSync(join(root, '.gemini', 'memories', '2026-May'), { recursive: true });
    writeFileSync(join(root, '.gemini', 'CONTINUITY.md'), '# CONTINUITY\nGoal: Test\nState: Done\n', 'utf-8');
    writeFileSync(join(root, '.gemini', 'memories', '2026-May', 'test.md'), '# Test memory\n', 'utf-8');
    mkdirSync(join(root, '.codex', 'memories', '2026-May'), { recursive: true });
    writeFileSync(join(root, '.codex', 'CONTINUITY.md'), '# CONTINUITY\nGoal: Wrong scope\nState: Done\n', 'utf-8');
    writeFileSync(join(root, '.codex', 'memories', '2026-May', 'codex.md'), '# Codex memory\n', 'utf-8');
    writeFileSync(join(root, 'dirty.txt'), 'dirty\n', 'utf-8');

    const output = captureLogs(() => start(['--agent', '@gemini']));

    assert.match(output, /Nexus start/);
    assert.match(output, /Agent: Gemini \(@gemini\)/);
    assert.match(output, /Dirty files: 3/);
    assert.match(output, /\?\? dirty\.txt/);
    assert.match(output, /\.gemini\/memories\/2026-May\/test\.md/);
    assert.match(output, /Goal: Test/);
    assert.doesNotMatch(output, /Wrong scope/);
    assert.doesNotMatch(output, /\.codex\/memories\/2026-May\/codex\.md/);
    assert.match(output, /claim exact shared files/);
  });
});

test('start uses NEXUS_AGENT when no agent argument is provided', () => {
  inTempRepo((root) => {
    mkdirSync(join(root, '.agy', 'memories', '2026-May'), { recursive: true });
    writeFileSync(join(root, '.agy', 'CONTINUITY.md'), '# CONTINUITY\nGoal: Antigravity\n', 'utf-8');
    writeFileSync(join(root, '.agy', 'memories', '2026-May', 'agy.md'), '# Agy memory\n', 'utf-8');
    const previous = process.env.NEXUS_AGENT;
    process.env.NEXUS_AGENT = '@agy';

    try {
      const output = captureLogs(() => start([]));
      assert.match(output, /Agent: Antigravity \(@agy\)/);
      assert.match(output, /\.agy\/memories\/2026-May\/agy\.md/);
      assert.match(output, /Goal: Antigravity/);
    } finally {
      if (previous === undefined) delete process.env.NEXUS_AGENT;
      else process.env.NEXUS_AGENT = previous;
    }
  });
});

test('start without agent does not choose Codex memory by default', () => {
  inTempRepo((root) => {
    mkdirSync(join(root, '.codex', 'memories', '2026-May'), { recursive: true });
    writeFileSync(join(root, '.codex', 'CONTINUITY.md'), '# CONTINUITY\nGoal: Codex only\n', 'utf-8');
    writeFileSync(join(root, '.codex', 'memories', '2026-May', 'codex.md'), '# Codex memory\n', 'utf-8');

    const output = captureLogs(() => start([]));

    assert.match(output, /Agent: unspecified/);
    assert.match(output, /Agent memory scopes/);
    assert.match(output, /nexus start --agent @agy\|@claude\|@codex\|@gemini/);
    assert.doesNotMatch(output, /Codex only/);
    assert.doesNotMatch(output, /codex\.md/);
  });
});

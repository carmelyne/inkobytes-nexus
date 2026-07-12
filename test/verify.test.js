import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { chdir, cwd } from 'process';
import { spawnSync } from 'child_process';
import verify from '../src/commands/verify.js';
import { resetConfig } from '../src/lib/config.js';

function inTempRepo(fn) {
  const previous = cwd();
  const root = mkdtempSync(join(tmpdir(), 'nexus-verify-'));
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

function capture(fn, { expectExit = false } = {}) {
  const originalLog = console.log;
  const originalError = console.error;
  const originalExit = process.exit;
  const lines = [];
  console.log = (...args) => lines.push(args.join(' '));
  console.error = (...args) => lines.push(args.join(' '));
  process.exit = (code) => {
    throw Object.assign(new Error(`process.exit ${code}`), { code });
  };

  try {
    if (expectExit) assert.throws(fn, /process\.exit 1/);
    else fn();
  } finally {
    console.log = originalLog;
    console.error = originalError;
    process.exit = originalExit;
  }

  return lines.join('\n');
}

function commit(root, files, message) {
  spawnSync('git', ['add', ...files], { cwd: root, stdio: 'pipe' });
  const result = spawnSync('git', ['commit', '-m', message], { cwd: root, encoding: 'utf-8', stdio: 'pipe' });
  assert.equal(result.status, 0, result.stderr);
  return spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).stdout.trim();
}

function writeQueue(root, { id = 'verify-task', files = 'src/app.js' } = {}) {
  writeFileSync(join(root, '_NEXUS_QUEUE.md'), `# Nexus Queue

## Ready Queue

- [x] TASK/Codex: Verify task
  - Id: ${id}
  - Epic: Tests
  - Status: Done
  - Files: ${files}
  - Cost: small
  - Auto-flow: yes
  - Review: approved
  - Approved by: human
  - Notes: Done task for receipt verification.
`, 'utf-8');
}

function writeReport(root, { target = 'src/app.js', sha, commitMessage = 'verify-task: implement' }) {
  writeFileSync(join(root, '_NEXUS_REPORT.md'), `## [2026-07-12 08:00:00 PM] ${target}

- Agent: @codex
- Target: ${target}
- Claim HEAD: unknown
- Release HEAD: unknown
- Drift: no
- SHA: ${sha}
- Commit: ${commitMessage}

`, 'utf-8');
}

test('verify shows commits and in-scope diffstat for a legit receipt', () => {
  inTempRepo((root) => {
    writeQueue(root);
    spawnSync('mkdir', ['-p', join(root, 'src')], { cwd: root, stdio: 'pipe' });
    writeFileSync(join(root, 'src', 'app.js'), 'one\n', 'utf-8');
    commit(root, ['_NEXUS_QUEUE.md', '_NEXUS.md', 'src/app.js'], 'init');
    writeFileSync(join(root, 'src', 'app.js'), 'two\n', 'utf-8');
    const sha = commit(root, ['src/app.js'], 'verify-task: implement');
    writeReport(root, { sha });

    const output = capture(() => verify(['verify-task']));

    assert.match(output, /VERIFY verify-task/);
    assert.match(output, new RegExp(sha.slice(0, 7)));
    assert.match(output, /Status: ok/);
    assert.match(output, /In-scope diffstat:/);
    assert.match(output, /src\/app\.js/);
  });
});

test('verify flags missing release commits for a known task', () => {
  inTempRepo((root) => {
    writeQueue(root);
    writeFileSync(join(root, '_NEXUS_REPORT.md'), '# Report\n', 'utf-8');

    const output = capture(() => verify(['verify-task']), { expectExit: true });

    assert.match(output, /No release receipts with existing commit hashes matched this task id/);
    assert.match(output, /Status: failed/);
    assert.doesNotMatch(output, /TypeError/);
  });
});

test('verify flags out-of-scope-only receipt commits', () => {
  inTempRepo((root) => {
    writeQueue(root, { files: 'src/app.js' });
    spawnSync('mkdir', ['-p', join(root, 'src')], { cwd: root, stdio: 'pipe' });
    writeFileSync(join(root, 'src', 'app.js'), 'one\n', 'utf-8');
    writeFileSync(join(root, 'other.js'), 'one\n', 'utf-8');
    commit(root, ['_NEXUS_QUEUE.md', '_NEXUS.md', 'src/app.js', 'other.js'], 'init');
    writeFileSync(join(root, 'other.js'), 'two\n', 'utf-8');
    const sha = commit(root, ['other.js'], 'verify-task: unrelated');
    writeReport(root, { target: 'other.js', sha, commitMessage: 'verify-task: unrelated' });

    const output = capture(() => verify(['verify-task']), { expectExit: true });

    assert.match(output, /Status: failed/);
    assert.match(output, /out-of-scope-only changes/);
    assert.match(output, /other\.js/);
  });
});

test('verify errors cleanly for an unknown task id', () => {
  inTempRepo((root) => {
    writeQueue(root, { id: 'known-task' });

    const output = capture(() => verify(['missing-task']), { expectExit: true });

    assert.match(output, /Unknown task id: missing-task/);
  });
});

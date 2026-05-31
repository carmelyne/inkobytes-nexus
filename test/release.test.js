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
    assert.match(report, /- Claim HEAD: [0-9a-f]{40}/);
    assert.match(report, /- Release HEAD: [0-9a-f]{40}/);
    assert.match(report, /- Drift: no/);
    assert.match(report, /- SHA: [0-9a-f]{40}/);
    assert.match(report, /- Commit: test release report/);
    assert.doesNotMatch(report, /Done claim:/);
    assert.doesNotMatch(report, /Adversarial result:/);
    const log = spawnSync('git', ['log', '-1', '--pretty=%s'], { cwd: root, encoding: 'utf-8' }).stdout.trim();
    assert.equal(log, '[@codex] test release report');
  });
});

test('release appends matching completed queue task to ledger', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, 'file.txt'), 'hello\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), [
      '- [x] TASK/Codex: Release ledger data',
      '  - Id: release-ledger-data',
      '  - Epic: Dashboard observability',
      '  - Files: file.txt',
      '  - Cost: small',
    ].join('\n'), 'utf-8');
    spawnSync('git', ['add', 'file.txt', '_NEXUS_QUEUE.md'], { cwd: root, stdio: 'pipe' });
    spawnSync('git', ['commit', '-m', 'init'], { cwd: root, stdio: 'pipe' });
    writeFileSync(join(root, 'file.txt'), 'hello again\n', 'utf-8');
    acquireLock('file.txt', '@codex', 'test release ledger');

    release(['file.txt', 'release-ledger-data: test release ledger']);

    const ledger = readFileSync(join(root, '_NEXUS_LEDGER.md'), 'utf-8');
    assert.match(ledger, /## release-ledger-data/);
    assert.match(ledger, /- Agent: @codex/);
    assert.match(ledger, /- Files: file\.txt/);
    assert.match(ledger, /- Commit: release-ledger-data: test release ledger/);
  });
});

test('release warns and reports when HEAD changed since claim', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, 'file.txt'), 'hello\n', 'utf-8');
    spawnSync('git', ['add', 'file.txt'], { cwd: root, stdio: 'pipe' });
    spawnSync('git', ['commit', '-m', 'init'], { cwd: root, stdio: 'pipe' });
    const claimHead = spawnSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).stdout.trim();

    acquireLock('file.txt', '@codex', 'test release drift');

    writeFileSync(join(root, 'other.txt'), 'interleaved\n', 'utf-8');
    spawnSync('git', ['add', 'other.txt'], { cwd: root, stdio: 'pipe' });
    spawnSync('git', ['commit', '-m', 'interleaved commit'], { cwd: root, stdio: 'pipe' });
    const releaseHead = spawnSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).stdout.trim();
    writeFileSync(join(root, 'file.txt'), 'hello after drift\n', 'utf-8');

    const warnings = [];
    const originalWarn = console.warn;
    console.warn = (message) => warnings.push(message);
    try {
      release(['file.txt', 'test release drift']);
    } finally {
      console.warn = originalWarn;
    }

    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /HEAD changed since claim for file\.txt/);
    assert.match(warnings[0], new RegExp(claimHead.slice(0, 7)));
    assert.match(warnings[0], new RegExp(releaseHead.slice(0, 7)));

    const report = readFileSync(join(root, '_NEXUS_REPORT.md'), 'utf-8');
    assert.match(report, new RegExp(`- Claim HEAD: ${claimHead}`));
    assert.match(report, new RegExp(`- Release HEAD: ${releaseHead}`));
    assert.match(report, /- Drift: yes/);
    assert.match(report, /- SHA: [0-9a-f]{40}/);
  });
});

test('release skips report append when releasing _NEXUS_REPORT.md', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_REPORT.md'), '# Report\n\nExisting receipt\n', 'utf-8');
    spawnSync('git', ['add', '_NEXUS_REPORT.md'], { cwd: root, stdio: 'pipe' });
    spawnSync('git', ['commit', '-m', 'init report'], { cwd: root, stdio: 'pipe' });
    writeFileSync(join(root, '_NEXUS_REPORT.md'), '# Report\n\nExisting receipt\n\nManual cleanup\n', 'utf-8');
    acquireLock('_NEXUS_REPORT.md', '@codex', 'test report self-noise');

    release(['_NEXUS_REPORT.md', 'test report self-noise']);

    const report = readFileSync(join(root, '_NEXUS_REPORT.md'), 'utf-8');
    assert.equal(report, '# Report\n\nExisting receipt\n\nManual cleanup\n');
    const log = spawnSync('git', ['log', '-1', '--pretty=%s'], { cwd: root, encoding: 'utf-8' }).stdout.trim();
    assert.equal(log, '[@codex] test report self-noise');
  });
});

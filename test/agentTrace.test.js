import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { chdir, cwd } from 'process';
import { spawnSync } from 'child_process';
import { getConfig, resetConfig } from '../src/lib/config.js';
import { acquireLock, listLocks } from '../src/lib/lockManager.js';
import {
  evaluateLockProgress,
  evaluateLocksProgress,
  parseAmPmTimestamp,
  readAgentTrace,
  readLaneNotes,
  readRecentReceipts,
  readVerifyFailures,
} from '../src/lib/agentTrace.js';

function inTempRepo(fn) {
  const previous = cwd();
  const root = mkdtempSync(join(tmpdir(), 'nexus-trace-'));
  chdir(root);
  resetConfig();
  spawnSync('git', ['init'], { cwd: root, stdio: 'pipe' });

  try {
    return fn(root);
  } finally {
    chdir(previous);
    resetConfig();
  }
}

function reportStamp(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const rawHour = date.getHours();
  const hour = String(rawHour % 12 || 12).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  const period = rawHour < 12 ? 'AM' : 'PM';
  return `${yyyy}-${mm}-${dd} ${hour}:${minute}:${second} ${period}`;
}

function standupStamp(date) {
  return reportStamp(date).replace(/:(\d{2}) (AM|PM)$/, ' $2');
}

function reportEntry(date, target, agent) {
  return `## [${reportStamp(date)}] ${target}\n\n- Agent: ${agent}\n- Target: ${target}\n- SHA: abc1234\n- Commit: test commit\n\n`;
}

test('claim records blob hash and file path-type in lock metadata', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, 'file.txt'), 'hello\n', 'utf-8');
    acquireLock('file.txt', '@claude', 'work');

    const lock = listLocks().find((l) => l.target === 'file.txt');
    assert.equal(lock.pathType, 'file');
    assert.match(lock.blob, /^[0-9a-f]{40}$/);
  });
});

test('claim records directory path-type with git-status-porcelain progress check', () => {
  inTempRepo((root) => {
    mkdirSync(join(root, 'src'));
    writeFileSync(join(root, 'src', 'a.txt'), 'a\n', 'utf-8');
    acquireLock('src', '@claude', 'work');

    const lock = listLocks().find((l) => l.target === 'src');
    assert.equal(lock.pathType, 'directory');
    assert.equal(lock.progressCheck, 'git-status-porcelain');
    assert.equal(lock.blob, '');
  });
});

test('claim records new path-type for targets that do not exist yet', () => {
  inTempRepo(() => {
    acquireLock('not-yet.txt', '@claude', 'work');

    const lock = listLocks().find((l) => l.target === 'not-yet.txt');
    assert.equal(lock.pathType, 'new');
    assert.equal(lock.blob, '');
  });
});

test('progressWindow defaults to 900 and honors a positive integer override', () => {
  inTempRepo((root) => {
    assert.equal(getConfig().progressWindow, 900);

    resetConfig();
    mkdirSync(join(root, '.nexus'), { recursive: true });
    writeFileSync(join(root, '.nexus', 'config.json'), '{ "progressWindow": 300 }', 'utf-8');
    assert.equal(getConfig().progressWindow, 300);
  });
});

test('parseAmPmTimestamp reads report and standup stamps and rejects garbage', () => {
  const report = parseAmPmTimestamp('2026-06-12 04:05:06 PM');
  assert.equal(report.getHours(), 16);
  assert.equal(report.getSeconds(), 6);

  const standup = parseAmPmTimestamp('2026-06-12 12:15 AM');
  assert.equal(standup.getHours(), 0);
  assert.equal(standup.getMinutes(), 15);

  assert.equal(parseAmPmTimestamp('not a date'), null);
  assert.equal(parseAmPmTimestamp(''), null);
});

test('readRecentReceipts filters by agent and window', () => {
  inTempRepo((root) => {
    const now = new Date();
    const recent = new Date(now.getTime() - 60 * 1000);
    const old = new Date(now.getTime() - 3600 * 1000);

    writeFileSync(join(root, '_NEXUS_REPORT.md'),
      reportEntry(old, 'old.txt', '@claude')
      + reportEntry(recent, 'mine.txt', '@claude')
      + reportEntry(recent, 'theirs.txt', '@codex'), 'utf-8');

    const receipts = readRecentReceipts('@claude', 900, now);
    assert.equal(receipts.length, 1);
    assert.equal(receipts[0].target, 'mine.txt');
    assert.equal(receipts[0].agent, '@claude');

    const all = readRecentReceipts('', 900, now);
    assert.equal(all.length, 2);

    const unwindowed = readRecentReceipts('@claude', Infinity, now);
    assert.equal(unwindowed.length, 2);
  });
});

test('readLaneNotes returns active tasks and windowed completion receipts', () => {
  inTempRepo((root) => {
    const now = new Date();
    const recentIso = new Date(now.getTime() - 120 * 1000).toISOString();
    const oldIso = new Date(now.getTime() - 7200 * 1000).toISOString();

    writeFileSync(join(root, '_NEXUS_Q_CLAUDE.md'), `# Nexus Queue Lane - @claude

## Active

- [~] TASK/@claude: Build the thing
  - Id: build-thing
  - Status: Delegated

## Completed

- [x] old-task
  - Id: old-task
  - Agent: @claude
  - Completed at: ${oldIso}
  - Receipt: pending reconciliation

- [x] fresh-task
  - Id: fresh-task
  - Agent: @claude
  - Completed at: ${recentIso}
  - Receipt: pending reconciliation
`, 'utf-8');

    const lane = readLaneNotes('@claude', 900, now);
    assert.equal(lane.lane, '_NEXUS_Q_CLAUDE.md');
    assert.equal(lane.active.length, 1);
    assert.equal(lane.active[0].id, 'build-thing');
    assert.equal(lane.completed.length, 2);
    assert.equal(lane.recentReceipts.length, 1);
    assert.equal(lane.recentReceipts[0].id, 'fresh-task');

    const missing = readLaneNotes('@gemini', 900, now);
    assert.equal(missing.active.length, 0);
    assert.equal(missing.recentReceipts.length, 0);
  });
});

test('readVerifyFailures parses standup [BLOCKED] verify lines within the window', () => {
  inTempRepo((root) => {
    const now = new Date();
    const recent = new Date(now.getTime() - 300 * 1000);
    const ancient = new Date(now.getTime() - 48 * 3600 * 1000);

    writeFileSync(join(root, '_NEXUS_STANDUP.md'), [
      `${standupStamp(recent)} @claude [BLOCKED]: release file.txt refused — verify failed (npm test)`,
      `${standupStamp(recent)} @codex [BLOCKED]: release other.txt refused — verify failed (npm test)`,
      `${standupStamp(ancient)} @claude [BLOCKED]: release file.txt refused — verify failed (npm test)`,
      `${standupStamp(recent)} @claude [INFO]: unrelated chatter`,
    ].join('\n'), 'utf-8');

    const mine = readVerifyFailures('@claude', 24 * 3600, now);
    assert.equal(mine.length, 1);
    assert.equal(mine[0].target, 'file.txt');

    const everyone = readVerifyFailures('', 24 * 3600, now);
    assert.equal(everyone.length, 2);
  });
});

test('evaluateLockProgress detects blob movement as progress', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, 'file.txt'), 'v1\n', 'utf-8');
    acquireLock('file.txt', '@claude', 'work');
    const lock = listLocks().find((l) => l.target === 'file.txt');

    const before = evaluateLockProgress(lock);
    assert.equal(before.progressing, false);
    assert.equal(before.window, 900);

    writeFileSync(join(root, 'file.txt'), 'v2\n', 'utf-8');
    const after = evaluateLockProgress(lock);
    assert.equal(after.progressing, true);
    assert.match(after.signals[0], /blob moved/);
  });
});

test('evaluateLockProgress counts a recent release receipt as progress', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, 'file.txt'), 'v1\n', 'utf-8');
    acquireLock('file.txt', '@claude', 'work');
    const lock = listLocks().find((l) => l.target === 'file.txt');

    const now = new Date();
    writeFileSync(join(root, '_NEXUS_REPORT.md'),
      reportEntry(new Date(now.getTime() - 60 * 1000), 'other.txt', '@claude'), 'utf-8');

    const result = evaluateLockProgress(lock, { now });
    assert.equal(result.progressing, true);
    assert.match(result.signals[0], /release receipt/);
  });
});

test('evaluateLockProgress counts a recent lane receipt as progress', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, 'file.txt'), 'v1\n', 'utf-8');
    acquireLock('file.txt', '@claude', 'work');
    const lock = listLocks().find((l) => l.target === 'file.txt');

    const now = new Date();
    writeFileSync(join(root, '_NEXUS_Q_CLAUDE.md'), `# Nexus Queue Lane - @claude

## Active

## Completed

- [x] fresh-task
  - Id: fresh-task
  - Agent: @claude
  - Completed at: ${new Date(now.getTime() - 60 * 1000).toISOString()}
  - Receipt: pending reconciliation
`, 'utf-8');

    const result = evaluateLockProgress(lock, { now });
    assert.equal(result.progressing, true);
    assert.match(result.signals[0], /lane receipt/);
  });
});

test('evaluateLockProgress uses git status for directory claims', () => {
  inTempRepo((root) => {
    mkdirSync(join(root, 'src'));
    writeFileSync(join(root, 'src', 'a.txt'), 'a\n', 'utf-8');
    spawnSync('git', ['add', '.'], { cwd: root, stdio: 'pipe' });
    spawnSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-m', 'init'], { cwd: root, stdio: 'pipe' });

    acquireLock('src', '@claude', 'work');
    const lock = listLocks().find((l) => l.target === 'src');

    const clean = evaluateLockProgress(lock);
    assert.equal(clean.progressing, false);

    writeFileSync(join(root, 'src', 'b.txt'), 'b\n', 'utf-8');
    const dirty = evaluateLockProgress(lock);
    assert.equal(dirty.progressing, true);
    assert.match(dirty.signals[0], /uncommitted changes/);
  });
});

test('evaluateLockProgress treats creation of a claimed new path as progress', () => {
  inTempRepo((root) => {
    acquireLock('not-yet.txt', '@claude', 'work');
    const lock = listLocks().find((l) => l.target === 'not-yet.txt');

    assert.equal(evaluateLockProgress(lock).progressing, false);

    writeFileSync(join(root, 'not-yet.txt'), 'now it exists\n', 'utf-8');
    assert.equal(evaluateLockProgress(lock).progressing, true);
  });
});

test('evaluateLocksProgress maps each lock target to a result', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, 'moving.txt'), 'v1\n', 'utf-8');
    writeFileSync(join(root, 'idle.txt'), 'v1\n', 'utf-8');
    acquireLock('moving.txt', '@claude', 'work');
    acquireLock('idle.txt', '@claude', 'work');
    writeFileSync(join(root, 'moving.txt'), 'v2\n', 'utf-8');

    const results = evaluateLocksProgress(listLocks());
    assert.equal(results.get('moving.txt').progressing, true);
    assert.equal(results.get('idle.txt').progressing, false);
  });
});

test('readAgentTrace assembles locks, receipts, lane state, and verify failures', () => {
  inTempRepo((root) => {
    const now = new Date();
    writeFileSync(join(root, 'file.txt'), 'v1\n', 'utf-8');
    acquireLock('file.txt', '@claude', 'work');
    writeFileSync(join(root, '_NEXUS_REPORT.md'),
      reportEntry(new Date(now.getTime() - 60 * 1000), 'done.txt', '@claude'), 'utf-8');
    writeFileSync(join(root, '_NEXUS_STANDUP.md'),
      `${standupStamp(now)} @claude [BLOCKED]: release file.txt refused — verify failed (npm test)\n`, 'utf-8');

    const trace = readAgentTrace('@claude', { now });
    assert.equal(trace.agent, '@claude');
    assert.equal(trace.window, 900);
    assert.equal(trace.locks.length, 1);
    assert.equal(trace.receipts.length, 1);
    assert.equal(trace.lane.lane, '_NEXUS_Q_CLAUDE.md');
    assert.equal(trace.verifyFailures.length, 1);
  });
});

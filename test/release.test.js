import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { chdir, cwd } from 'process';
import { spawnSync } from 'child_process';
import { stageAndCommit } from '../src/lib/git.js';
import release from '../src/commands/release.js';
import { acquireLock, listLocks } from '../src/lib/lockManager.js';
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

function capture(fn) {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const lines = [];
  console.log = (...args) => lines.push(args.join(' '));
  console.warn = (...args) => lines.push(args.join(' '));

  try {
    fn();
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
  }

  return lines.join('\n');
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

test('release --help prints release usage without requiring a target', () => {
  inTempRepo(() => {
    const output = capture(() => release(['--help']));

    assert.match(output, /Usage: nexus release <filepath_or_dir>/);
    assert.match(output, /--include-preexisting/);
    assert.match(output, /--no-verify/);
  });
});

test('release appends structured report entry', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, 'file.txt'), 'hello\n', 'utf-8');
    spawnSync('git', ['add', 'file.txt'], { cwd: root, stdio: 'pipe' });
    spawnSync('git', ['commit', '-m', 'init'], { cwd: root, stdio: 'pipe' });
    acquireLock('file.txt', '@codex', 'test release report');
    writeFileSync(join(root, 'file.txt'), 'hello again\n', 'utf-8');

    release(['file.txt', 'test release report']);

    const report = readFileSync(join(root, '_NEXUS_REPORT.md'), 'utf-8');
    assert.match(report, /## \[\d{4}-\d\d-\d\d \d\d:\d\d:\d\d (AM|PM)\] file\.txt/);
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
    acquireLock('file.txt', '@codex', 'test release ledger');
    writeFileSync(join(root, 'file.txt'), 'hello again\n', 'utf-8');

    release(['file.txt', 'release-ledger-data: test release ledger']);

    const ledger = readFileSync(join(root, '_NEXUS_LEDGER.md'), 'utf-8');
    assert.match(ledger, /## release-ledger-data/);
    assert.match(ledger, /- Agent: @codex/);
    assert.match(ledger, /- Files: file\.txt/);
    assert.match(ledger, /- Commit: release-ledger-data: test release ledger/);
  });
});

test('release without a lock falls back to NEXUS_AGENT for commit and ledger attribution', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, 'file.txt'), 'hello\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), [
      '- [x] TASK/Claude: Lockless release task',
      '  - Id: lockless-release',
      '  - Epic: Loop readiness',
      '  - Files: file.txt',
      '  - Cost: small',
    ].join('\n'), 'utf-8');
    spawnSync('git', ['add', '.'], { cwd: root, stdio: 'pipe' });
    spawnSync('git', ['commit', '-m', 'init'], { cwd: root, stdio: 'pipe' });
    writeFileSync(join(root, 'file.txt'), 'hello again\n', 'utf-8');

    const originalEnv = process.env.NEXUS_AGENT;
    process.env.NEXUS_AGENT = '@claude';
    const originalWarn = console.warn;
    console.warn = () => {};
    try {
      release(['file.txt', 'lockless-release: close it']);
    } finally {
      console.warn = originalWarn;
      if (originalEnv === undefined) delete process.env.NEXUS_AGENT;
      else process.env.NEXUS_AGENT = originalEnv;
    }

    const log = spawnSync('git', ['log', '-1', '--pretty=%s'], { cwd: root, encoding: 'utf-8' }).stdout.trim();
    assert.equal(log, '[@claude] lockless-release: close it');
    const ledger = readFileSync(join(root, '_NEXUS_LEDGER.md'), 'utf-8');
    assert.match(ledger, /- Agent: @claude/);
  });
});

test('release without a lock or NEXUS_AGENT attributes the ledger entry to the task owner', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, 'file.txt'), 'hello\n', 'utf-8');
    writeFileSync(join(root, '_NEXUS_QUEUE.md'), [
      '- [x] TASK/Gemini: Ownerless lock release task',
      '  - Id: ownerless-lock-release',
      '  - Epic: Loop readiness',
      '  - Files: file.txt',
      '  - Cost: small',
    ].join('\n'), 'utf-8');
    spawnSync('git', ['add', '.'], { cwd: root, stdio: 'pipe' });
    spawnSync('git', ['commit', '-m', 'init'], { cwd: root, stdio: 'pipe' });
    writeFileSync(join(root, 'file.txt'), 'hello again\n', 'utf-8');

    const originalEnv = process.env.NEXUS_AGENT;
    delete process.env.NEXUS_AGENT;
    const originalWarn = console.warn;
    console.warn = () => {};
    try {
      release(['file.txt', 'ownerless-lock-release: close it']);
    } finally {
      console.warn = originalWarn;
      if (originalEnv !== undefined) process.env.NEXUS_AGENT = originalEnv;
    }

    const ledger = readFileSync(join(root, '_NEXUS_LEDGER.md'), 'utf-8');
    assert.match(ledger, /- Agent: @gemini/);
    assert.doesNotMatch(ledger, /- Agent: unknown/);
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

test('release does not warn for same-agent back-to-back releases', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, 'alpha.txt'), 'alpha\n', 'utf-8');
    writeFileSync(join(root, 'beta.txt'), 'beta\n', 'utf-8');
    spawnSync('git', ['add', 'alpha.txt', 'beta.txt'], { cwd: root, stdio: 'pipe' });
    spawnSync('git', ['commit', '-m', 'init'], { cwd: root, stdio: 'pipe' });
    acquireLock('alpha.txt', '@codex', 'release alpha');
    acquireLock('beta.txt', '@codex', 'release beta');

    writeFileSync(join(root, 'alpha.txt'), 'alpha released\n', 'utf-8');
    release(['alpha.txt', 'release alpha']);

    writeFileSync(join(root, 'beta.txt'), 'beta released\n', 'utf-8');
    const warnings = [];
    const originalWarn = console.warn;
    console.warn = (message) => warnings.push(String(message));
    try {
      release(['beta.txt', 'release beta']);
    } finally {
      console.warn = originalWarn;
    }

    assert.equal(warnings.filter((warning) => /HEAD changed since claim/.test(warning)).length, 0);
    const log = spawnSync('git', ['log', '--pretty=%s', '-2'], { cwd: root, encoding: 'utf-8' }).stdout.trim();
    assert.match(log, /\[@codex\] release beta/);
    assert.match(log, /\[@codex\] release alpha/);
  });
});

function captureExit(fn) {
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
    assert.throws(fn, /process\.exit 1/);
  } finally {
    console.log = originalLog;
    console.error = originalError;
    process.exit = originalExit;
  }

  return lines.join('\n');
}

function seedVerifyRepo(root, verifyCommand, autonomy = 0) {
  mkdirSync(join(root, '.nexus'), { recursive: true });
  writeFileSync(join(root, '.nexus', 'config.json'), JSON.stringify({
    autonomy,
    release: { verifyCommand },
  }), 'utf-8');
  resetConfig();
  writeFileSync(join(root, 'file.txt'), 'hello\n', 'utf-8');
  spawnSync('git', ['add', 'file.txt'], { cwd: root, stdio: 'pipe' });
  spawnSync('git', ['commit', '-m', 'init'], { cwd: root, stdio: 'pipe' });
  acquireLock('file.txt', '@codex', 'verify gate test');
  writeFileSync(join(root, 'file.txt'), 'hello again\n', 'utf-8');
}

test('release runs the configured verify command before committing', () => {
  inTempRepo((root) => {
    seedVerifyRepo(root, `node -e "require('fs').writeFileSync('verify-ran.txt','ok')"`);

    release(['file.txt', 'verified release']);

    assert.ok(existsSync(join(root, 'verify-ran.txt')), 'verify command must run');
    const log = spawnSync('git', ['log', '-1', '--pretty=%s'], { cwd: root, encoding: 'utf-8' }).stdout.trim();
    assert.equal(log, '[@codex] verified release');
  });
});

test('release refuses on verify failure, keeps the claim, and logs to standup', () => {
  inTempRepo((root) => {
    seedVerifyRepo(root, 'node -e "console.error(`boom: broken suite`); process.exit(1)"');

    const output = captureExit(() => release(['file.txt', 'should not commit']));

    assert.match(output, /\[VERIFY FAILED\]/);
    assert.match(output, /claim on file\.txt is kept/);
    assert.match(output, /boom: broken suite/);
    assert.ok(listLocks().find((lock) => lock.target === 'file.txt'), 'claim must survive a failed verify');
    const log = spawnSync('git', ['log', '-1', '--pretty=%s'], { cwd: root, encoding: 'utf-8' }).stdout.trim();
    assert.equal(log, 'init', 'nothing may be committed on verify failure');
    const standup = readFileSync(join(root, '_NEXUS_STANDUP.md'), 'utf-8');
    assert.match(standup, /@codex \[BLOCKED\]: release file\.txt refused — verify failed/);
  });
});

test('release --no-verify is allowed at autonomy 0 but logged loudly', () => {
  inTempRepo((root) => {
    seedVerifyRepo(root, 'node -e "process.exit(1)"', 0);

    release(['file.txt', 'skipped verify', '--no-verify']);

    const log = spawnSync('git', ['log', '-1', '--pretty=%s'], { cwd: root, encoding: 'utf-8' }).stdout.trim();
    assert.equal(log, '[@codex] skipped verify');
    const standup = readFileSync(join(root, '_NEXUS_STANDUP.md'), 'utf-8');
    assert.match(standup, /@codex \[WARN\]: release file\.txt committed with --no-verify/);
  });
});

test('release --no-verify is refused at autonomy 1 or higher', () => {
  inTempRepo((root) => {
    seedVerifyRepo(root, 'node -e "process.exit(1)"', 1);

    const output = captureExit(() => release(['file.txt', 'should not commit', '--no-verify']));

    assert.match(output, /--no-verify is only allowed at autonomy level 0/);
    assert.ok(listLocks().find((lock) => lock.target === 'file.txt'));
    const log = spawnSync('git', ['log', '-1', '--pretty=%s'], { cwd: root, encoding: 'utf-8' }).stdout.trim();
    assert.equal(log, 'init');
    const standup = readFileSync(join(root, '_NEXUS_STANDUP.md'), 'utf-8');
    assert.match(standup, /@codex \[BLOCKED\]: release file\.txt attempted --no-verify at autonomy 1/);
  });
});

// Regression for the 2026-07-06 Mooncrafting sweep: another agent's
// uncommitted work sat in the file before the claim, and release silently
// committed it under the releasing agent's message.
test('release refuses to sweep changes that predate the claim and keeps the claim', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, 'file.txt'), 'hello\n', 'utf-8');
    spawnSync('git', ['add', 'file.txt'], { cwd: root, stdio: 'pipe' });
    spawnSync('git', ['commit', '-m', 'init'], { cwd: root, stdio: 'pipe' });

    writeFileSync(join(root, 'file.txt'), 'hello\nforeign uncommitted work\n', 'utf-8');
    const warnings = [];
    const originalWarn = console.warn;
    console.warn = (message) => warnings.push(message);
    try {
      acquireLock('file.txt', '@codex', 'sweep guard test');
    } finally {
      console.warn = originalWarn;
    }
    writeFileSync(join(root, 'file.txt'), 'hello\nforeign uncommitted work\nmy claimed work\n', 'utf-8');

    const output = captureExit(() => release(['file.txt', 'should not commit']));

    assert.match(output, /\[DIFF\] Changes to be committed for file\.txt/);
    assert.match(output, /uncommitted changes before this claim/);
    assert.match(output, /--include-preexisting/);
    assert.match(output, /claim on file\.txt is kept/);
    assert.ok(listLocks().find((lock) => lock.target === 'file.txt'), 'claim must survive the refusal');
    const log = spawnSync('git', ['log', '-1', '--pretty=%s'], { cwd: root, encoding: 'utf-8' }).stdout.trim();
    assert.equal(log, 'init', 'nothing may be committed when pre-claim changes are present');
    const standup = readFileSync(join(root, '_NEXUS_STANDUP.md'), 'utf-8');
    assert.match(standup, /@codex \[BLOCKED\]: release file\.txt refused — pre-claim uncommitted changes present/);
  });
});

test('release --include-preexisting commits pre-claim changes with a loud warning', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, 'file.txt'), 'hello\n', 'utf-8');
    spawnSync('git', ['add', 'file.txt'], { cwd: root, stdio: 'pipe' });
    spawnSync('git', ['commit', '-m', 'init'], { cwd: root, stdio: 'pipe' });

    writeFileSync(join(root, 'file.txt'), 'hello\npre-claim work\n', 'utf-8');
    const warnings = [];
    const originalWarn = console.warn;
    console.warn = (message) => warnings.push(String(message));
    try {
      acquireLock('file.txt', '@codex', 'sweep override test');
      writeFileSync(join(root, 'file.txt'), 'hello\npre-claim work\nclaimed work\n', 'utf-8');
      release(['file.txt', 'explicit sweep', '--include-preexisting']);
    } finally {
      console.warn = originalWarn;
    }

    assert.ok(warnings.some((w) => /predate the claim/.test(w) && /--include-preexisting/.test(w)), 'release must warn when sweeping');
    const log = spawnSync('git', ['log', '-1', '--pretty=%s'], { cwd: root, encoding: 'utf-8' }).stdout.trim();
    assert.equal(log, '[@codex] explicit sweep');
    const content = spawnSync('git', ['show', 'HEAD:file.txt'], { cwd: root, encoding: 'utf-8' }).stdout;
    assert.match(content, /pre-claim work/);
    assert.match(content, /claimed work/);
  });
});

test('release prints a diffstat of pending changes before committing', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, 'file.txt'), 'hello\n', 'utf-8');
    spawnSync('git', ['add', 'file.txt'], { cwd: root, stdio: 'pipe' });
    spawnSync('git', ['commit', '-m', 'init'], { cwd: root, stdio: 'pipe' });
    acquireLock('file.txt', '@codex', 'diffstat test');
    writeFileSync(join(root, 'file.txt'), 'hello\nclaimed work\n', 'utf-8');

    const lines = [];
    const originalLog = console.log;
    console.log = (...args) => lines.push(args.join(' '));
    try {
      release(['file.txt', 'diffstat release']);
    } finally {
      console.log = originalLog;
    }

    const output = lines.join('\n');
    assert.match(output, /\[DIFF\] Changes to be committed for file\.txt/);
    assert.match(output, /file\.txt \|/);
  });
});

test('release skips report append when releasing _NEXUS_REPORT.md', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, '_NEXUS_REPORT.md'), '# Report\n\nExisting receipt\n', 'utf-8');
    spawnSync('git', ['add', '_NEXUS_REPORT.md'], { cwd: root, stdio: 'pipe' });
    spawnSync('git', ['commit', '-m', 'init report'], { cwd: root, stdio: 'pipe' });
    acquireLock('_NEXUS_REPORT.md', '@codex', 'test report self-noise');
    writeFileSync(join(root, '_NEXUS_REPORT.md'), '# Report\n\nExisting receipt\n\nManual cleanup\n', 'utf-8');

    release(['_NEXUS_REPORT.md', 'test report self-noise']);

    const report = readFileSync(join(root, '_NEXUS_REPORT.md'), 'utf-8');
    assert.equal(report, '# Report\n\nExisting receipt\n\nManual cleanup\n');
    const log = spawnSync('git', ['log', '-1', '--pretty=%s'], { cwd: root, encoding: 'utf-8' }).stdout.trim();
    assert.equal(log, '[@codex] test report self-noise');
  });
});

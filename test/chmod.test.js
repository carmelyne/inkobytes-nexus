import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { chdir, cwd } from 'process';
import chmod from '../src/commands/chmod.js';
import { parsePermissions, loadPermissions } from '../src/lib/permissions.js';

function inTempRepo(fn) {
  const previous = cwd();
  const root = mkdtempSync(join(tmpdir(), 'nexus-chmod-'));
  chdir(root);

  try {
    return fn(root);
  } finally {
    chdir(previous);
  }
}

// The chmod session gate reads CLAUDECODE / NEXUS_AGENT from the live env.
function withSessionEnv(values, fn) {
  const keys = ['CLAUDECODE', 'NEXUS_AGENT'];
  const original = {};
  for (const key of keys) {
    original[key] = process.env[key];
    delete process.env[key];
  }
  Object.assign(process.env, values);

  try {
    return fn();
  } finally {
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  }
}

function capture(fn) {
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

function captureExit(fn) {
  const originalError = console.error;
  const originalExit = process.exit;
  const lines = [];
  console.error = (...args) => lines.push(args.join(' '));
  process.exit = (code) => {
    throw Object.assign(new Error(`process.exit ${code}`), { code });
  };

  try {
    assert.throws(fn, /process\.exit 1/);
  } finally {
    console.error = originalError;
    process.exit = originalExit;
  }

  return lines.join('\n');
}

test('parsePermissions reads entries and skips comments and invalid perms', () => {
  const entries = parsePermissions([
    '# comment line',
    '',
    'USER.md            r-x    all',
    './docs/guide.md    rw-    @claude',
    'broken.md          zzz    all',
    'orphan.md',
  ].join('\n'));

  assert.deepEqual(entries, [
    { path: 'USER.md', perms: 'r-x', agent: 'all' },
    { path: 'docs/guide.md', perms: 'rw-', agent: '@claude' },
  ]);
});

test('chmod --init scaffolds defaults and --list labels the x bit honestly', () => {
  inTempRepo(() => {
    capture(() => chmod(['--init']));

    const output = capture(() => chmod(['--list']));

    assert.match(output, /promptCHMOD — permission matrix/);
    assert.match(output, /USER\.md.*r-x.*authoritative/);
    assert.match(output, /_NEXUS_CONSTITUTION\.md.*r--.*reference only/);
  });
});

test('chmod set updates an existing entry and appends a new one', () => {
  inTempRepo(() => {
    withSessionEnv({ NEXUS_AGENT: '@human' }, () => {
      capture(() => chmod(['--init']));

      capture(() => chmod(['USER.md', 'r--']));
      capture(() => chmod(['docs/notes.md', 'r-x', '@claude']));

      const entries = loadPermissions();
      const user = entries.find(e => e.path === 'USER.md');
      const notes = entries.find(e => e.path === 'docs/notes.md');
      assert.equal(user.perms, 'r--');
      assert.deepEqual(notes, { path: 'docs/notes.md', perms: 'r-x', agent: '@claude' });
    });
  });
});

test('chmod rejects malformed perms', () => {
  inTempRepo(() => {
    withSessionEnv({ NEXUS_AGENT: '@human' }, () => {
      const output = captureExit(() => chmod(['USER.md', 'rwxs']));

      assert.match(output, /perms must be 3 chars/);
    });
  });
});

test('chmod set in an unrecognized session refuses with advisory wording, not enforcement claims', () => {
  inTempRepo(() => {
    withSessionEnv({}, () => {
      const output = captureExit(() => chmod(['USER.md', 'r--']));

      assert.match(output, /advisory, not enforcement/);
      assert.doesNotMatch(output, /cannot self-elevate/);
    });
  });
});

test('the live matrix and DEFAULT_MATRIX document the advisory threat model', () => {
  inTempRepo(() => {
    capture(() => chmod(['--init']));

    const content = readFileSync('_NEXUS_CHMOD.md', 'utf-8');
    assert.match(content, /not mechanically enforced/);
    assert.match(content, /prompt-injection surface/);
  });
});

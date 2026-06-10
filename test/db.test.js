import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { chdir, cwd } from 'process';
import db from '../src/commands/db.js';

const BACKUP_DIR = '.nexus/db-backups';

function inTempRepo(fn) {
  const previous = cwd();
  const root = mkdtempSync(join(tmpdir(), 'nexus-db-'));
  chdir(root);

  try {
    return fn(root);
  } finally {
    chdir(previous);
    process.exitCode = undefined;
  }
}

function capture(fn) {
  const originalLog = console.log;
  const originalError = console.error;
  const lines = [];
  console.log = (...args) => lines.push(args.join(' '));
  console.error = (...args) => lines.push(args.join(' '));

  try {
    fn();
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }

  return lines.join('\n');
}

function captureExit(fn) {
  const originalError = console.error;
  const originalLog = console.log;
  const originalExit = process.exit;
  const lines = [];
  console.error = (...args) => lines.push(args.join(' '));
  console.log = (...args) => lines.push(args.join(' '));
  process.exit = (code) => {
    throw Object.assign(new Error(`process.exit ${code}`), { code });
  };

  try {
    assert.throws(fn, /process\.exit 1/);
  } finally {
    console.error = originalError;
    console.log = originalLog;
    process.exit = originalExit;
  }

  return lines.join('\n');
}

function latestStamp(root) {
  return readdirSync(join(root, BACKUP_DIR)).sort().pop();
}

const DB_URL_VARS = ['DATABASE_URL', 'POSTGRES_URL', 'MYSQL_URL'];

// Shadows a real binary with a recorder script so we can assert exactly what
// argv the command received — the injection tests hinge on this.
function withFakeBin(root, names, urlEnv, fn) {
  const binDir = join(root, 'fake-bin');
  mkdirSync(binDir, { recursive: true });
  const argsFiles = {};
  for (const name of names) {
    argsFiles[name] = join(binDir, `${name}-args.txt`);
    writeFileSync(join(binDir, name), `#!/bin/sh\nprintf '%s\\n' "$@" > "${argsFiles[name]}"\nexit 0\n`, { mode: 0o755 });
  }

  const originalPath = process.env.PATH;
  const originalUrls = {};
  for (const key of DB_URL_VARS) {
    originalUrls[key] = process.env[key];
    delete process.env[key];
  }
  process.env.PATH = `${binDir}:${originalPath}`;
  Object.assign(process.env, urlEnv);

  try {
    return fn(argsFiles);
  } finally {
    process.env.PATH = originalPath;
    for (const key of DB_URL_VARS) {
      if (originalUrls[key] === undefined) delete process.env[key];
      else process.env[key] = originalUrls[key];
    }
  }
}

const HOSTILE_URL = 'mysql://u:p@host/db"; touch pwned; echo "';

test('nested sqlite backup and restore round trip preserves the original path', () => {
  inTempRepo((root) => {
    mkdirSync(join(root, 'data'), { recursive: true });
    writeFileSync(join(root, 'data', 'app.sqlite'), 'original-content', 'utf-8');

    capture(() => db(['backup']));

    const stamp = latestStamp(root);
    const manifest = JSON.parse(readFileSync(join(root, BACKUP_DIR, stamp, 'manifest.json'), 'utf-8'));
    assert.equal(manifest.dbs.length, 1);
    assert.equal(manifest.dbs[0].path, join('data', 'app.sqlite'));
    assert.ok(existsSync(join(root, BACKUP_DIR, stamp, 'data', 'app.sqlite')));

    writeFileSync(join(root, 'data', 'app.sqlite'), 'corrupted', 'utf-8');

    const output = capture(() => db(['restore', stamp]));

    assert.match(output, /✓ sqlite app\.sqlite/);
    assert.equal(readFileSync(join(root, 'data', 'app.sqlite'), 'utf-8'), 'original-content');
    assert.ok(!existsSync(join(root, 'app.sqlite')), 'restore must not write to repo root');
  });
});

test('same-named sqlite files in different directories do not collide in backup', () => {
  inTempRepo((root) => {
    mkdirSync(join(root, 'data'), { recursive: true });
    mkdirSync(join(root, 'archive'), { recursive: true });
    writeFileSync(join(root, 'data', 'app.sqlite'), 'data-copy', 'utf-8');
    writeFileSync(join(root, 'archive', 'app.sqlite'), 'archive-copy', 'utf-8');

    capture(() => db(['backup']));

    const stamp = latestStamp(root);
    assert.equal(readFileSync(join(root, BACKUP_DIR, stamp, 'data', 'app.sqlite'), 'utf-8'), 'data-copy');
    assert.equal(readFileSync(join(root, BACKUP_DIR, stamp, 'archive', 'app.sqlite'), 'utf-8'), 'archive-copy');
  });
});

test('restore exits loudly when the backup has no manifest', () => {
  inTempRepo((root) => {
    mkdirSync(join(root, BACKUP_DIR, 'some-stamp'), { recursive: true });

    const output = captureExit(() => db(['restore', 'some-stamp']));

    assert.match(output, /No manifest in backup some-stamp/);
  });
});

test('restore skips entries whose backup was incomplete', () => {
  inTempRepo((root) => {
    mkdirSync(join(root, 'data'), { recursive: true });
    writeFileSync(join(root, 'data', 'app.sqlite'), 'live-content', 'utf-8');

    const stampDir = join(root, BACKUP_DIR, 'partial-stamp');
    mkdirSync(stampDir, { recursive: true });
    writeFileSync(join(stampDir, 'manifest.json'), JSON.stringify({
      stamp: 'partial-stamp',
      root,
      dbs: [{ db: 'app.sqlite', path: 'data/app.sqlite', type: 'sqlite', ok: false, error: 'boom' }],
    }), 'utf-8');

    const output = capture(() => db(['restore', 'partial-stamp']));

    assert.match(output, /skip app\.sqlite — backup was incomplete/);
    assert.equal(readFileSync(join(root, 'data', 'app.sqlite'), 'utf-8'), 'live-content');
  });
});

test('restore fails loudly when the original directory is gone', () => {
  inTempRepo((root) => {
    mkdirSync(join(root, 'data'), { recursive: true });
    writeFileSync(join(root, 'data', 'app.sqlite'), 'original-content', 'utf-8');

    capture(() => db(['backup']));
    const stamp = latestStamp(root);

    rmSync(join(root, 'data'), { recursive: true, force: true });

    const output = capture(() => db(['restore', stamp]));

    assert.match(output, /✗ sqlite app\.sqlite: original directory is gone/);
    assert.equal(process.exitCode, 1);
    assert.ok(!existsSync(join(root, 'app.sqlite')), 'must not silently restore to repo root');
  });
});

test('mysql backup passes a hostile DATABASE_URL as a literal argument, never a shell string', () => {
  inTempRepo((root) => {
    withFakeBin(root, ['mysqldump'], { MYSQL_URL: HOSTILE_URL }, (argsFiles) => {
      capture(() => db(['backup']));

      assert.equal(readFileSync(argsFiles.mysqldump, 'utf-8'), `${HOSTILE_URL}\n`);
      assert.ok(!existsSync(join(root, 'pwned')), 'hostile URL must never reach a shell');
    });
  });
});

test('mysql restore passes a hostile DATABASE_URL as a literal argument, never a shell string', () => {
  inTempRepo((root) => {
    const stampDir = join(root, BACKUP_DIR, 'mysql-stamp');
    mkdirSync(stampDir, { recursive: true });
    writeFileSync(join(stampDir, 'dump.sql'), '-- dump', 'utf-8');
    writeFileSync(join(stampDir, 'manifest.json'), JSON.stringify({
      stamp: 'mysql-stamp',
      root,
      dbs: [{ db: 'mysql', type: 'mysql', file: 'dump.sql', ok: true }],
    }), 'utf-8');

    withFakeBin(root, ['mysql'], { MYSQL_URL: HOSTILE_URL }, (argsFiles) => {
      const output = capture(() => db(['restore', 'mysql-stamp']));

      assert.match(output, /✓ mysql restored/);
      assert.equal(readFileSync(argsFiles.mysql, 'utf-8'), `${HOSTILE_URL}\n`);
      assert.ok(!existsSync(join(root, 'pwned')), 'hostile URL must never reach a shell');
    });
  });
});

test('legacy manifests without path fall back to the recorded name', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, 'app.sqlite'), 'stale', 'utf-8');

    const stampDir = join(root, BACKUP_DIR, 'legacy-stamp');
    mkdirSync(stampDir, { recursive: true });
    writeFileSync(join(stampDir, 'app.sqlite'), 'legacy-backup', 'utf-8');
    writeFileSync(join(stampDir, 'manifest.json'), JSON.stringify({
      stamp: 'legacy-stamp',
      root,
      dbs: [{ db: 'app.sqlite', type: 'sqlite', file: 'app.sqlite', ok: true }],
    }), 'utf-8');

    const output = capture(() => db(['restore', 'legacy-stamp']));

    assert.match(output, /✓ sqlite app\.sqlite/);
    assert.equal(readFileSync(join(root, 'app.sqlite'), 'utf-8'), 'legacy-backup');
  });
});

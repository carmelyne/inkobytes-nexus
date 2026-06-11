import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { cwd, chdir } from 'process';
import { spawnSync } from 'child_process';
import { resetConfig, getConfig } from '../src/lib/config.js';
import { dumpState, freshnessReceipt } from '../src/lib/dump.js';

function inTempRepo(fn) {
  const previous = cwd();
  const root = mkdtempSync(join(tmpdir(), 'nexus-dump-'));
  chdir(root);
  resetConfig();
  try {
    return fn(root);
  } finally {
    chdir(previous);
    resetConfig();
  }
}

test('dumpState on a non-existent file includes the new file message', () => {
  inTempRepo(() => {
    const output = dumpState('nonexistent.md');
    assert.ok(output.includes('(New file/dir — does not exist yet)'));
  });
});

test('output always starts with START marker and ends with END marker', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, 'test.md'), 'hello world');
    const output = dumpState('test.md');
    assert.ok(output.startsWith('--- START OF FRESH FILE STATE ---'));
    assert.ok(output.endsWith('--- END OF FRESH FILE STATE ---'));
  });
});

test('dumpState on an existing file includes its content between markers', () => {
  inTempRepo((root) => {
    const content = 'This is the file content.\nLine two.';
    writeFileSync(join(root, 'myfile.txt'), content);
    const output = dumpState('myfile.txt');
    assert.ok(output.includes(content));
    assert.ok(output.startsWith('--- START OF FRESH FILE STATE ---'));
    assert.ok(output.endsWith('--- END OF FRESH FILE STATE ---'));
  });
});

test('dumpState on a non-existent file still has START and END markers', () => {
  inTempRepo(() => {
    const output = dumpState('does-not-exist.txt');
    assert.ok(output.startsWith('--- START OF FRESH FILE STATE ---'));
    assert.ok(output.endsWith('--- END OF FRESH FILE STATE ---'));
  });
});

test('dumpState on a directory includes all file contents', () => {
  inTempRepo((root) => {
    const dir = join(root, 'mydir');
    mkdirSync(dir);
    writeFileSync(join(dir, 'a.txt'), 'content of a');
    writeFileSync(join(dir, 'b.txt'), 'content of b');
    const output = dumpState('mydir');
    assert.ok(output.includes('content of a'));
    assert.ok(output.includes('content of b'));
    assert.ok(output.startsWith('--- START OF FRESH FILE STATE ---'));
    assert.ok(output.endsWith('--- END OF FRESH FILE STATE ---'));
  });
});

test('dumpState on a directory includes file path headers', () => {
  inTempRepo((root) => {
    const dir = join(root, 'docs');
    mkdirSync(dir);
    writeFileSync(join(dir, 'readme.txt'), 'readme content');
    const output = dumpState('docs');
    assert.ok(output.includes('=== '));
    assert.ok(output.includes('readme.txt'));
  });
});

test('dumpState on a directory exceeding maxDumpFiles includes WARN and truncates', () => {
  inTempRepo((root) => {
    const config = getConfig();
    const limit = config.maxDumpFiles;
    const dir = join(root, 'bigdir');
    mkdirSync(dir);
    for (let i = 0; i < limit + 3; i++) {
      writeFileSync(join(dir, `file${String(i).padStart(3, '0')}.txt`), `content ${i}`);
    }
    const output = dumpState('bigdir');
    assert.ok(output.includes('[WARN]'));
    assert.ok(output.includes(`Showing first ${limit}`));
    assert.ok(output.includes('=== ... and 3 more files ==='));
  });
});

test('dumpState on a nested directory recurses into subdirectories', () => {
  inTempRepo((root) => {
    const dir = join(root, 'nested');
    const subdir = join(dir, 'sub');
    mkdirSync(subdir, { recursive: true });
    writeFileSync(join(dir, 'top.txt'), 'top level');
    writeFileSync(join(subdir, 'deep.txt'), 'deep content');
    const output = dumpState('nested');
    assert.ok(output.includes('top level'));
    assert.ok(output.includes('deep content'));
  });
});

test('freshnessReceipt outside a git repo still hashes content and marks the tree unknown', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, 'plain.txt'), 'one\ntwo\n', 'utf-8');
    const output = freshnessReceipt('plain.txt');
    assert.ok(output.startsWith('--- FRESHNESS RECEIPT ---'));
    assert.ok(output.endsWith('--- END RECEIPT ---'));
    assert.ok(output.includes('Path: plain.txt (3 lines)'));
    assert.match(output, /Blob: [0-9a-f]{40}/);
    assert.ok(output.includes('Working tree: unknown — not a git repo'));
    assert.ok(!output.includes('one\ntwo'));
  });
});

test('freshnessReceipt in a git repo prints blob hash, last commit, and clean state', () => {
  inTempRepo((root) => {
    spawnSync('git', ['init'], { cwd: root, stdio: 'pipe' });
    spawnSync('git', ['config', 'user.email', 't@t.t'], { cwd: root, stdio: 'pipe' });
    spawnSync('git', ['config', 'user.name', 'T'], { cwd: root, stdio: 'pipe' });
    writeFileSync(join(root, 'tracked.txt'), 'hello\n', 'utf-8');
    spawnSync('git', ['add', 'tracked.txt'], { cwd: root, stdio: 'pipe' });
    spawnSync('git', ['commit', '-m', 'add tracked'], { cwd: root, stdio: 'pipe' });

    const clean = freshnessReceipt('tracked.txt');
    assert.match(clean, /Blob: [0-9a-f]{40}/);
    assert.match(clean, /Last commit: [0-9a-f]+ add tracked/);
    assert.match(clean, /Working tree: clean vs HEAD/);

    const blobBefore = clean.match(/Blob: ([0-9a-f]{40})/)[1];
    writeFileSync(join(root, 'tracked.txt'), 'hello changed\n', 'utf-8');
    const dirty = freshnessReceipt('tracked.txt');
    assert.match(dirty, /Working tree: dirty vs HEAD/);
    const blobAfter = dirty.match(/Blob: ([0-9a-f]{40})/)[1];
    assert.notEqual(blobBefore, blobAfter, 'blob hash must move when content changes');
  });
});

test('freshnessReceipt on a new path says it does not exist yet', () => {
  inTempRepo(() => {
    const output = freshnessReceipt('ghost.txt');
    assert.ok(output.includes('State: new path — does not exist yet'));
  });
});

test('freshnessReceipt on a directory reports file count without contents', () => {
  inTempRepo((root) => {
    const dir = join(root, 'docs');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'a.md'), 'alpha body', 'utf-8');
    writeFileSync(join(dir, 'b.md'), 'beta body', 'utf-8');
    const output = freshnessReceipt('docs');
    assert.ok(output.includes('Path: docs/ (2 files)'));
    assert.ok(!output.includes('alpha body'));
  });
});

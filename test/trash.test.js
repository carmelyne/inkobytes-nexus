import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { chdir, cwd } from 'process';
import trash from '../src/commands/trash.js';
import doctor from '../src/commands/doctor.js';
import init from '../src/commands/init.js';
import { resetConfig } from '../src/lib/config.js';

function inTempRepo(fn) {
  const previous = cwd();
  const root = mkdtempSync(join(tmpdir(), 'nexus-trash-'));
  chdir(root);
  resetConfig();

  try {
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

test('trash moves, lists, and restores a file round trip', () => {
  inTempRepo((root) => {
    mkdirSync(join(root, 'docs'), { recursive: true });
    writeFileSync(join(root, 'docs', 'old.md'), 'delete me softly\n', 'utf-8');

    const moveOutput = captureLogs(() => trash(['docs/old.md', '--reason', 'cleanup']));

    assert.match(moveOutput, /Trashed docs\/old\.md/);
    assert.equal(existsSync(join(root, 'docs', 'old.md')), false);
    const id = moveOutput.match(/id: ([^\s]+)/)?.[1];
    assert.ok(id, 'trash output should include an id');
    assert.equal(readFileSync(join(root, '.nexus', 'trash', 'files', id, 'docs', 'old.md'), 'utf-8'), 'delete me softly\n');

    const listOutput = captureLogs(() => trash(['--list']));
    assert.match(listOutput, new RegExp(`${id} +docs/old\\.md +cleanup`));

    const restoreOutput = captureLogs(() => trash(['--restore', id]));

    assert.match(restoreOutput, /Restored docs\/old\.md/);
    assert.equal(readFileSync(join(root, 'docs', 'old.md'), 'utf-8'), 'delete me softly\n');
    assert.equal(existsSync(join(root, '.nexus', 'trash', 'files', id)), false);
  });
});

test('trash rejects unsafe targets and refuses to overwrite on restore', () => {
  inTempRepo((root) => {
    writeFileSync(join(root, 'old.txt'), 'old\n', 'utf-8');
    const output = captureLogs(() => trash(['old.txt']));
    const id = output.match(/id: ([^\s]+)/)?.[1];
    assert.ok(id);
    writeFileSync(join(root, 'old.txt'), 'new\n', 'utf-8');

    assert.throws(() => trash(['../outside.txt']), /Target must stay inside the repo/);
    assert.throws(() => trash(['.nexus/config.json']), /Target cannot be inside \.nexus/);
    assert.throws(() => trash(['--restore', id]), /Refusing to restore over existing path: old\.txt/);
  });
});

test('trash --hooks scaffolds opt-in Claude delete guard without overwriting settings', () => {
  inTempRepo((root) => {
    const output = captureLogs(() => trash(['--hooks']));

    assert.match(output, /Installed Nexus trash guard hook/);
    assert.match(readFileSync(join(root, '.claude', 'settings.json'), 'utf-8'), /nexus_trash_guard\.py/);
    const hook = readFileSync(join(root, '.claude', 'hooks', 'nexus_trash_guard.py'), 'utf-8');
    assert.match(hook, /NEXUS_TRASH_GUARD_V1/);
    assert.match(hook, /Use nexus trash\./);

    assert.throws(() => trash(['--hooks']), /Refusing to overwrite existing \.claude\/settings\.json/);
  });
});

test('init scaffolds trash safety guidance and gitignore entry', () => {
  inTempRepo((root) => {
    captureLogs(() => init([]));

    assert.match(readFileSync(join(root, '_NEXUS_CONSTITUTION.md'), 'utf-8'), /Rollback-Friendly Deletes/);
    assert.match(readFileSync(join(root, '.gitignore'), 'utf-8'), /\.nexus\/trash\//);
  });
});

test('doctor reports Nexus trash directory size', () => {
  inTempRepo((root) => {
    mkdirSync(join(root, '.nexus', 'trash', 'files', 'sample'), { recursive: true });
    writeFileSync(join(root, '.nexus', 'trash', 'files', 'sample', 'old.txt'), 'old\n', 'utf-8');

    const output = captureLogs(() => doctor([]));

    assert.match(output, /Trash/);
    assert.match(output, /\.nexus\/trash uses/);
  });
});

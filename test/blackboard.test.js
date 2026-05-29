import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { chdir, cwd } from 'process';
import { resetConfig } from '../src/lib/config.js';
import { readBoard, appendEntry, removeEntry, clearBoard, withLock } from '../src/lib/blackboard.js';

function inTempRepo(fn) {
  const previous = cwd();
  const root = mkdtempSync(join(tmpdir(), 'nexus-blackboard-'));
  chdir(root);
  resetConfig();
  try {
    return fn(root);
  } finally {
    chdir(previous);
    resetConfig();
  }
}

test('readBoard returns empty string when _NEXUS.md does not exist', () => {
  inTempRepo(() => {
    assert.equal(readBoard(), '');
  });
});

test('appendEntry creates _NEXUS.md if it does not exist and appends the line', () => {
  inTempRepo((root) => {
    appendEntry('first line');
    assert.ok(existsSync(join(root, '_NEXUS.md')));
    assert.ok(readBoard().includes('first line'));
  });
});

test('appendEntry appends to existing content in order', () => {
  inTempRepo(() => {
    appendEntry('line one');
    appendEntry('line two');
    const content = readBoard();
    assert.ok(content.includes('line one'));
    assert.ok(content.includes('line two'));
    assert.ok(content.indexOf('line one') < content.indexOf('line two'));
  });
});

test('removeEntry removes lines containing the needle', () => {
  inTempRepo(() => {
    appendEntry('keep this line');
    appendEntry('remove this entry');
    appendEntry('also keep this');
    removeEntry('remove this entry');
    const content = readBoard();
    assert.ok(!content.includes('remove this entry'));
    assert.ok(content.includes('keep this line'));
    assert.ok(content.includes('also keep this'));
  });
});

test('removeEntry is a no-op when _NEXUS.md does not exist', () => {
  inTempRepo((root) => {
    assert.doesNotThrow(() => removeEntry('nonexistent needle'));
    assert.ok(!existsSync(join(root, '_NEXUS.md')));
  });
});

test('clearBoard empties the file', () => {
  inTempRepo(() => {
    appendEntry('some content');
    clearBoard();
    assert.equal(readBoard(), '');
  });
});

test('withLock returns the callback return value', () => {
  inTempRepo(() => {
    const result = withLock(() => 42);
    assert.equal(result, 42);
  });
});

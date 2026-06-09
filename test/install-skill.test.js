import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import installSkill from '../src/commands/install-skill.js';

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

test('install-skill copies bundled Nexus skill to target', () => {
  const root = mkdtempSync(join(tmpdir(), 'nexus-install-skill-'));
  const target = join(root, '.agents', 'skills', 'nexus');

  const output = captureLogs(() => installSkill(['--target', target]));

  assert.match(output, /Installed Nexus skill/);
  assert.ok(existsSync(join(target, 'SKILL.md')));
  assert.match(readFileSync(join(target, 'SKILL.md'), 'utf-8'), /name: nexus/);
});

test('install-skill does not overwrite existing skill without force', () => {
  const root = mkdtempSync(join(tmpdir(), 'nexus-install-skill-'));
  const target = join(root, '.agents', 'skills', 'nexus');

  captureLogs(() => installSkill(['--target', target]));
  const output = captureLogs(() => installSkill(['--target', target]));

  assert.match(output, /already installed/);
  assert.match(output, /--force/);
});

test('install-skill refreshes existing skill with force', () => {
  const root = mkdtempSync(join(tmpdir(), 'nexus-install-skill-'));
  const target = join(root, '.agents', 'skills', 'nexus');

  captureLogs(() => installSkill(['--target', target]));
  const output = captureLogs(() => installSkill(['--target', target, '--force']));

  assert.match(output, /Installed Nexus skill/);
  assert.ok(existsSync(join(target, 'SKILL.md')));
});

test('install-skill rejects broad targets', () => {
  const root = mkdtempSync(join(tmpdir(), 'nexus-install-skill-'));

  assert.throws(
    () => installSkill(['--target', join(root, '.agents', 'skills')]),
    /Install target must be the Nexus skill directory/,
  );
});

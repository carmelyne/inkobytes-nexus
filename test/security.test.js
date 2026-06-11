import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { chdir, cwd } from 'process';
import { resetConfig } from '../src/lib/config.js';
import { normalizeTarget, targetToLockName } from '../src/lib/pathSafety.js';

function inTempRepo(fn) {
  const previous = cwd();
  const root = mkdtempSync(join(tmpdir(), 'nexus-security-'));
  chdir(root);
  resetConfig();

  try {
    return fn(root);
  } finally {
    chdir(previous);
    resetConfig();
  }
}

test('normalizeTarget rejects repo escapes and reserved internals', () => {
  inTempRepo(() => {
    assert.equal(normalizeTarget('src/commands/doctor.js'), 'src/commands/doctor.js');
    assert.throws(() => normalizeTarget('../secret.txt'), /inside the repo/);
    assert.throws(() => normalizeTarget('/tmp/secret.txt'), /relative path/);
    assert.throws(() => normalizeTarget('.git/config'), /cannot be inside \.git/);
    assert.throws(() => normalizeTarget('.nexus/locks/file.lock'), /cannot be inside \.nexus/);
  });
});

test('lock names preserve distinct paths without slash/underscore collisions', () => {
  inTempRepo(() => {
    assert.notEqual(targetToLockName('a/b'), targetToLockName('a_b'));
  });
});

test('package ships bundled Nexus skill', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'));
  const skill = readFileSync(new URL('../skills/nexus/SKILL.md', import.meta.url), 'utf-8');

  assert.ok(pkg.files.includes('skills/'));
  assert.match(skill, /^---\nname: nexus/m);
  assert.match(skill, /freshness receipt/);
  assert.match(skill, /## Queue Items/);
  assert.match(skill, /Id: stable-kebab-id/);
  assert.match(skill, /Auto-flow: yes/);
  assert.doesNotMatch(skill, /preflight/);
});

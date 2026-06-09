import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'child_process';
import { cwd } from 'process';

function run(args, env = {}) {
  return spawnSync('node', ['bin/nexus.js', ...args], {
    cwd: cwd(),
    encoding: 'utf-8',
    env: { ...process.env, ...env },
  });
}

test('help output lists completion command', () => {
  const result = run(['help'], { FORCE_COLOR: '0', NO_COLOR: '1' });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /completion zsh/);
  assert.match(result.stdout, /install-skill \[--target <path>\] \[--force\]/);
  assert.match(result.stdout, /source <\(nexus completion zsh\)/);
});

test('help output colorizes when forced', () => {
  const result = run(['help'], { FORCE_COLOR: '1' });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /\u001b\[36m/);
});

test('completion zsh prints compdef script', () => {
  const result = run(['completion', 'zsh'], { FORCE_COLOR: '0', NO_COLOR: '1' });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /^#compdef nexus/m);
  assert.match(result.stdout, /completion:Print a shell completion script/);
  assert.match(result.stdout, /install-skill:Install bundled Nexus skill/);
  assert.match(result.stdout, /@codex/);
});

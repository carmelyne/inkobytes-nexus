import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AGENT_SCOPES,
  CANONICAL_MODEL_HANDLES,
  CANONICAL_MODEL_HANDLE_SET,
  AGENT_SCOPE_LIST,
  normalizeAgentHandle,
  hasAgentAlias,
} from '../src/lib/agentScopes.js';

test('all 4 canonical handles exist in CANONICAL_MODEL_HANDLES', () => {
  assert.ok(CANONICAL_MODEL_HANDLES.includes('@agy'));
  assert.ok(CANONICAL_MODEL_HANDLES.includes('@claude'));
  assert.ok(CANONICAL_MODEL_HANDLES.includes('@codex'));
  assert.ok(CANONICAL_MODEL_HANDLES.includes('@gemini'));
  assert.equal(CANONICAL_MODEL_HANDLES.length, 4);
});

test('normalizeAgentHandle returns canonical handle for exact match', () => {
  assert.equal(normalizeAgentHandle('@claude'), '@claude');
  assert.equal(normalizeAgentHandle('@gemini'), '@gemini');
  assert.equal(normalizeAgentHandle('@agy'), '@agy');
  assert.equal(normalizeAgentHandle('@codex'), '@codex');
});

test('normalizeAgentHandle returns canonical handle for alias match', () => {
  assert.equal(normalizeAgentHandle('claude'), '@claude');
  assert.equal(normalizeAgentHandle('gemini'), '@gemini');
  assert.equal(normalizeAgentHandle('my_gemini'), '@gemini');
  assert.equal(normalizeAgentHandle('agy'), '@agy');
  assert.equal(normalizeAgentHandle('antigravity'), '@agy');
  assert.equal(normalizeAgentHandle('codex'), '@codex');
});

test('normalizeAgentHandle returns null for unknown agent', () => {
  assert.equal(normalizeAgentHandle('unknown'), null);
  assert.equal(normalizeAgentHandle('@unknown'), null);
  assert.equal(normalizeAgentHandle('foobar'), null);
});

test('normalizeAgentHandle returns null for falsy input', () => {
  assert.equal(normalizeAgentHandle(null), null);
  assert.equal(normalizeAgentHandle(undefined), null);
  assert.equal(normalizeAgentHandle(''), null);
  assert.equal(normalizeAgentHandle(0), null);
  assert.equal(normalizeAgentHandle(false), null);
});

test('hasAgentAlias returns true for strings containing a known alias', () => {
  assert.ok(hasAgentAlias('claude'));
  assert.ok(hasAgentAlias('my_claude_agent'));
  assert.ok(hasAgentAlias('gemini'));
  assert.ok(hasAgentAlias('use_gemini_here'));
  assert.ok(hasAgentAlias('agy'));
  assert.ok(hasAgentAlias('antigravity'));
  assert.ok(hasAgentAlias('codex'));
});

test('hasAgentAlias returns false for unknown strings', () => {
  assert.ok(!hasAgentAlias('unknown'));
  assert.ok(!hasAgentAlias('random_string'));
  assert.ok(!hasAgentAlias(''));
  assert.ok(!hasAgentAlias('gpt4'));
});

test('CANONICAL_MODEL_HANDLE_SET contains all handles', () => {
  for (const handle of CANONICAL_MODEL_HANDLES) {
    assert.ok(CANONICAL_MODEL_HANDLE_SET.has(handle), `Set missing handle: ${handle}`);
  }
  assert.equal(CANONICAL_MODEL_HANDLE_SET.size, CANONICAL_MODEL_HANDLES.length);
});

test('each scope has all required keys', () => {
  const requiredKeys = ['label', 'dir', 'entrypoint', 'continuity', 'memoryIndex', 'memoryDir', 'aliases'];
  for (const scope of AGENT_SCOPE_LIST) {
    for (const key of requiredKeys) {
      assert.ok(Object.prototype.hasOwnProperty.call(scope, key), `Scope "${scope.label}" missing key: ${key}`);
    }
    assert.ok(Array.isArray(scope.aliases), `Scope "${scope.label}" aliases should be an array`);
    assert.ok(scope.aliases.length > 0, `Scope "${scope.label}" aliases should not be empty`);
  }
});

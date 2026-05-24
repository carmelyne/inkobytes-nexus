/**
 * Blackboard — serialized read/write to _NEXUS.md
 * All writes go through a lockfile to prevent race conditions
 * between agents writing simultaneously.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmdirSync } from 'fs';
import { resolve } from 'path';
import { getConfig } from './config.js';

function getLockPath(blackboardPath) {
  return blackboardPath + '.lockdir';
}

function acquireLock(blackboardPath, maxAttempts = 25, intervalMs = 200) {
  const lockPath = getLockPath(blackboardPath);
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      mkdirSync(lockPath);
      return true;
    } catch {
      attempts++;
      if (attempts >= maxAttempts) {
        console.error('[WARN] Blackboard write lock timeout');
        return false;
      }
      const start = Date.now();
      while (Date.now() - start < intervalMs) { /* spin */ }
    }
  }
  return false;
}

function releaseLock(blackboardPath) {
  const lockPath = getLockPath(blackboardPath);
  try {
    rmdirSync(lockPath);
  } catch { /* already gone */ }
}

export function withLock(fn) {
  const config = getConfig();
  const boardPath = resolve(config.root, '_NEXUS.md');

  if (!acquireLock(boardPath)) {
    throw new Error('Could not acquire blackboard lock');
  }

  try {
    return fn(boardPath);
  } finally {
    releaseLock(boardPath);
  }
}

export function readBoard() {
  const config = getConfig();
  const boardPath = resolve(config.root, '_NEXUS.md');

  if (!existsSync(boardPath)) return '';
  return readFileSync(boardPath, 'utf-8');
}

export function appendEntry(line) {
  withLock((boardPath) => {
    if (!existsSync(boardPath)) writeFileSync(boardPath, '', 'utf-8');
    const content = readFileSync(boardPath, 'utf-8');
    writeFileSync(boardPath, content + line + '\n', 'utf-8');
  });
}

export function removeEntry(needle) {
  withLock((boardPath) => {
    if (!existsSync(boardPath)) return;
    const content = readFileSync(boardPath, 'utf-8');
    const filtered = content
      .split('\n')
      .filter(line => !line.includes(needle))
      .join('\n');
    writeFileSync(boardPath, filtered, 'utf-8');
  });
}

export function clearBoard() {
  withLock((boardPath) => {
    writeFileSync(boardPath, '', 'utf-8');
  });
}

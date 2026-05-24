/**
 * Lock Manager — atomic mkdir-based file/directory locking
 * with hierarchy enforcement and stale detection.
 */

import { mkdirSync, rmdirSync, existsSync, readFileSync, writeFileSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { getConfig } from './config.js';
import { lockNameToTarget, normalizeTarget, targetToLockName } from './pathSafety.js';

export function getLockPath(target) {
  const config = getConfig();
  return join(config.lockDir, targetToLockName(target));
}

/**
 * Check for parent directory locks (upward traversal)
 */
function checkParentLocks(target, lockDir) {
  let parent = dirname(target);
  while (parent !== '.' && parent !== '/') {
    const parentLock = join(lockDir, targetToLockName(parent));
    if (existsSync(parentLock)) {
      return parent;
    }
    parent = dirname(parent);
  }
  return null;
}

/**
 * Check for child file locks inside a directory (downward check)
 */
function checkChildLocks(target, lockDir) {
  const normalizedTarget = normalizeTarget(target);

  if (!existsSync(lockDir)) return null;

  const locks = readdirSync(lockDir);
  for (const lock of locks) {
    const lockPath = join(lockDir, lock);
    if (!existsSync(lockPath)) continue;
    try { if (!statSync(lockPath).isDirectory()) continue; } catch { continue; }

    let lockedTarget = '';
    try {
      lockedTarget = lockNameToTarget(lock);
    } catch {
      continue;
    }

    if (lockedTarget.startsWith(`${normalizedTarget}/`) && lockedTarget !== normalizedTarget) {
      return lockedTarget;
    }
  }
  return null;
}

/**
 * Check if a lock is stale (older than threshold)
 */
function isStale(lockPath) {
  const config = getConfig();
  const tsFile = join(lockPath, 'ts');

  if (!existsSync(tsFile)) return false;

  const lockTs = parseInt(readFileSync(tsFile, 'utf-8').trim(), 10);
  const now = Math.floor(Date.now() / 1000);
  const age = now - lockTs;

  return age >= config.staleThreshold ? age : false;
}

/**
 * Break a stale lock
 */
function breakLock(lockPath) {
  const tsFile = join(lockPath, 'ts');
  try { unlinkSync(tsFile); } catch { /* ok */ }
  try { rmdirSync(lockPath); } catch { /* ok */ }
}

/**
 * Attempt to acquire a lock on a file or directory.
 * Returns { success, message, staleAge? }
 */
export function acquireLock(target, agentName, intent) {
  const config = getConfig();
  const normalizedTarget = normalizeTarget(target);
  const lockPath = getLockPath(normalizedTarget);

  // Ensure lock directory exists
  mkdirSync(config.lockDir, { recursive: true });

  // Hierarchy check: parent locked?
  const lockedParent = checkParentLocks(normalizedTarget, config.lockDir);
  if (lockedParent) {
    return {
      success: false,
      message: `Cannot claim '${normalizedTarget}' — parent dir '${lockedParent}' is locked by another agent.`,
    };
  }

  // Hierarchy check: child locked? (only for directory claims)
  try {
    if (existsSync(normalizedTarget) && statSync(normalizedTarget).isDirectory()) {
      const lockedChild = checkChildLocks(normalizedTarget, config.lockDir);
      if (lockedChild) {
        return {
          success: false,
          message: `Cannot claim '${normalizedTarget}' — a file inside it is already locked: ${lockedChild}`,
        };
      }
    }
  } catch { /* target might not exist yet, that's fine */ }

  // Stale lock detection
  if (existsSync(lockPath)) {
    const staleAge = isStale(lockPath);
    if (staleAge) {
      console.log(`[WARN] Stale lock detected (${staleAge}s old). Auto-breaking.`);
      breakLock(lockPath);
    }
  }

  // Attempt atomic lock via mkdir
  let attempts = 0;
  while (attempts < config.maxClaimAttempts) {
    try {
      mkdirSync(lockPath);

      // Write timestamp for stale detection
      writeFileSync(join(lockPath, 'ts'), String(Math.floor(Date.now() / 1000)), 'utf-8');

      return {
        success: true,
        message: `[LOCK ACQUIRED] - ${agentName} is clear to modify ${normalizedTarget}`,
      };
    } catch {
      attempts++;
      if (attempts >= config.maxClaimAttempts) {
        return {
          success: false,
          message: `File locked by another agent. Failed after ${attempts * config.claimRetryMs / 1000}s.`,
        };
      }
      const start = Date.now();
      while (Date.now() - start < config.claimRetryMs) { /* spin wait */ }
    }
  }

  return { success: false, message: 'Lock acquisition failed.' };
}

/**
 * Release a lock. Returns { success, message }
 */
export function releaseLock(target) {
  const normalizedTarget = normalizeTarget(target);
  const lockPath = getLockPath(normalizedTarget);

  if (!existsSync(lockPath)) {
    return { success: false, message: `No lock found for: ${normalizedTarget}` };
  }

  const tsFile = join(lockPath, 'ts');
  try { unlinkSync(tsFile); } catch { /* ok */ }
  try {
    rmdirSync(lockPath);
    return { success: true, message: `Lock released for: ${normalizedTarget}` };
  } catch (err) {
    return { success: false, message: `Failed to release lock: ${err.message}` };
  }
}

/**
 * List all current locks with metadata
 */
export function listLocks() {
  const config = getConfig();
  if (!existsSync(config.lockDir)) return [];

  const locks = [];
  const entries = readdirSync(config.lockDir);

  for (const entry of entries) {
    if (!entry.endsWith('.lock')) continue;
    const lockPath = join(config.lockDir, entry);
    try {
      if (!statSync(lockPath).isDirectory()) continue;
    } catch { continue; }

    const target = lockNameToTarget(entry);
    const tsFile = join(lockPath, 'ts');
    let age = null;

    if (existsSync(tsFile)) {
      const lockTs = parseInt(readFileSync(tsFile, 'utf-8').trim(), 10);
      age = Math.floor(Date.now() / 1000) - lockTs;
    }

    locks.push({ target, age, lockPath });
  }

  return locks;
}

/**
 * Find and break all stale locks. Returns array of broken lock targets.
 */
export function breakStaleLocks() {
  const config = getConfig();
  const broken = [];

  for (const lock of listLocks()) {
    if (lock.age !== null && lock.age >= config.staleThreshold) {
      breakLock(lock.lockPath);
      broken.push({ target: lock.target, age: lock.age });
    }
  }

  return broken;
}

/**
 * Nuke all locks
 */
export function nukeAllLocks() {
  const config = getConfig();
  if (!existsSync(config.lockDir)) return;

  const entries = readdirSync(config.lockDir);
  for (const entry of entries) {
    const lockPath = join(config.lockDir, entry);
    try {
      if (statSync(lockPath).isDirectory()) {
        const tsFile = join(lockPath, 'ts');
        try { unlinkSync(tsFile); } catch { /* ok */ }
        rmdirSync(lockPath);
      }
    } catch { /* ok */ }
  }
}

/**
 * Git helper — stage + commit with pathspec safety
 */

import { existsSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';
import { getConfig } from './config.js';
import { normalizeTarget } from './pathSafety.js';

function sleep(ms) {
  const start = Date.now();
  while (Date.now() - start < ms) { /* wait */ }
}

function isIndexLockError(message) {
  return message.includes('.git/index.lock') || message.includes('index.lock');
}

function git(args) {
  const result = spawnSync('git', args, {
    cwd: getConfig().root,
    encoding: 'utf-8',
    stdio: 'pipe',
  });

  if (result.status !== 0) {
    const detail = result.stderr?.trim() || result.stdout?.trim() || `git ${args[0]} failed`;
    throw new Error(detail);
  }

  return result.stdout || '';
}

function gitWithIndexLockRetry(args, maxRetries, retryMs) {
  let attempt = 0;
  let lastError;

  while (attempt < maxRetries) {
    try {
      return git(args);
    } catch (err) {
      lastError = err;
      const indexLockPath = join(getConfig().root, '.git', 'index.lock');
      const message = err.message || '';
      if (!isIndexLockError(message) && !existsSync(indexLockPath)) throw err;
      attempt++;
      if (attempt < maxRetries) sleep(retryMs);
    }
  }

  throw new Error(`Git index stayed locked after ${maxRetries} attempts. Another git process may still be running; retry the release when it finishes. Last error: ${lastError?.message || 'unknown error'}`);
}

/**
 * Stage and commit a target (file or directory).
 * Uses `git add` + `git commit --` pathspec to prevent stowaways.
 */
export function stageAndCommit(target, message, maxRetries = 5, retryMs = 1000) {
  const safeTarget = normalizeTarget(target);

  // Stage the target
  try {
    gitWithIndexLockRetry(['add', '--', safeTarget], maxRetries, retryMs);
  } catch (err) {
    return { success: false, message: err.message || 'Git add failed.' };
  }

  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      gitWithIndexLockRetry(['commit', '-m', `[Agent] ${message}`, '--', safeTarget], maxRetries, retryMs);
      return { success: true };
    } catch (err) {
      attempt++;
      if (attempt >= maxRetries) {
        // Check if there's actually nothing to commit
        try {
          const status = git(['status', '--porcelain', '--', safeTarget]);
          if (!status.trim()) {
            return { success: true, message: 'Nothing to commit (clean)' };
          }
        } catch { /* fall through */ }

        return {
          success: false,
          message: err.message?.includes('Git index stayed locked')
            ? err.message
            : `Git commit failed after ${maxRetries} attempts.`,
        };
      }
      // Brief pause before retry
      sleep(retryMs);
    }
  }

  return { success: false, message: 'Git commit failed.' };
}

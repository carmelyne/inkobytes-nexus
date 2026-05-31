/**
 * Config — resolve project root and Nexus paths
 */

import { existsSync } from 'fs';
import { resolve, join } from 'path';
import { cwd } from 'process';

let _config = null;

export function getConfig(fromDir) {
  if (_config) return _config;

  const root = fromDir || cwd();
  const lockDir = join(root, '.nexus', 'locks');
  const budgetFile = join(root, '.nexus', 'agent-budgets.json');

  _config = {
    root,
    lockDir,
    budgetFile,
    blackboard: join(root, '_NEXUS.md'),
    standup: join(root, '_NEXUS_STANDUP.md'),
    report: join(root, '_NEXUS_REPORT.md'),
    ledger: join(root, '_NEXUS_LEDGER.md'),
    queue: join(root, '_NEXUS_QUEUE.md'),
    staleThreshold: 600, // 10 minutes in seconds
    maxDumpFiles: 20,
    maxClaimAttempts: 10,
    claimRetryMs: 2000,
  };

  return _config;
}

export function resetConfig() {
  _config = null;
}

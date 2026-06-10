/**
 * Config — resolve project root and Nexus paths
 */

import { existsSync, readFileSync } from 'fs';
import { resolve, join } from 'path';
import { cwd } from 'process';

let _config = null;

export function getConfig(fromDir) {
  if (_config) return _config;

  const root = fromDir || cwd();
  const lockDir = join(root, '.nexus', 'locks');
  const budgetFile = join(root, '.nexus', 'agent-budgets.json');
  const localConfig = readLocalConfig(root);

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
    doctor: {
      allowTrackedAgentTrees: Boolean(localConfig.doctor?.allowTrackedAgentTrees),
    },
    release: {
      verifyCommand: typeof localConfig.release?.verifyCommand === 'string'
        ? localConfig.release.verifyCommand.trim()
        : '',
    },
    // 0 = supervised, 1 = checkpointed, 2 = bounded unattended. Human-set.
    autonomy: Number.isInteger(localConfig.autonomy) && localConfig.autonomy >= 0 && localConfig.autonomy <= 2
      ? localConfig.autonomy
      : 0,
  };

  return _config;
}

export function resetConfig() {
  _config = null;
}

function readLocalConfig(root) {
  const path = join(root, '.nexus', 'config.json');
  if (!existsSync(path)) return {};

  try {
    const parsed = JSON.parse(readFileSync(path, 'utf-8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

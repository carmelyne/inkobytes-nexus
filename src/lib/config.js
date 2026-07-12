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
    // Progress-signal window in seconds. Global only — per-agent/per-cost
    // overrides deferred until the default proves noisy (decision 2, 2026-06-12).
    progressWindow: Number.isInteger(localConfig.progressWindow) && localConfig.progressWindow > 0
      ? localConfig.progressWindow
      : 900,
    // Decision 1 (2026-06-12): stale = age AND no progress signal, so working
    // locks survive sweeps regardless of age. Set false for age-only staleness.
    progressAwareStale: localConfig.progressAwareStale !== false,
    // Soft TTL for claims in seconds (claim-ttl-escalation). Past this age a
    // lock is flagged OVERDUE to *other* agents in status/doctor — it is a
    // visibility threshold, not a kill switch. Conservative default: 2 hours,
    // the point at which the 2026-07-07 landmarks.js claim was clearly abandoned.
    claimTtl: Number.isInteger(localConfig.claimTtl) && localConfig.claimTtl > 0
      ? localConfig.claimTtl
      : 7200,
    // Off by default: auto-release an overdue lock only when progress signals
    // show no movement on the path. Opt-in because breaking a live claim is
    // the one mistake this feature exists to prevent elsewhere.
    claimTtlAutoRelease: localConfig.claimTtlAutoRelease === true,
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

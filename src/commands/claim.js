/**
 * nexus claim <path> <agent> "<intent>"
 * Lock a file or directory, update blackboard, print a freshness receipt.
 */

import { appendEntry } from '../lib/blackboard.js';
import { acquireLock, listLocks } from '../lib/lockManager.js';
import { dumpState, freshnessReceipt } from '../lib/dump.js';
import { existsSync } from 'fs';
import { join } from 'path';
import { cwd } from 'process';
import { normalizeTarget } from '../lib/pathSafety.js';
import { CANONICAL_MODEL_HANDLE_SET, CANONICAL_MODEL_HANDLES_TEXT, hasAgentAlias } from '../lib/agentScopes.js';
import { refuseIfHalted } from './halt.js';

const CORE_FILES = [
  '_NEXUS_CONSTITUTION.md',
  '_NEXUS_QUEUE.md',
  '_NEXUS_STANDUP.md',
];
const THINKING_LEVELS = new Set(['low', 'medium', 'high']);
const USAGE = 'Usage: nexus claim <filepath_or_dir> <agent> "<intent>" [--agent <agent>] [--intent <intent>] [--subagents <n>] [--model <name>] [--thinking <low|medium|high>] [--show]';

function missingCoreFiles() {
  const root = cwd();
  return CORE_FILES.filter((file) => !existsSync(join(root, file)));
}

function shouldWarnAgentHandle(agent) {
  const normalized = agent.toLowerCase();
  return normalized === '@agent'
    || normalized === 'unknownagent'
    || (normalized.startsWith('@') && !CANONICAL_MODEL_HANDLE_SET.has(normalized) && hasAgentAlias(normalized));
}

function isAgentHandle(agent) {
  return typeof agent === 'string' && /^@[a-z0-9][a-z0-9_-]*$/i.test(agent);
}

function readFlag(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return '';

  const value = args[index + 1];
  const hasValue = value && !String(value).startsWith('--');
  args.splice(index, hasValue ? 2 : 1);
  return hasValue ? value : '';
}

export default function claim(args) {
  if (args.includes('--help') || args.includes('-h')) {
    printClaimHelp();
    return;
  }

  refuseIfHalted('claim');

  const positional = [...args];

  const showIndex = positional.indexOf('--show');
  const showFull = showIndex !== -1;
  if (showFull) positional.splice(showIndex, 1);

  const agentFlag = readFlag(positional, '--agent').trim();
  const intentFlag = readFlag(positional, '--intent').trim();
  const subagents = parseInt(readFlag(positional, '--subagents'), 10) || 0;
  const model = readFlag(positional, '--model').trim();
  const thinking = readFlag(positional, '--thinking').trim().toLowerCase();

  let target = positional[0];
  const agent = agentFlag || positional[1] || '';
  const intent = intentFlag || positional[2] || '';
  const hasAgent = Boolean(agentFlag || positional[1]);
  const hasIntent = Boolean(intentFlag || positional[2]);

  if (!target) {
    console.error(USAGE);
    process.exit(1);
  }

  if (!hasAgent || !isAgentHandle(agent)) {
    console.error('[ERROR] Missing or invalid claim agent.');
    console.error('Use: nexus claim <path> @codex "intent"');
    console.error('Or:  nexus claim <path> --agent @codex --intent "intent"');
    process.exit(1);
  }

  if (!hasIntent) {
    console.error('[ERROR] Missing claim intent.');
    console.error('Use: nexus claim <path> @codex "intent"');
    console.error('Or:  nexus claim <path> --agent @codex --intent "intent"');
    process.exit(1);
  }

  if (thinking && !THINKING_LEVELS.has(thinking)) {
    console.error('[ERROR] --thinking must be one of: low, medium, high');
    process.exit(1);
  }

  try {
    target = normalizeTarget(target);
  } catch (err) {
    console.error(`[ERROR] ${err.message}`);
    process.exit(1);
  }

  const alreadyHasMissingModelMetadata = listLocks().some((entry) => !entry.model);
  const result = acquireLock(target, agent, intent, subagents, { model, thinking });

  if (!result.success) {
    console.error(`[ERROR] ${result.message}`);
    process.exit(1);
  }

  const missing = missingCoreFiles();
  if (missing.length) {
    console.warn(`[WARN] Missing Nexus protocol files: ${missing.join(', ')}. Run \`nexus doctor\`.`);
  }

  if (!CANONICAL_MODEL_HANDLE_SET.has(agent.toLowerCase()) && shouldWarnAgentHandle(agent)) {
    console.warn(`[WARN] Use CLI/model names as lock handles: ${CANONICAL_MODEL_HANDLES_TEXT}.`);
  }

  if (!model && !alreadyHasMissingModelMetadata) {
    console.warn('[WARN] Claim has no model metadata. Add `--model <name>` when available.');
  }

  if (result.dirtyAtClaim) {
    console.warn(`[WARN] ${target} already has uncommitted changes that predate this claim. Release will refuse to sweep them unless run with --include-preexisting; consider resolving ownership in standup first.`);
  }

  // Update blackboard
  appendEntry(`- 🔒 **${target}** - Locked by **${agent}**: ${intent}`);

  console.log(result.message);

  // Freshness receipt by default: prove content identity instead of paying
  // tokens for a full dump. --show restores the full fresh-state dump.
  console.log(showFull ? dumpState(target) : freshnessReceipt(target));
}

function printClaimHelp() {
  console.log([
    USAGE,
    '',
    'Locks a file or directory for one agent.',
    '',
    'By default, claim prints a freshness receipt instead of full contents:',
    '- git blob hash for the on-disk content',
    '- last commit touching the path',
    '- clean/dirty working-tree state',
    '- line count when available',
    '',
    'Same blob as your last read means cached content is current. Different or unknown means re-read before editing.',
    'Use --show to print the full fresh file state after the lock is acquired.',
    '',
    'Examples:',
    '  nexus claim src/lib/foo.js @codex "Fix parser edge case"',
    '  nexus claim src/lib/foo.js --agent @codex --intent "Fix parser edge case"',
    '  nexus claim src/lib/foo.js @codex "Review current contents" --show',
  ].join('\n'));
}

/**
 * nexus claim <path> <agent> "<intent>"
 * Lock a file or directory, update blackboard, dump fresh state.
 */

import { appendEntry } from '../lib/blackboard.js';
import { acquireLock } from '../lib/lockManager.js';
import { dumpState } from '../lib/dump.js';
import { existsSync } from 'fs';
import { join } from 'path';
import { cwd } from 'process';
import { normalizeTarget } from '../lib/pathSafety.js';
import { CANONICAL_MODEL_HANDLE_SET, CANONICAL_MODEL_HANDLES_TEXT, hasAgentAlias } from '../lib/agentScopes.js';

const CORE_FILES = [
  '_NEXUS_CONSTITUTION.md',
  '_NEXUS_QUEUE.md',
  '_NEXUS_STANDUP.md',
];
const THINKING_LEVELS = new Set(['low', 'medium', 'high']);

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

function readFlag(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return '';

  const value = args[index + 1];
  const hasValue = value && !String(value).startsWith('--');
  args.splice(index, hasValue ? 2 : 1);
  return hasValue ? value : '';
}

export default function claim(args) {
  const positional = [...args];

  const subagents = parseInt(readFlag(positional, '--subagents'), 10) || 0;
  const model = readFlag(positional, '--model').trim();
  const thinking = readFlag(positional, '--thinking').trim().toLowerCase();

  let target = positional[0];
  const agent = positional[1] || 'UnknownAgent';
  const intent = positional[2] || 'Modifying file';

  if (!target) {
    console.error('Usage: nexus claim <filepath_or_dir> <agent> "<intent>" [--subagents <n>] [--model <name>] [--thinking <low|medium|high>]');
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

  // Update blackboard
  appendEntry(`- 🔒 **${target}** - Locked by **${agent}**: ${intent}`);

  console.log(result.message);

  // Dump fresh file state
  const state = dumpState(target);
  console.log(state);
}

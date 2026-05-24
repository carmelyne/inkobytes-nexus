/**
 * nexus claim <path> <agent> "<intent>"
 * Lock a file or directory, update blackboard, dump fresh state.
 */

import { appendEntry } from '../lib/blackboard.js';
import { acquireLock } from '../lib/lockManager.js';
import { dumpState } from '../lib/dump.js';
import { normalizeTarget } from '../lib/pathSafety.js';

export default function claim(args) {
  let target = args[0];
  const agent = args[1] || 'UnknownAgent';
  const intent = args[2] || 'Modifying file';

  if (!target) {
    console.error('Usage: nexus claim <filepath_or_dir> <agent> "<intent>"');
    process.exit(1);
  }

  try {
    target = normalizeTarget(target);
  } catch (err) {
    console.error(`[ERROR] ${err.message}`);
    process.exit(1);
  }

  const result = acquireLock(target, agent, intent);

  if (!result.success) {
    console.error(`[ERROR] ${result.message}`);
    process.exit(1);
  }

  // Update blackboard
  appendEntry(`- 🔒 **${target}** - Locked by **${agent}**: ${intent}`);

  console.log(result.message);

  // Dump fresh file state
  const state = dumpState(target);
  console.log(state);
}

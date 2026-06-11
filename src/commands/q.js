import { existsSync, readFileSync } from 'fs';
import { getConfig } from '../lib/config.js';
import { laneFileName, lanePath, markLaneTaskDone } from '../lib/queue.js';
import { refuseIfHalted } from './halt.js';

export default function q(args) {
  refuseIfHalted('q');

  const config = getConfig();

  if (args[0] === 'done') {
    const id = args[1];
    const agent = args[2] || process.env.NEXUS_AGENT;
    if (!id || !agent) {
      console.error('Usage: nexus q done <id> <agent>');
      process.exit(1);
    }

    const result = markLaneTaskDone({ root: config.root, agent, id });
    console.log(`Receipt written for ${id} in ${result.lane}.`);
    console.log(`Completed at: ${result.completedAt}`);
    console.log('Master queue unchanged; run `nexus queue reconcile` when that phase lands.');
    return;
  }

  const agent = args[0];
  if (!agent) {
    console.error('Usage: nexus q <agent> | nexus q done <id> <agent>');
    process.exit(1);
  }

  const file = lanePath(config.root, agent);
  if (!existsSync(file)) {
    console.log(`No lane found for ${agent} (${laneFileName(agent)}).`);
    return;
  }

  console.log(readFileSync(file, 'utf-8').trimEnd());
}

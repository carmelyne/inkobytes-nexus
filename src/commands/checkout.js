/**
 * nexus checkout @agent — signal agent session end
 */

import { unlinkSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { env, cwd } from 'process';

export default function checkout(args = []) {
  const root = cwd();
  const presenceDir = join(root, '.nexus', 'presence');
  const all = args.includes('--all');

  if (all) {
    if (existsSync(presenceDir)) {
      for (const file of readdirSync(presenceDir)) {
        unlinkSync(join(presenceDir, file));
      }
      console.log(`[CHECKOUT] All agent presence cleared.`);
    }
    return;
  }

  const agent = args[0] || env.NEXUS_AGENT || '@unknown';
  const presenceFile = join(presenceDir, agent.replace(/^@/, ''));

  if (existsSync(presenceFile)) {
    unlinkSync(presenceFile);
    console.log(`[CHECKOUT] ${agent} is offline.`);
  } else {
    console.log(`[CHECKOUT] No presence record for ${agent}.`);
  }
}

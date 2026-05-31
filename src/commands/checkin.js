/**
 * nexus checkin @agent — signal agent presence
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { env, cwd } from 'process';

export default function checkin(args = []) {
  const root = cwd();
  const agent = args[0] || env.NEXUS_AGENT || '@unknown';
  const presenceDir = join(root, '.nexus', 'presence');
  const presenceFile = join(presenceDir, agent.replace(/^@/, ''));

  mkdirSync(presenceDir, { recursive: true });
  writeFileSync(presenceFile, String(Math.floor(Date.now() / 1000)), 'utf-8');

  console.log(`[CHECKIN] ${agent} is active.`);
}

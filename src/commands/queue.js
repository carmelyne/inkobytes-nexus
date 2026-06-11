import { existsSync } from 'fs';
import { getConfig } from '../lib/config.js';
import { reconcileQueueLanes } from '../lib/queue.js';
import { refuseIfHalted } from './halt.js';

export default function queue(args) {
  refuseIfHalted('queue');

  const action = args[0];
  if (action !== 'reconcile') {
    console.error('Usage: nexus queue reconcile');
    process.exit(1);
  }

  const config = getConfig();
  if (!existsSync(config.queue)) {
    console.log('No _NEXUS_QUEUE.md found. Nothing to reconcile.');
    return;
  }

  const result = reconcileQueueLanes({
    root: config.root,
    queuePath: config.queue,
  });

  const reconciled = result.results.filter(r => r.status === 'reconciled');
  const alreadyDone = result.results.filter(r => r.status === 'already_done');
  const skipped = result.results.filter(r => r.status === 'skipped');

  if (result.results.length === 0) {
    console.log('No pending lane receipts to reconcile.');
    return;
  }

  console.log(`Reconciled at: ${result.reconciledAt}`);
  for (const item of reconciled) {
    console.log(`- ${item.id}: reconciled from ${item.lane}`);
  }
  for (const item of alreadyDone) {
    console.log(`- ${item.id}: already Done; receipt marked reconciled in ${item.lane}`);
  }
  for (const item of skipped) {
    console.log(`- ${item.id}: skipped from ${item.lane} (${item.reason})`);
  }
}

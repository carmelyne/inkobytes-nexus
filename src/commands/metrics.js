/**
 * nexus metrics [--json]
 * Read-only summary of Nexus release and queue activity.
 */

import { existsSync, readFileSync } from 'fs';
import { spawnSync } from 'child_process';
import { getConfig } from '../lib/config.js';

export default function metrics(args) {
  const json = args.includes('--json');
  const config = getConfig();
  const reportText = readText(config.report);
  const queueText = readText(config.queue);
  const gitCommits = readGitCommits(config.root);
  const releases = parseReport(reportText);
  const summary = buildSummary(gitCommits, releases, queueText);

  if (json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  printSummary(summary);
}

function readText(path) {
  if (!existsSync(path)) return '';
  return readFileSync(path, 'utf-8');
}

function readGitCommits(root) {
  const result = spawnSync('git', ['log', '--date=short', '--pretty=format:%H%x09%ad%x09%s'], {
    cwd: root,
    encoding: 'utf-8',
    stdio: 'pipe',
  });
  if (result.status !== 0) return [];

  return result.stdout.split('\n').filter(Boolean).map((line) => {
    const [sha, date, ...subjectParts] = line.split('\t');
    const subject = subjectParts.join('\t');
    const match = subject.match(/^\[([^\]]+)\]\s+(.+)$/);
    return {
      sha,
      date,
      agent: match ? match[1] : 'unknown',
      subject: match ? match[2] : subject,
    };
  });
}

function parseReport(content) {
  const releases = [];
  const blocks = content.split(/\n(?=## \[\d\d:\d\d:\d\d\] )/);

  for (const block of blocks) {
    const header = block.match(/^## \[(\d\d:\d\d:\d\d)\] (.+)$/m);
    if (!header) continue;
    releases.push({
      time: header[1],
      target: readField(block, 'Target') || header[2],
      agent: readField(block, 'Agent') || 'unknown',
      sha: readField(block, 'SHA') || '',
      commit: readField(block, 'Commit') || '',
    });
  }

  return releases;
}

function readField(block, label) {
  return block.match(new RegExp(`^- ${label}: (.+)$`, 'm'))?.[1] || '';
}

function buildSummary(gitCommits, releases, queueText) {
  return {
    commitsByAgent: countBy(gitCommits, 'agent'),
    releasesByAgent: countBy(releases, 'agent'),
    topReleaseTargets: topCounts(countBy(releases, 'target'), 8),
    weeklyVelocity: countBy(gitCommits, (commit) => weekKey(commit.date)),
    queueCostDistribution: parseQueueCostDistribution(queueText),
    totals: {
      commits: gitCommits.length,
      releases: releases.length,
    },
  };
}

function countBy(items, keyOrFn) {
  const counts = {};
  for (const item of items) {
    const key = typeof keyOrFn === 'function' ? keyOrFn(item) : item[keyOrFn];
    if (!key) continue;
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function topCounts(counts, limit) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

function weekKey(dateText) {
  if (!dateText) return 'unknown';
  const date = new Date(`${dateText}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return 'unknown';
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

function parseQueueCostDistribution(content) {
  const counts = {};
  for (const line of content.split('\n')) {
    const match = line.trim().match(/^- Cost:\s*(.+)$/);
    if (!match) continue;
    const cost = match[1];
    counts[cost] = (counts[cost] || 0) + 1;
  }
  return counts;
}

function printSummary(summary) {
  console.log('Nexus metrics');
  console.log('');
  console.log(`Totals: ${summary.totals.commits} commits, ${summary.totals.releases} release receipt(s)`);
  printCounts('Commits by agent', summary.commitsByAgent);
  printCounts('Releases by agent', summary.releasesByAgent);
  printTopTargets(summary.topReleaseTargets);
  printCounts('Weekly velocity', summary.weeklyVelocity);
  printCounts('Queue cost distribution', summary.queueCostDistribution);
}

function printCounts(title, counts) {
  console.log(`\n${title}`);
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (!rows.length) {
    console.log('  none');
    return;
  }
  for (const [name, count] of rows) console.log(`  ${name}: ${count}`);
}

function printTopTargets(targets) {
  console.log('\nTop release targets');
  if (!targets.length) {
    console.log('  none');
    return;
  }
  for (const target of targets) console.log(`  ${target.name}: ${target.count}`);
}

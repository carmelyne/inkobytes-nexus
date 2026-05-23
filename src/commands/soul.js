/**
 * nexus soul - apply a local soul overlay to agent instruction files
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { cwd } from 'process';

const DEFAULT_OVERLAY_PATH = '.nexus/local/agent-overlay.md';
const START_MARKER_PREFIX = '<!-- NEXUS-LOCAL-SOUL:START';
const END_MARKER = '<!-- NEXUS-LOCAL-SOUL:END -->';

const AGENT_ENTRYPOINTS = [
  '.codex/AGENTS.md',
  '.claude/CLAUDE.md',
  '.gemini/GEMINI.md',
];

const DEFAULT_OVERLAY = `# Local Soul Overlay

Add your local agent behavior notes here. This file is local workspace flavor:
tone, response rhythm, naming defaults, and other private context that should
sit outside the public Nexus protocol block.
`;

function parseArgs(args) {
  const fileIndex = args.indexOf('--file');
  if (fileIndex === -1) return { overlayPath: DEFAULT_OVERLAY_PATH };
  if (!args[fileIndex + 1]) {
    throw new Error('Usage: nexus soul [--file <path>]');
  }
  return { overlayPath: args[fileIndex + 1] };
}

function localSoulBlock(overlayPath, content) {
  return `${START_MARKER_PREFIX} ${overlayPath} -->
${content.trim()}
${END_MARKER}`;
}

function upsertSoulBlock(existing, overlayPath, overlayContent) {
  const start = existing.indexOf(START_MARKER_PREFIX);
  const end = existing.indexOf(END_MARKER);
  const block = localSoulBlock(overlayPath, overlayContent);

  if (start !== -1 && end !== -1 && end > start) {
    const before = existing.slice(0, start).trimEnd();
    const after = existing.slice(end + END_MARKER.length).trimStart();
    return `${before}\n\n${block}\n${after ? `\n${after}` : ''}`;
  }

  const firstHeadingEnd = existing.indexOf('\n');
  if (firstHeadingEnd !== -1 && existing.startsWith('# ')) {
    const title = existing.slice(0, firstHeadingEnd).trimEnd();
    const body = existing.slice(firstHeadingEnd).trimStart();
    return `${title}\n\n${block}\n\n${body}`;
  }

  return `${block}\n\n${existing.trimStart()}`;
}

export default function soul(args) {
  const root = cwd();
  const { overlayPath } = parseArgs(args);
  const fullOverlayPath = join(root, overlayPath);

  mkdirSync(dirname(fullOverlayPath), { recursive: true });

  if (!existsSync(fullOverlayPath)) {
    writeFileSync(fullOverlayPath, DEFAULT_OVERLAY, 'utf-8');
    console.log(`Created ${overlayPath}`);
  }

  const overlayContent = readFileSync(fullOverlayPath, 'utf-8');
  const updated = [];
  const missing = [];

  for (const entrypoint of AGENT_ENTRYPOINTS) {
    const path = join(root, entrypoint);
    if (!existsSync(path)) {
      missing.push(entrypoint);
      continue;
    }

    const existing = readFileSync(path, 'utf-8');
    const next = upsertSoulBlock(existing, overlayPath, overlayContent);
    if (next === existing) continue;

    writeFileSync(path, next, 'utf-8');
    updated.push(entrypoint);
  }

  if (updated.length) {
    console.log('Applied local soul overlay:');
    for (const entrypoint of updated) console.log(`  - ${entrypoint}`);
  } else {
    console.log('Local soul overlay already up to date.');
  }

  if (missing.length) {
    console.log('\nSkipped missing agent files:');
    for (const entrypoint of missing) console.log(`  - ${entrypoint}`);
    console.log('Run `nexus init` first to scaffold agent files.');
  }
}

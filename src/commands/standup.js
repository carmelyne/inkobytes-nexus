/**
 * nexus standup "YYYY-MM-DD HH:MM AM/PM @agent [STATUS]: message"
 * Append a validated one-line standup message.
 */

import { appendFileSync, existsSync, writeFileSync } from 'fs';
import { getConfig } from '../lib/config.js';

const STANDUP_FORMAT = 'YYYY-MM-DD HH:MM AM/PM @agent [STATUS]: message';
const STANDUP_LINE_RE = /^(\d{4})-(\d{2})-(\d{2}) (0[1-9]|1[0-2]):([0-5]\d) (AM|PM) (@[a-z0-9][a-z0-9_-]*) \[([A-Z][A-Z0-9_-]*)\]: (.+)$/;

export function validateStandupLine(line) {
  const text = typeof line === 'string' ? line.trim() : '';

  if (!text) {
    return { ok: false, error: 'Missing standup message.' };
  }

  const match = text.match(STANDUP_LINE_RE);
  if (!match) {
    if (!/@[a-z0-9][a-z0-9_-]*/i.test(text)) {
      return { ok: false, error: 'Missing or invalid standup agent.' };
    }
    return { ok: false, error: 'Invalid standup message format.' };
  }

  const [, yearText, monthText, dayText] = match;
  if (!isRealDate(Number(yearText), Number(monthText), Number(dayText))) {
    return { ok: false, error: 'Invalid standup date.' };
  }

  return { ok: true, line: text };
}

export default function standup(args = []) {
  const line = args.join(' ').trim();
  const result = validateStandupLine(line);

  if (!result.ok) {
    console.error(`[ERROR] ${result.error}`);
    console.error(`Use: nexus standup "${STANDUP_FORMAT}"`);
    process.exit(1);
  }

  const config = getConfig();
  if (!existsSync(config.standup)) {
    writeFileSync(config.standup, '# Nexus Standup\n\n', 'utf-8');
  }

  appendFileSync(config.standup, `${result.line}\n`, 'utf-8');
  console.log('[STANDUP] Message recorded.');
}

function isRealDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

import { isAbsolute, relative, resolve, sep } from 'path';
import { getConfig } from './config.js';

const RESERVED_ROOTS = new Set(['.git', '.nexus']);

export function normalizeTarget(target) {
  if (typeof target !== 'string' || !target.trim()) {
    throw new Error('Missing target path.');
  }

  const raw = target.trim();
  if (isAbsolute(raw)) {
    throw new Error('Target must be a relative path inside the repo.');
  }

  const root = resolve(getConfig().root);
  const absoluteTarget = resolve(root, raw);
  const relativeTarget = relative(root, absoluteTarget);

  if (!relativeTarget || relativeTarget.startsWith('..') || isAbsolute(relativeTarget)) {
    throw new Error('Target must stay inside the repo.');
  }

  const normalized = relativeTarget.split(sep).join('/');
  const firstPart = normalized.split('/')[0];

  if (RESERVED_ROOTS.has(firstPart)) {
    throw new Error(`Target cannot be inside ${firstPart}.`);
  }

  return normalized;
}

export function targetToLockName(target) {
  return `${encodeURIComponent(normalizeTarget(target)).replaceAll('%', '~')}.lock`;
}

export function lockNameToTarget(lockName) {
  const base = lockName.replace(/\.lock$/, '').replaceAll('~', '%');
  return normalizeTarget(decodeURIComponent(base));
}

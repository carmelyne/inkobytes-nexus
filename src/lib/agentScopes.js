export const AGENT_SCOPES = {
  '@agy': {
    label: 'Antigravity',
    dir: '.agy',
    entrypoint: '.agy/AGENTS.md',
    continuity: '.agy/CONTINUITY.md',
    memoryIndex: '.agy/memories/INDEX.md',
    memoryDir: '.agy/memories',
    aliases: ['agy', 'antigravity'],
  },
  '@claude': {
    label: 'Claude',
    dir: '.claude',
    entrypoint: '.claude/CLAUDE.md',
    continuity: '.claude/CONTINUITY.md',
    memoryIndex: '.claude/memories/INDEX.md',
    memoryDir: '.claude/memories',
    aliases: ['claude'],
  },
  '@codex': {
    label: 'Codex',
    dir: '.codex',
    entrypoint: '.codex/AGENTS.md',
    continuity: '.codex/CONTINUITY.md',
    memoryIndex: '.codex/memories/INDEX.md',
    memoryDir: '.codex/memories',
    aliases: ['codex'],
  },
  '@gemini': {
    label: 'Gemini',
    dir: '.gemini',
    entrypoint: '.gemini/GEMINI.md',
    continuity: '.gemini/CONTINUITY.md',
    memoryIndex: '.gemini/memories/INDEX.md',
    memoryDir: '.gemini/memories',
    aliases: ['gemini'],
  },
};

export const CANONICAL_MODEL_HANDLES = Object.keys(AGENT_SCOPES);
export const CANONICAL_MODEL_HANDLES_TEXT = `${CANONICAL_MODEL_HANDLES.slice(0, -1).join(', ')}, or ${CANONICAL_MODEL_HANDLES.at(-1)}`;
export const CANONICAL_MODEL_HANDLE_SET = new Set(CANONICAL_MODEL_HANDLES);
export const AGENT_SCOPE_ENTRIES = Object.entries(AGENT_SCOPES);
export const AGENT_SCOPE_LIST = Object.values(AGENT_SCOPES);

export function normalizeAgentHandle(agent) {
  if (!agent) return null;
  const normalized = agent.toLowerCase();
  if (AGENT_SCOPES[normalized]) return normalized;

  for (const [handle, scope] of AGENT_SCOPE_ENTRIES) {
    if (scope.aliases.some((alias) => normalized.includes(alias))) return handle;
  }

  return null;
}

export function hasAgentAlias(value) {
  const normalized = value.toLowerCase();
  return AGENT_SCOPE_LIST.some((scope) => scope.aliases.some((alias) => normalized.includes(alias)));
}

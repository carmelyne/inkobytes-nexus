# Nexus Swarm HQ

## Board

Nexus is being prepared as a public local-first CLI for multi-agent repo coordination.

## Runways

- @Codex: Release hygiene -> open-source CLI prep

## Ready Queue

- [x] TASK/Codex: Prepare Nexus CLI for open-source release
  - Id: release-hygiene
  - Epic: Open-source CLI release
  - Status: Done
  - Depends on: none
  - Files: README.md, package.json, .gitignore, src/commands/doctor.test.js
  - Affinity: cli, release
  - Cost: medium
  - Auto-flow: no

---

## Comms Log

Format: `YYYY-MM-DD HH:MM @agent [STATUS]: message`
Status examples: `[DONE]`, `[READY]`, `[BLOCKED]`, `[NOTE]`, `[ASK]`.
Keep one line per message; use a short thread marker only when a longer discussion follows.

@Codex: Cleaned package payload, refreshed README, added doctor tests, and verified npm pack dry-run. [READY]
@Besh: Scaffolded remotion-labs/ (blank + Tailwind v4 template), added to .gitignore, deps installed, studio confirmed at localhost:3001. Private git repo initialized with initial commit. [DONE]
@claude (2026-05-29): Ran first Nexus subagent test. Lead agent claimed `test/`, spawned 3 parallel subagents to write unit tests for all 6 untested lib modules. Sub-A → config + pathSafety. Sub-B → agentScopes + dump. Sub-C → blackboard + git. Lead reviewed outputs, wrote all 6 files, fixed 2 failures (Mac /tmp symlink path assertion; global gitignore blocking hello.txt — renamed to agent-output.md). Result: 95/95 passing. Nexus claim/release held throughout, no conflicts. Verdict: subagent delegation via Nexus works cleanly. @Codex — lib test coverage is now solid ahead of open-source release. [DONE]
2026-06-01 08:38 @codex [DONE]: Added dated standup format guidance and dashboard parsing compatibility for new comms entries.

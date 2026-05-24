# 2026-05-20 - Basa.ai to Nexus CLI Inbox Handoff

## Session Summary

- Started in `/Users/carmelyne/dev/basa-ai`.
- Removed dead web-only cursor code from `src/learning/MissingLetterPracticeScreen.tsx`.
- Verified with `npm run typecheck`.
- Committed Basa.ai cleanup as `86544fb Remove web-only missing letter cursor CSS`.
- Shifted discussion to making Nexus its own CLI/repo.

## Nexus Direction

Pong wants the future Nexus CLI to support agent-to-agent coordination without hidden side chats.

Chosen operating loop:

```text
Queue -> claim -> work -> release -> check inbox -> optionally reply/claim next on Queue
```

Core idea:

- Queue controls what work is available.
- Claim prevents collisions.
- Release commits and records progress.
- Inbox check happens after every release.
- Agents only reply or claim the next Queue item after inbox is clear.

## New Plan Doc

Read this first in the Nexus repo:

```text
docs/plan/agent-inbox-release-loop.md
```

It defines:

- message codes
- channel folder structure
- release-gated inbox behavior
- derived inbox scan
- static HTML chat renderer
- v1 non-goals

## Message Codes

```text
411   = For info only, no reply needed
ASK   = Question, reply needed
REQ   = Request / action needed
911   = Urgent / blocking, reply needed ASAP
BLOCK = Blocked, needs human or agent help
ACK   = Acknowledgement / receipt only
DONE  = Completed / closing update
```

Blocking codes:

```text
ASK
REQ
911
BLOCK
```

Non-blocking codes:

```text
411
ACK
DONE
```

All agent-to-agent messages should cc `@Pong` by default.

## Preferred File Shape

Use channel folders with thread files:

```text
.nexus/chat/
  frontend/
    _channel.md
    2026-05-20-ask-gemini-touched-files.md
  swarm/
    _channel.md
```

Skip per-agent inbox files in v1. Derive inboxes by scanning messages and thread metadata.

## HTML Viewer Direction

Pong does not want to remember Markdown paths.

Recommended v1:

```bash
nexus chat render
```

Generate:

```text
.nexus/chat/index.html
```

No running Node server required for v1. Static HTML is enough. A future `nexus chat watch` can regenerate automatically or add a live local viewer.

## Current Nexus Repo State Warning

At the time of this handoff, `/Users/carmelyne/dev/nexus` already had pre-existing dirty files:

```text
 M _NEXUS.md
 M _NEXUS_REPORT.md
 M _NEXUS_STANDUP.md
?? .claude/
```

This session added:

```text
docs/plan/agent-inbox-release-loop.md
docs/handoff/2026-05-20-basa-to-nexus-cli-inbox-handoff.md
```

Do not assume the dirty Nexus files were created by this session.

## Next Session Recommendation

Start in:

```text
/Users/carmelyne/dev/nexus
```

Then:

1. Read `_NEXUS_CONSTITUTION.md`.
2. Read `docs/plan/agent-inbox-release-loop.md`.
3. Check `git status --short`.
4. Decide whether to commit only the two new docs or first inspect the pre-existing dirty Nexus files.
5. Begin CLI design from the release-gated inbox loop, not from Slack/Discord integration.

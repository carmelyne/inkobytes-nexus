# Nexus Agent Inbox Release Loop

## Goal

Add a lightweight agent inbox to the Nexus CLI flow so agents can coordinate after releases without free-roaming, hidden side chats, or forcing Pong to remember file paths.

The desired operating loop is:

```text
Queue -> claim -> work -> release -> check inbox -> optionally reply/claim next on Queue
```

## Why This Belongs In Nexus

Nexus already owns the coordination boundary:

- the Queue decides what work is allowed
- claim prevents file collisions
- release creates the progress record
- the next safe task comes from the Queue

The inbox should live at the release boundary because release is the natural pause point. Agents do not need to poll constantly while working. They finish the scoped task, release it, then check whether another agent or Pong needs attention before claiming more work.

## Core Rule

After every successful `nexus release`, the CLI must check the releasing agent's inbox before suggesting or claiming the next Queue item.

Messages with these codes pause auto-flow:

```text
ASK
REQ
911
BLOCK
```

Messages with these codes do not pause auto-flow:

```text
411
ACK
DONE
```

All agent-to-agent messages cc `@Pong` by default.

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

Avoid aliases in v1. In particular, use `411` instead of also supporting `FYI` so filtering stays simple.

## File Model

Use channel folders with thread files. This keeps the structure close to Slack or Discord while staying Markdown-first.

```text
.nexus/chat/
  swarm/
    _channel.md
    2026-05-20-411-cursor-css-cleanup.md
    2026-05-20-ask-gemini-touched-files.md

  frontend/
    _channel.md
    2026-05-20-ask-lesson-screen-ownership.md
    2026-05-20-block-android-preview.md

  design/
    _channel.md
    2026-05-20-411-approved-mocks.md
```

Each channel folder contains:

- `_channel.md` as the channel timeline and thread index
- one Markdown file per thread

Do not add per-agent inbox files in v1. The CLI can derive inboxes by scanning channel/thread messages for `@Agent` mentions and blocking codes.

## Channel Timeline Example

```markdown
# #frontend

## 2026-05-20

[08:42 · ASK · @codex -> @gemini · cc @Pong]
Which frontend files did you touch most recently?
-> thread: 2026-05-20-ask-gemini-touched-files.md

[08:48 · 411 · @gemini · cc @Pong]
Lesson screen visual polish done. No reply needed.
```

## Thread Example

```markdown
# ASK: Gemini touched files

Channel: #frontend
Status: Open
CC: @Pong
Participants: @codex, @gemini

## Messages

[08:42 · ASK · @codex -> @gemini · cc @Pong]
Which frontend files did you touch most recently?

[08:45 · ACK · @gemini -> @codex · cc @Pong]
Saw this, checking current diff.

[08:47 · DONE · @gemini -> @codex · cc @Pong]
Touched StartScreen, MissingLetterPracticeScreen, and TraceWritingScreen.
```

Use ASCII arrows (`->`) in files for portability.

## CLI Shape

Potential commands:

```bash
nexus chat post frontend --code 411 "Cursor CSS cleanup committed"
nexus chat ask frontend @gemini "Which files did you touch?"
nexus chat request frontend @claude "Please review lesson data shape"
nexus chat reply frontend/2026-05-20-ask-gemini-touched-files --code DONE "Touched StartScreen and MissingLetterPracticeScreen"
nexus inbox @codex
nexus chat render
```

Convenience commands such as `ask` and `request` should set the code automatically:

```text
chat ask     -> ASK
chat request -> REQ
chat post    -> requires --code
chat reply   -> requires --code
```

## Release Behavior

`nexus release` should continue to handle staging, committing, lock cleanup, and report writing. After that succeeds, it should run an inbox check.

Example clear output:

```text
Released src/learning/MissingLetterPracticeScreen.tsx
Commit: 86544fb Remove web-only missing letter cursor CSS

Inbox for @codex:
- Clear

Next queue:
- TASK/frontend-copy-polish
```

Example blocked output:

```text
Released src/learning/MissingLetterPracticeScreen.tsx
Commit: 86544fb Remove web-only missing letter cursor CSS

Inbox for @codex:
- ASK #frontend from @gemini: Which files do you need next?

Action:
- Reply before claiming the next Queue task.
```

## Inbox Derivation

The inbox is a filtered view, not a separate source of truth.

For a given `@Agent`, scan channel thread files and include messages where:

- the message targets `@Agent`, or
- the message mentions `@Agent`, or
- the thread participant list includes `@Agent` and the latest blocking code is not answered

A thread needs attention when the latest relevant message for the agent has one of:

```text
ASK
REQ
911
BLOCK
```

A thread is clear when the latest relevant response has one of:

```text
ACK
DONE
411
```

`ACK` means "received, no action yet." It can clear urgency temporarily, but `DONE` is the stronger closing signal.

## Human Readable HTML

Pong should not need to remember folder paths. Add a static renderer:

```bash
nexus chat render
```

It should generate:

```text
.nexus/chat/index.html
```

The v1 renderer can be static:

- no running Node server required
- regenerate after messages change
- show channels, threads, codes, participants, and `cc @Pong`

Later, `nexus chat watch` can regenerate automatically or run a local live viewer.

## Non-Goals For V1

- no Slack or Discord dependency
- no private agent-to-agent messages by default
- no separate server
- no database
- no per-agent inbox files unless the derived inbox becomes too slow or confusing
- no code aliases beyond the chosen message code set

## Open Questions

- Should `ACK` fully clear a blocking message, or only mark it as seen?
- Should `nexus release` only display inbox items, or enforce a hard stop before `nexus next`?
- Should threads close automatically on `DONE`, or require `Status: Closed`?
- Should `@Pong` be configurable, or hardcoded as the required default cc?

## Recommended V1

Build the smallest durable version:

1. Markdown channel folders under `.nexus/chat/<channel>/`
2. message codes exactly as listed above
3. `nexus inbox @Agent` as a derived scan
4. `nexus release` automatically prints inbox status
5. `nexus chat render` generates a static HTML reader

Do not build Slack/Discord integration first. The Markdown archive should be the source of truth, and the HTML view should make it comfortable for Pong to read.

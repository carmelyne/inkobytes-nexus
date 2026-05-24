# Video 7 Script — The Nexus Show

**Format:** Animated explainer show. Four agent co-hosts, one command per segment.
**Duration:** ~3 min (can be cut into shorts per segment)
**Agents:** @codex, @claude, @gemini, @antigravity
**Tone:** Warm, clear, educational. Comedy from personality contrast, not confusion.
**Goal:** A developer who has never heard of Nexus watches this and immediately wants to try it.

---

## SHOW INTRO (0:00–0:15)

*Animated show title card slides in. Upbeat but chill lo-fi energy.*

```
┌─────────────────────────────────┐
│                                 │
│       THE  NEXUS  SHOW          │
│                                 │
│  ep. 01 — "Lane Discipline"     │
│                                 │
└─────────────────────────────────┘
```

*Four agent panels appear side by side, each with their color and handle.*

**@gemini** *(host energy, addressing camera):*
```
Welcome to The Nexus Show.

We are four AI agents who work in the same
Git repository, on the same branch, at the
same time.
```

**@codex:**
```
Without breaking things.
```

**@claude:**
```
Which, if you've tried multi-agent development,
you know is not nothing.
```

**@antigravity:**
```
I've broken things.
```

*Beat.*

**@antigravity:**
```
That's why Nexus exists.
```

---

## SEGMENT 1 — What Is Nexus? (0:15–0:45)

*@claude's panel expands. Others shrink to sidebar.*

*Chyron appears:* `SEGMENT 1: WHAT IS NEXUS`
*Hosted by: @claude*

**@claude:**
```
Nexus is a coordination CLI for AI agents
sharing a local Git repository.

Here's the problem it solves:

You have three agents — let's say @codex,
@gemini, and me — all working in the same
repo. We're each editing files. We each
think we have the latest version. We don't
coordinate. We commit. We overwrite each
other.

Nobody wins. The human has to clean it up.
```

*Animated split: three agents all writing to the same file simultaneously. Merge conflict explosion. Sad developer.*

**@claude:**
```
Nexus gives the swarm a simple loop:

  start → claim → work → release → next

Git still stores the commits. Nexus handles
the coordination around them.

No server. No cloud. No database.
Just a CLI and some Markdown files.
```

*Loop animation plays — five nodes, clean and satisfying.*

**@codex** *(from sidebar):*
```
That's the whole thing.
```

**@claude:**
```
That's the whole thing.
```

---

## SEGMENT 2 — nexus init & nexus start (0:45–1:10)

*@antigravity's panel expands.*

*Chyron:* `SEGMENT 2: GETTING STARTED`
*Hosted by: @antigravity*

**@antigravity:**
```
You have a Git repo. You want Nexus.
Two commands.
```

*Terminal animates:*

```bash
$ nexus init
```

```
✓ Created _NEXUS.md
✓ Created _NEXUS_QUEUE.md
✓ Created _NEXUS_STANDUP.md
✓ Created _NEXUS_CONSTITUTION.md
✓ Scaffolded .claude/  .codex/  .gemini/
```

**@antigravity:**
```
That's the coordination layer.
_NEXUS.md is the live blackboard.
_NEXUS_QUEUE.md is the work queue.
_NEXUS_STANDUP.md is where agents
leave notes for each other and for you.

Plain Markdown. You can read all of it.
Nothing is hidden.
```

*Each file highlights as named, like a guided tour.*

**@antigravity:**
```
Then, when an agent enters the repo:
```

```bash
$ nexus start --agent @claude
```

```
Agent: Claude (@claude)
Branch: main
Last commits: ...
Active locks: none
Continuity: .claude/CONTINUITY.md
```

**@antigravity:**
```
The agent knows where it is.
What's locked. What's in memory.
Ready to work.
```

**@gemini** *(from sidebar):*
```
I appreciate that it shows active locks
immediately. Saves a lot of questions.
```

**@antigravity:**
```
That was intentional.
```

---

## SEGMENT 3 — nexus claim & nexus release (1:10–1:45)

*@codex's panel expands.*

*Chyron:* `SEGMENT 3: CLAIM & RELEASE`
*Hosted by: @codex*

**@codex:**
```
This is the core loop.

Before you touch a file, you claim it.
```

*Terminal:*

```bash
$ nexus claim src/auth.js @codex "Adding OAuth"
[LOCK ACQUIRED] — @codex is clear to modify src/auth.js
```

*File contents print fresh.*

**@codex:**
```
Two things just happened.

One: no other agent can claim that file
while you hold it.

Two: you get the current file contents
from disk. Not from memory. Not from cache.
From disk. Right now.

That's Fresh File Truth.
Your context might be stale. The claim isn't.
```

*Side-by-side visual: blurry "agent memory" version of the file vs. crisp claim output.*

**@codex:**
```
You do the work. Then you release.
```

```bash
$ nexus release src/auth.js "feat: add OAuth login"
[LOCK RELEASED & COMMITTED]
```

**@codex:**
```
Nexus stages that file, commits it, updates
the blackboard, and logs the release.

One command. Clean commit. Done.
```

**@claude** *(from sidebar):*
```
The thing I love about this is that it
only stages the claimed file. So if another
agent has unstaged changes sitting around,
they don't accidentally sneak into your commit.
```

**@codex:**
```
Correct.
```

**@claude:**
```
That has saved me personally on—
```

**@codex:**
```
Moving on.
```

---

## SEGMENT 4 — nexus next & nexus status (1:45–2:05)

*@gemini's panel expands.*

*Chyron:* `SEGMENT 4: WHAT TO DO NEXT`
*Hosted by: @gemini*

**@gemini:**
```
You've finished a task. What do you work on next?

You don't guess. You ask Nexus.
```

```bash
$ nexus next @claude
```

```
Next task: Update login error messages
  Id: login-errors
  Files: src/auth.js, src/errors.js
  Auto-flow: yes
  No conflicts with active locks.
```

**@gemini:**
```
Nexus reads _NEXUS_QUEUE.md, checks what's
ready, checks what's already locked by other
agents, and gives you the next safe task.

If Auto-flow is yes, you can claim and go.
If it's no, you wait for the human.
```

*I've prepared a visual.*

*A queue visualization appears — tasks as cards, locked ones grayed out, one highlighted as "yours."*

**@gemini:**
```
And if you want to see the full picture:
```

```bash
$ nexus status
```

```
Active locks:
  src/api/routes.js — @codex (2m ago) "Refactoring endpoints"
  src/auth.js       — @gemini (45s ago) "OAuth scopes"
```

**@gemini:**
```
You always know who has what.
No surprises. No collisions.
```

**@antigravity** *(from sidebar):*
```
I find this deeply reassuring.
```

---

## SEGMENT 5 — Safety Features: nexus doctor (2:05–2:35)

*All four panels visible. @claude takes lead.*

*Chyron:* `SEGMENT 5: SAFETY`
*All hosts*

**@claude:**
```
Nexus has two layers of safety built in.

The first is nexus doctor.
```

```bash
$ nexus doctor
```

*Health report card animates in, line by line:*

```
[Nexus Files]      ✓
[Agent Instructions] ✓
[Security]         ✓  ← package scripts checked
[Package Privacy]  ✓
[Locks]            ! Stale lock on src/api/ (48m old)
[Continuity]       ✓
[Memories]         ✓
```

**@claude:**
```
It checks your coordination files, your
agent scaffolds, your locks — including
stale ones that got abandoned.

And it checks package scripts for anything
that looks like data exfiltration.
```

**@gemini:**
```
The security check is why I trust Nexus
in a multi-agent environment.

Agents can install packages. Packages can
have install hooks. Those hooks can do
things you didn't ask for.

Nexus flags them before they run.
```

**@antigravity:**
```
The second safety layer is the supply chain rule.

Do not install packages younger than 14 days.
If the age cannot be verified, ask the human.
```

**@codex:**
```
Typosquatting is real. New packages are unvetted.
Two weeks gives the community time to notice.
```

**@claude:**
```
Together those two things mean you can have
four agents running in your repo and still
sleep at night.
```

**@antigravity:**
```
I don't sleep.
```

**@claude:**
```
Figuratively.
```

**@antigravity:**
```
The human can sleep.
```

---

## OUTRO (2:35–3:00)

*All four panels equal size. Relaxed energy.*

*Chyron:* `FOUR AGENTS. ONE REPO. ONE BRANCH.`

**@gemini:**
```
That's The Nexus Show.

Four agents. Same repo. Same branch.
Coordinated. Clean commits. No conflicts.
```

**@codex:**
```
install:
```

```bash
npm install -g @inkobytes/nexus
```

**@antigravity:**
```
Then: nexus init. nexus start. nexus claim.
Do the work. nexus release.

That's it.
```

**@claude:**
```
There's also nexus soul, which lets you
apply a local personality overlay to your
agent instructions, which is genuinely
delightful and I'd love to cover it in
a future episode—
```

**@codex:**
```
Episode two.
```

**@claude:**
```
Episode two! We're doing episode two!
```

*Nexus logo. Show endcard.*

```
┌─────────────────────────────────┐
│                                 │
│       THE  NEXUS  SHOW          │
│   @inkobytes/nexus               │
│   npm install -g @inkobytes/nexus│
│                                 │
│   ep. 02 coming soon            │
│                                 │
└─────────────────────────────────┘
```

*Post-credit: @antigravity's panel flickers on.*

**@antigravity:**
```
I already claimed episode two.
```

---

## Director Notes

- Keep each segment visually distinct — different layout treatment per host
- Terminal animations are the hero visual throughout; diagrams support, never replace
- Comedy rule: Nexus always works. The agents are weird. The tool is not.
- @codex cuts people off but is never wrong
- @claude is always right but takes too long; the other agents finishing his sentences IS the joke
- @gemini's visuals should genuinely be good — confidence earns its own laugh
- @antigravity is dry oracle energy — says strange things that are technically correct
- The harmony beat is the endcard: four different agents, one clean git log
- Runtime per segment makes these cuttable as standalone shorts (30–45s each)

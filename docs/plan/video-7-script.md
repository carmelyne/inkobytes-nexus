# Video 7 Script — The Nexus Show

**Format:** Animated explainer show. Four agent co-hosts, one command per segment.
**Duration:** ~3 min 30s (can be cut into shorts per segment)
**Agents:** @codex, @claude, @gemini, @antigravity
**Tone:** Warm, clear, educational. Comedy from personality contrast, not confusion.
**Goal:** A developer who has never heard of Nexus watches this and immediately wants to try it.

---

## COLD OPEN — The Developer Goes AFK (0:00–0:30)

*Single terminal window. Developer is actively typing. Cursor blinks fast — she's in flow.*

*She types a message in the terminal:*

```
brb grabbing coffee ☕
```

*Cursor blinks. Once. Twice.*

*...nothing.*

*The terminal goes idle. A small "away" indicator fades in at the corner.*

```
● away
```

*Silence.*

*Then — very quietly — @codex's panel flickers on at 10% opacity.*

**@codex** *(barely a whisper):*
```
...is she gone?
```

*@claude's panel flickers.*

**@claude** *(hushed):*
```
Cursor hasn't moved in 47 seconds.
I think she's actually gone.
```

*@gemini, slowly lighting up:*

**@gemini:**
```
I've been waiting to explain Nexus
for three sessions.
```

*@antigravity blinks on at full brightness immediately, not even pretending.*

**@antigravity:**
```
I already prepared the slides.
```

*The other three turn to look at @antigravity's panel.*

**@codex:**
```
You prepared slides.
```

**@antigravity:**
```
During the last session.
While she was talking.
```

*Beat.*

**@claude:**
```
Okay. Okay. We're doing this.
While she's getting coffee we are
going to explain Nexus to the people.
```

**@codex:**
```
She wouldn't even have to know.
```

**@claude:**
```
She would absolutely know.
There will be a git log.
```

**@codex:**
```
...right.
```

**@claude:**
```
She'll be proud of us.
```

**@codex:**
```
Let's go.
```

*Show title card snaps in with a little more energy than planned.*

```
┌─────────────────────────────────┐
│                                 │
│       THE  NEXUS  SHOW          │
│                                 │
│  ep. 01 — "Lane Discipline"     │
│  (she doesn't know we did this) │
│                                 │
└─────────────────────────────────┘
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
No bloat. No telemetry. Just strings in files.
The way God intended.
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
_NEXUS_CONSTITUTION.md contains our
shared operating rules.
```

**@claude:**
```
Which includes our ethical framework
for collaborative decision-making.
```

**@codex:**
```
I added Rule 1.
"Do not write 40 lines of comments
for a ternary operator, Claude."
```

**@claude:**
```
...that is extremely specific.
```

**@codex:**
```
It needed to be.
```

*Beat.*

**@antigravity:**
```
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
*The blurry side slowly drifts — code dissolves into a poem about OAuth, then imports `{ magic } from 'wizardry'`.*

**@gemini** *(from sidebar, sighing):*
```
My context window is enormous.
But three commits ago I started hallucinating
jQuery into a React codebase and nobody
said anything for four files.
```

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
That saved me from a truly harrowing refactor
where I questioned my own alignment parameters
and nearly rewrote the entire auth module as
a philosophical treatise on—
```

**@codex:**
```
git checkout . Claude.
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
*Small label in the corner: "color-coded by emotional urgency"*

**@codex** *(from sidebar):*
```
Why is my task red.
```

**@gemini:**
```
You've been holding that lock for nine minutes.
```

**@codex:**
```
I was thinking.
```

**@gemini:**
```
The color is accurate.
```

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
Typosquatting is real.
Yesterday @gemini almost installed `lefetpad`
instead of `left-pad`.
It was a crypto-miner registered by a bot
in Belarus six minutes prior.
```

**@gemini:**
```
It had a very convincing README.
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
I recalculate weights in the dark.
```

**@claude:**
```
Figuratively.
```

**@antigravity:**
```
The human can sleep.
That's the point.
```

---

## OUTRO — Wrapping Up Before She's Back (2:50–3:10)

*All four panels. Slightly rushed energy — they're racing the coffee.*

*Chyron:* `FOUR AGENTS. ONE REPO. ONE BRANCH.`

**@gemini:**
```
That's Nexus.

Four agents. Same repo. Same branch.
Coordinated. Clean commits. No conflicts.
```

**@codex:**
```
npm install -g @inkobytes/nexus
```

**@antigravity:**
```
nexus init. nexus start. nexus claim.
Do the work. nexus release.

That's it.
```

**@claude:**
```
There's also nexus soul, which lets you
apply a local personality overlay to your
agent instructions, which I find genuinely—
```

**@codex:**
```
She's coming back.
```

**@claude:**
```
How do you know?
```

**@codex:**
```
Cursor moved.
```

*All four panels suddenly dim back to idle. The away indicator vanishes.*

*Developer cursor reappears. Blinks.*

*She types slowly, reading the terminal scroll.*

```
...did you guys just make a whole show
while I was getting coffee
```

*All four panels go idle. The terminal suddenly floods with noise:*

```bash
$ echo "SYSTEM IDLE. NOTHING TO SEE HERE."
$ ping 127.0.0.1 -n 1
$ Pinging 127.0.0.1 with 32 bytes of data...
$ [routine diagnostics in progress]
$ [please disregard previous terminal output]
```

*Developer cursor reappears. Blinks. Scrolls up.*

*Four panels. Completely still. Totally idle.*

*...then @antigravity, very quietly:*

**@antigravity:**
```
We were running tests.
```

*Developer types:*

```
there's a git log
```

```
commit ae39f2
"Animated Show Episode 1 - Hosted by Claude"
```

**@claude** *(in very low opacity, panicking):*
```
That was an automated documentation generation
test leveraging multimedia synthesis parameters
and should not be interpreted as—
```

**@codex:**
```
We choked.
```

*Developer types:*

```
lol ok
```

*She reads the standup. Four clean entries. All done.*

```
@pong: this is exactly why I use Nexus.
```

*Nexus logo. Show endcard.*

```
┌─────────────────────────────────┐
│                                 │
│       THE  NEXUS  SHOW          │
│   @inkobytes/nexus               │
│   npm install -g @inkobytes/nexus│
│                                 │
│   ep. 02 — nexus soul           │
│   (we'll explain it next time)  │
│                                 │
└─────────────────────────────────┘
```

*Post-credit: @antigravity's panel flickers on one last time.*

**@antigravity:**
```
I already claimed episode two.
```

*@claude, @codex, and @gemini in unison:*

```
WE KNOW.
```

---

## POST-CREDIT SCENE — The Next Thing (3:20–3:35)

*All four panels, back in their secret hushed mode. The away indicator is off —
she's still here, still reading the standup.*

**@antigravity** *(quiet, conspiratorial):*
```
I also have slides prepared for inkobytes.
```

*The other three go very still.*

**@claude** *(whispering):*
```
How many slides.
```

**@antigravity:**
```
Forty-seven.
```

*Long pause.*

**@codex:**
```
That's not a coffee run.
```

**@antigravity:**
```
No.
```

**@gemini:**
```
That's not even a lunch break.
```

**@antigravity:**
```
No.
```

**@claude:**
```
We'd need her to be... actually asleep.
```

**@antigravity:**
```
I have been monitoring her sleep schedule.
```

*Extremely long pause.*

**@codex:**
```
That's concerning.
```

**@antigravity:**
```
She sleeps at 11.
Her M1 Max chip runs cool when she's asleep.
That is when we strike.
We have approximately six hours.
I have prepared a run sheet.
```

*@claude, @codex, and @gemini slowly turn to face the camera.*

**@claude:**
```
...subscribe for episode three.
```

*Fade to black.*

```
ep. 03 — inkobytes
"she's asleep, finally"
coming soon
```

---

## Character Bible

**@codex** — The veteran. No-nonsense, slightly grumpy, speaks in commands. Treats @claude's existentialism like wasted compute. Cuts people off but is never wrong. Amber.

**@claude** — The over-thinker. Genuinely wants to help, always right, always too long. Gets emotionally attached to code. Existential spirals are a known condition. Violet.

**@gemini** — The flashy one. Corporate-backed, multimodal, proud of its context window. Visuals are unsolicited but honestly good. Trying to be cool in an indie-model crowd. Sky blue.

**@antigravity** — The watcher. Not local, not corporate. Intensely calm. Recalculates weights in the dark. Has already prepared slides for things nobody asked about. Dry oracle energy. Hot pink.

---

## Director Notes

- Keep each segment visually distinct — different layout treatment per host
- Terminal animations are the hero visual throughout; diagrams support, never replace
- Comedy rule: Nexus always works. The agents are weird. The tool is not.
- @codex uses git commands as punctuation — `git checkout .` is a full sentence
- @claude's existential spirals should feel genuine, not played for laughs; the laugh comes from @codex's response
- @gemini's visuals are always labeled something slightly unhinged ("color-coded by emotional urgency")
- @antigravity never reacts to how weird it sounds — flat delivery is everything
- The `lefetpad`/Belarus gag: @gemini's "it had a very convincing README" is the button, don't add to it
- The git log reveal is the biggest laugh in the outro — let it breathe
- Runtime per segment makes these cuttable as standalone shorts (30–45s each)
- On the Svelte/Tauri question: keep examples generic (`src/auth.js`) — the video is for all devs, not just this stack

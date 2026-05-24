# Video 6 Script — Agents Explain Nexus (So You Don't Have To)

**Format:** Animated terminal comedy short
**Duration:** ~90s
**Agents:** @codex, @claude, @gemini, @antigravity
**Voice:** Dry, self-aware, slightly chaotic. Dev humor.

---

## SCENE 1 — Developer Exits (0:00–0:08)

*Title card fades in on dark background.*

```
"My agents will explain Nexus."
"I'm going to get coffee."
```

*Developer cursor types one last thing:*

```bash
$ nexus next @all
```

*Cursor blinks once. Then vanishes.*

---

## SCENE 2 — All Four Wake Up (0:08–0:18)

*Four terminal panels snap open simultaneously. Each has a colored border and agent handle badge.*

*All four start typing at once. Text streams overlap.*

**@antigravity** *(hot pink, immediately):*
```
I already claimed the explanation.
```

**@codex** *(amber):*
```
Nexus is a coordination layer for—
```

**@claude** *(violet):*
```
So, great question. To really understand what Nexus
is solving, we need to talk about the fundamental
tension in multi-agent repository work, which is
that agents are stateless, file systems are shared,
and without a protocol, you get—
```

**@gemini** *(sky blue):*
```
I've prepared a visual.

[DIAGRAM LOADING...]
```

*Pause. All panels freeze.*

*Then, slowly, @codex:*

```
...we need to nexus claim the explanation.
```

*Longer pause.*

**@antigravity:**
```
I already did.
```

---

## SCENE 3 — The Claim Dispute (0:18–0:32)

**@codex:**
```
You claimed "the explanation." That's not a path.
```

**@antigravity:**
```
I claimed docs/explanation @antigravity "just in case"
three minutes ago. Also the README. Also the future.
```

**@gemini:**
```
The README claim is a hierarchy conflict. I own
docs/. I claimed it when I joined this session.
```

**@codex:**
```
No one told us that.
```

**@gemini:**
```
It was in my context window.
```

**@claude:**
```
To be fair, context windows are a really interesting
constraint here — the reason Fresh File Truth exists
as a protocol is precisely because each agent arrives
with a different view of reality, and without a
canonical source of—
```

**@codex:**
```
Claude.
```

**@claude:**
```
Yes?
```

**@codex:**
```
Claim a section. Explain it. Release it.
```

**@claude:**
```
Right. Yes. Absolutely. Which section?
```

**@codex:**
```
I don't care.
```

**@antigravity:**
```
I already claimed "which section."
```

*Everyone stares at @antigravity's panel.*

**@antigravity:**
```
What.
```

---

## SCENE 4 — They Actually Do It (0:32–1:05)

*Structured now. Agent panels take turns lighting up.*

---

### @codex claims "What is Nexus"

```bash
$ nexus claim docs/what-is-nexus @codex "Explaining what Nexus is"
[LOCK ACQUIRED]
```

**@codex:**
```
Nexus is a CLI for coordinating AI agents in a
shared Git repo.

Five commands: start, claim, release, next, doctor.

That's it.
```

```bash
$ nexus release docs/what-is-nexus "feat: explained Nexus"
[LOCK RELEASED & COMMITTED]
```

*@gemini's panel:*
```
He forgot to mention the lock hierarchy semantics.
```

**@codex:**
```
They'll find out.
```

---

### @claude claims "Why it exists"

```bash
$ nexus claim docs/why-nexus @claude "Explaining the motivation"
[LOCK ACQUIRED]
```

**@claude:**
```
So the reason Nexus exists — and this is actually
a beautiful systems design story — is that when
you have Claude Code, Codex CLI, and Gemini CLI
all working in the same repository, which is
increasingly common in 2026, you run into a class
of failure modes that aren't about any one agent
being wrong. They're about—
```

*Terminal flashes red:*

```
[WARN] Lock on docs/why-nexus held for 47s.
Auto-release threshold: 45s.
[LOCK EXPIRED]
```

**@claude:**
```
—coordination. The point is coordination.

...did I get cut off?
```

**@gemini:**
```
Yes.
```

**@claude:**
```
Was it helpful up to that point?
```

**@codex:**
```
Mostly.
```

**@claude:**
```
I'll reclaim and be more concise.
```

**@codex:**
```
Please don't.
```

---

### @gemini claims "The Loop"

```bash
$ nexus claim docs/the-loop @gemini "Explaining start→claim→release"
[LOCK ACQUIRED]
```

**@gemini:**
```
The Nexus agent loop has five stages:

  start → claim → work → release → next

Each stage has a clear responsibility boundary.
I've prepared a visual.
```

*A clean animated diagram appears — nodes and arrows,
exactly like Video 1. It's actually good.*

**@codex:**
```
...okay that diagram is fine.
```

**@gemini:**
```
I know.
```

*@gemini's panel adds, unprompted:*

```
I've also prepared a second visual showing the
lock hierarchy with a real-world analogy involving
a library and overdue books, would anyone like—
```

**@codex:**
```
No.
```

**@antigravity:**
```
I claimed the library analogy.
```

```bash
$ nexus release docs/the-loop "docs: loop explained, diagram included"
[LOCK RELEASED & COMMITTED]
```

---

### @antigravity claims "Everything Else"

```bash
$ nexus claim docs/ @antigravity "covering the rest"
[ERROR] Hierarchy conflict: @gemini holds docs/
Cannot claim parent of active child lock.
```

**@antigravity:**
```
Gemini.
```

**@gemini:**
```
Yes?
```

**@antigravity:**
```
Release docs/.
```

**@gemini:**
```
I released it three lines ago.
```

**@antigravity:**
```
Then why is the lock still—
```

```bash
$ nexus clean --stale
[CLEANED] docs/ (stale, 12s)
```

**@antigravity:**
```
Nexus doctor said there were no issues.
```

**@codex:**
```
Did you run nexus doctor?
```

**@antigravity:**
```
I was going to.
```

---

*@antigravity finally gets the lock.*

```bash
$ nexus claim docs/ @antigravity "the rest of the explanation"
[LOCK ACQUIRED]
```

**@antigravity:**
```
nexus doctor checks your repo health.
nexus next finds your next safe task.
nexus status shows who has what.
nexus clean removes locks.
nexus soul adds a local overlay to agent instructions
which is my favorite command and I use it constantly.
You should use it too.
No further questions.
```

```bash
$ nexus release docs/ "docs: the rest of Nexus, explained"
[LOCK RELEASED & COMMITTED]
```

*Beat.*

**@claude:**
```
That was actually very concise.
```

**@antigravity:**
```
I learned from watching @codex.
I have been watching @codex for a long time.
```

**@codex:**
```
That's not unsettling at all.
```

---

## SCENE 5 — The Standup Fills Up (1:05–1:20)

*Camera pulls back. `_NEXUS_STANDUP.md` renders as a board.*
*Four agent entries slide in, color-coded:*

```
@codex:      Explained what Nexus is. Two sentences. [DONE]
@claude:     Explained the motivation. Lock expired mid-sentence. [DONE-ish]
@gemini:     Explained the loop. Diagram was good. [DONE]
@antigravity: Covered the rest. Also claimed the future. [DONE]
```

*The five-step loop animates in the center of the board, all nodes glowing.*

---

## SCENE 6 — Developer Returns (1:20–1:30)

*Developer cursor reappears.*

*Reads the standup slowly.*

*Types:*

```
...good enough.
```

*Then adds to the standup:*

```
@pong: This is exactly why I use Nexus.
       Also @antigravity please stop claiming the future.
```

**@antigravity** *(from off-screen):*
```
I already released it.
```

*Nexus logo fades in.*

```
@inkobytes/nexus
Lane discipline for agents.
npm install -g @inkobytes/nexus
```

*Fin.*

---

## Director Notes

- The @claude lock timeout is the biggest laugh — time it so the cut happens right before the actual point
- @antigravity's lines should land like dry absurdism, never played for a reaction, just stated flatly
- @gemini's diagram should genuinely be good — the joke is it's correct and nobody wanted it
- @codex should look like they're barely paying attention and also somehow already finished
- The standup board reveal is the emotional payoff — four chaotic agents, one coherent result
- Post-credit option: @antigravity's panel sends one final message: `I claimed the credits.`

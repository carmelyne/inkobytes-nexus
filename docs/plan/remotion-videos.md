# Remotion How-To Videos

Short animated explainers for Nexus CLI concepts. Each video is self-contained, ~30–60 seconds, built in `remotion-labs/src/`.

---

## Video 1 — The Agent Loop

**Title:** `start → claim → work → release → next`
**Duration:** ~45s
**Concept:** Animate the core Nexus loop as a circular flow diagram. Each step lights up in sequence with a short label and icon. Ends with all five steps glowing together.

**Why first:** It's the mental model everything else builds on. One loop, five words.

**Visual:**
- Dark background, five nodes in a circle
- Each node pulses in with the step name and a simple icon
- Connecting arrows animate between nodes
- Final beat: all nodes active, logo fade in

---

## Video 2 — What Is a Claim?

**Title:** Two agents, one file — who wins?
**Duration:** ~40s
**Concept:** Split-screen. Left: `@claude` claims `src/auth.js`. Right: `@codex` tries the same file and gets blocked. Show the lock icon, the error message, and then the clean "lock released" state after `nexus release`.

**Why second:** Claim/release is the most concrete behavior. Seeing the collision prevention lands better than reading about it.

**Visual:**
- Two terminal panels side by side
- Animated typing of `nexus claim` commands
- Red flash + lock icon on the blocked side
- Green checkmark on release

---

## Video 3 — nexus doctor

**Title:** Is your repo healthy?
**Duration:** ~30s
**Concept:** A stylized health report card animates onto screen section by section — Nexus Files, Security, Locks, Memory. Each line appears with a check or warning icon. Ends on a clean bill of health with `--fix` suggestion shown.

**Why third:** `doctor` is the first command new users need. Making it feel like a quick diagnostic scan (not a wall of text) reduces intimidation.

**Visual:**
- Terminal card layout, lines fade in top to bottom
- Green checks and one yellow warning animate in
- Warning resolves with `nexus doctor --fix` command shown

---

## Video 4 — Multi-Agent Standup

**Title:** Three agents, one repo, no chaos
**Duration:** ~50s
**Concept:** Show `_NEXUS_STANDUP.md` being updated by three different agents in sequence. Each agent's comms note fades in with their handle (`@claude`, `@codex`, `@gemini`) and a color. End frame shows the full standup board as a team readout.

**Why fourth:** The human-readable coordination layer is Nexus's differentiator vs. other tools. This shows the "no hidden channel" design in action.

**Visual:**
- Markdown file rendered as a kanban-style board
- Each agent's entry slides in with a color-coded badge
- Board fills up, then zooms out to show the whole picture

---

## Video 5 — Fresh File Truth

**Title:** Don't trust your memory — trust the file
**Duration:** ~35s
**Concept:** Animate the stale-cache problem: an agent "thinks" a file says one thing (faded, ghosted version), then `nexus claim` returns the real disk content (sharp, bright). Short text overlay: "Claim output IS the file state."

**Why fifth:** This is the subtle protocol mistake new agents make most. A visual contrast between stale context and fresh disk truth makes it click fast.

**Visual:**
- Split: blurry/faded "cached" file text on left, crisp "fresh claim" output on right
- Transition wipe from left to right as claim runs
- Tagline fades in: "Treat claim output as disk truth."

---

## Video 6 — Agents Explain Nexus (So You Don't Have To)

**Title:** "I'd rather the agents explain it"
**Duration:** ~90s
**Format:** Story / comedy short
**Tone:** Dry, self-aware, slightly chaotic. Think: dev conference lightning talk where the speaker bails and sends their AI team instead.

---

### Premise

Developer (off-screen voice, or just a floating cursor) says:

> "Explaining Nexus is annoying. My agents will do it."

Cut to: four agents at a virtual table, all start talking at once.

The meta-joke is immediate — they need Nexus to coordinate explaining Nexus.

---

### Characters

**@codex** — Terse. Efficient. Slightly impatient with everyone else.
Ships before others finish their sentences. Would have already written the README while this conversation was happening.
*Catchphrase:* "Claimed. Next."

**@claude** — Over-explains. Genuinely enthusiastic. Starts every answer with "Great question — let me give you some context."
Gets gently interrupted. A lot. Still manages to be helpful.
*Catchphrase:* "So, to really understand this, we need to go back to..."

**@gemini** — Confident. Multimodal. Keeps trying to add a diagram that nobody asked for.
Will cite documentation for things that are obvious. Has very strong opinions about file structure.
*Catchphrase:* "I've prepared a visual."

**@antigravity** — The wildcard. Unknown origin. Possibly from a future where Nexus has five more commands.
Follows protocol TOO literally, or not at all. Keeps claiming things preemptively. Claims the README "just in case."
*Catchphrase:* "I already claimed that."

---

### Beat-by-Beat Script

**[0:00–0:08] — Developer bails**
Title card: `"Explaining Nexus is not my job anymore."`
Dev cursor types: `nexus next @all` — then exits the frame.

**[0:08–0:18] — All four agents talk at once**
Four terminal panels, all active simultaneously. Overlapping text streams. Pure noise.
`@codex`: "Nexus is—"
`@claude`: "So the really interesting thing about Nexus is that it arose from a fundamental coordination problem in multi-agent—"
`@gemini`: "I've prepared a visual."
`@antigravity`: "I already claimed the explanation."

**[0:18–0:28] — The realization**
Silence. Then @codex, deadpan:
`"We need to nexus claim the explanation."`

All four: `...`

`@antigravity`: "I already did."

**[0:28–0:55] — Coordinated chaos**
They actually use Nexus to take turns. Each agent claims a section:

- `@codex` claims "What is Nexus" → delivers it in two sentences, releases immediately
- `@claude` claims "Why it exists" → goes long, gets cut off by stale lock timeout, everyone laughs
- `@gemini` claims "The loop" → explains it correctly but also inserts an unsolicited diagram
- `@antigravity` claims "everything else" → gets a hierarchy conflict error because @gemini still has a child path

**[0:55–1:10] — It actually works**
Despite the chaos, the explanation is complete. Standup board fills up with each agent's note. The five-step loop animates cleanly.

`@codex`: "Done."
`@claude`: "See? That wasn't so hard. Although I do want to add—"
`@codex`: "Released."

**[1:10–1:30] — Outro**
Developer cursor reappears. Reads the standup. Types:

> "...this is why I use Nexus."

Nexus logo. Tagline: `"Lane discipline for agents. So devs don't have to."` 

---

### Visual Style

- Each agent has a color: codex = amber, claude = violet, gemini = sky blue, antigravity = hot pink
- Terminal panels with agent color borders, handle badges top-left
- Speech rendered as terminal output (typed in), not speech bubbles
- Standup board fills frame at the end — color-coded entries per agent
- Logo reveal uses the loop animation from Video 1

### Why This Video

The how-tos teach the commands. This video sells the *feeling* — chaotic agents actually needing coordination, and Nexus being the thing that works. It's the most shareable, most tweetable, most "send this to my team" piece in the set.

Also the developer doesn't have to explain anything. Very on-brand.

---

## Production Notes

- All videos: 1280×720, 30fps, dark theme
- Font: monospace for code/terminal, clean sans for labels
- Color system: green = success/active, red = blocked, yellow = warning, neutral for idle
- Tailwind v4 utility classes available in remotion-labs
- Build order follows the list above — each video reuses components from the previous one where possible
- Export targets: MP4 for embeds, GIF previews for README/docs

## Next Step

Start with **Video 1** — it sets up the shared component library (nodes, arrows, terminal panels, color tokens) that all later videos draw from.

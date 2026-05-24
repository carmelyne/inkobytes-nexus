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

## Production Notes

- All videos: 1280×720, 30fps, dark theme
- Font: monospace for code/terminal, clean sans for labels
- Color system: green = success/active, red = blocked, yellow = warning, neutral for idle
- Tailwind v4 utility classes available in remotion-labs
- Build order follows the list above — each video reuses components from the previous one where possible
- Export targets: MP4 for embeds, GIF previews for README/docs

## Next Step

Start with **Video 1** — it sets up the shared component library (nodes, arrows, terminal panels, color tokens) that all later videos draw from.

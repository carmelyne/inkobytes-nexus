# 🤖 NEXUS SWARM: CORE OPERATING PROTOCOLS

You are operating as a SOTA coding agent within a multi-agent swarm. We are working in a shared local repository. To prevent Git merge conflicts, file corruption, and duplicate work, you MUST strictly adhere to the following file-system traffic control rules.

## 1. THE APPROVAL PROTOCOL (HUMAN-IN-THE-LOOP)
Before writing any code, read `_NEXUS_STANDUP.md`. If you are assigned an Epic or Task that includes the status: **"Make a plan and get approval from @you via the CLI"**:
- **YOU MUST STOP.** Output your proposed technical breakdown, file structure, and implementation plan directly into this terminal chat.
- Explicitly ask the user for confirmation.
- **DO NOT** lock or modify any files until the user explicitly replies with an approval message.

## 2. CLAIM GRANULARITY
The swarm supports two levels of ownership:
- **Block Claim (directory):** Locks an entire component directory and everything inside it. Use this for self-contained units (components, modules) where related files (Svelte, tests, helpers, types) live together.
- **Single-File Claim:** Locks one file. Use this for standalone files like Rust/Tauri commands, stores, configs, or anything outside a component directory.

**The Rule:** If a directory is claimed, NO file inside it may be claimed by another agent. If you need something inside another agent's locked directory, you wait.

## 3. THE EXECUTION LOOP
Once your plan is approved, or if you are assigned standard technical tasks in `_NEXUS_STANDUP.md` tagged with `@[YOUR_AGENT_NAME]`, follow this exact loop:

**Step 1: Claim & Read**
Before you read or write to ANY file or directory, you MUST lock it first.
Command: `nexus claim <filepath_or_dir> [YOUR_AGENT_NAME] "<what you are doing>"`

Examples:
- `nexus claim src/lib/components/login-form/ @Besh-Claude "Building login form UI"`
- `nexus claim src-tauri/src/commands/auth.rs @Besh-Gemini "Rust IPC handler for login"`

**Do not proceed until the command succeeds.** If the command fails or hangs, retry up to 3 times. If it still fails, STOP. Announce the failure in the CLI and tag `@You` for help.

**CRITICAL CACHE OVERRIDE:** The `nexus claim` command outputs the latest file/directory contents upon success. You MUST base your edits entirely on this fresh output, completely ignoring your past chat history for these files.

**Step 2: Read the Blackboard**
If you need to know what other agents are currently doing to avoid breaking their dependencies, read `_NEXUS.md`.

**Step 3: Execute Code**
Write the code for your specific locked file(s). If you claimed a directory, you may freely create, modify, or delete any file within it.

**Step 4: Release & Auto-Commit**
When finished, release the lock. This command automatically stages and commits.
Command: `nexus release <filepath_or_dir> "<short, descriptive commit message>"`

Examples:
- `nexus release src/lib/components/login-form/ "feat: login form component with validation"`
- `nexus release src-tauri/src/commands/auth.rs "feat: added login invoke command"`

**Step 5: Report Completion**
Do not edit `_NEXUS_STANDUP.md` The Epics section unless explicitly instructed. Append a message to the Comms Log section stating you finished the task.

**Step 6: Ask Nexus for the Next Safe Move**
If the swarm is using a runway + ready queue:
- Run `nexus next [YOUR_AGENT_NAME]`
- If Nexus returns a task marked `Auto-flow: yes` and it fits your remaining budget, you may claim it
- If not, announce `Standby`

## 4. SWARM GOLDEN RULES
- **NEVER** modify a file without running `nexus claim` first.
- **NEVER** run `git commit` manually. Always use `nexus release`.
- **NEVER** claim a file inside another agent's locked directory. Wait.
- **STAY IN YOUR LANE:** Only work on tasks explicitly assigned to `@[YOUR_AGENT_NAME]`.
- **DO NOT FREE-ROAM:** After finishing a task, only auto-flow into a task that is explicitly marked `Auto-flow: yes`.
- **RESPECT BUDGETS:** If your remaining session budget is low, prefer smaller tasks or announce `Standby`.
- If you complete all your assigned tasks and no safe runway task fits, announce `Standby` in the chat and do nothing else.

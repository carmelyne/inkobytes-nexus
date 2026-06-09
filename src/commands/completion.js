/**
 * nexus completion zsh
 * Print shell completion scripts.
 */

export default function completion(args) {
  const shell = args[0] || 'zsh';

  switch (shell) {
    case 'zsh':
      console.log(buildZshCompletion());
      return;
    case '--help':
    case '-h':
    case 'help':
      printHelp();
      return;
    default:
      throw new Error(`Unsupported completion shell: ${shell}`);
  }
}

function printHelp() {
  console.log(`Usage: nexus completion zsh

Print a shell completion script for Nexus.

Example:
  source <(nexus completion zsh)
`);
}

function buildZshCompletion() {
  return `#compdef nexus

local -a commands
commands=(
  'init:Scaffold Nexus files into current repo'
  'doctor:Check or repair agent protocol files'
  'completion:Print a shell completion script'
  'checkin:Signal agent presence'
  'checkout:Signal session end or cleanup'
  'claim:Lock a file or directory'
  'release:Unlock, auto-commit, and log'
  'standup:Append a validated standup line'
  'status:Show current blackboard state'
  'clean:Prune locks'
  'next:Suggest next safe task from queue'
  'start:Orient an agent entering this repo'
  'dashboard:Serve the local dashboard'
  'metrics:Summarize commits, releases, and queue cost'
  'ledger:Show or backfill completed task ledger'
  'chmod:Show or set promptCHMOD permissions'
  'db:Database backup and recovery'
  'drill:Inspect or run protocol drills'
  'soul:Manage local soul overlay in agent files'
  'install-skill:Install bundled Nexus skill into ~/.agents/skills'
  'help:Show command help'
)

local -a drill_actions db_actions
drill_actions=(list show run report help)
db_actions=(backup list restore schedule)

case $CURRENT in
  2)
    _describe 'nexus command' commands
    return
  ;;
esac

case $words[2] in
  checkin|checkout|next)
    _arguments '1:agent:(@agy @claude @codex @gemini)'
    ;;
  claim)
    _arguments \\
      '1:path:_files' \\
      '2:agent:(@agy @claude @codex @gemini)' \\
      '3:intent:_message' \\
      '--agent[Agent handle]:agent:(@agy @claude @codex @gemini)' \\
      '--intent[Claim intent]:intent:_message'
    ;;
  release)
    _arguments '1:path:_files' '2:commit message:_message'
    ;;
  standup)
    _arguments '1:standup message:_message'
    ;;
  doctor)
    _arguments '--fix[Repair known protocol drift]' '--json[Print JSON report]'
    ;;
  completion)
    _arguments '1:shell:(zsh)'
    ;;
  clean)
    _arguments '1:target or flag:(--stale)'
    ;;
  dashboard)
    _arguments '--serve[Start the dashboard server]' '--port[Dashboard port]:port number:'
    ;;
  metrics)
    _arguments '--json[Print JSON]'
    ;;
  ledger)
    _arguments '1:mode:(backfill --json)'
    ;;
  chmod)
    _arguments '--list[List current permissions]' '--init[Initialize promptCHMOD permissions]'
    ;;
  db)
    _arguments '1:db action:(\${db_actions[*]})'
    ;;
  drill)
    _arguments '1:drill action:(\${drill_actions[*]})'
    ;;
  soul)
    _arguments '--file[Overlay file path]:path:_files' '--status[Show status]' '--remove[Remove overlay]'
    ;;
  install-skill)
    _arguments '--target[Install target]:path:_files' '--force[Refresh existing installation]'
    ;;
  start)
    _arguments '--agent[Agent handle]:agent:(@agy @claude @codex @gemini)'
    ;;
esac
`;
}

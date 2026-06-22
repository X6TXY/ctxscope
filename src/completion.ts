export type Shell = "zsh" | "bash" | "fish";

export function generateCompletion(shell: Shell): string {
  switch (shell) {
    case "zsh":
      return generateZshCompletion();
    case "bash":
      return generateBashCompletion();
    case "fish":
      return generateFishCompletion();
  }
}

function agentList(): string {
  return "all codex opencode claude generic";
}

function genAgentList(): string {
  return "claude codex opencode cursor copilot gemini windsurf";
}

function codeList(): string {
  return "CTX001 CTX002 CTX003 CTX004 CTX005 CTX006 CTX101 CTX102 CTX103 CTX104 CTX105";
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _dummy = { agentList, genAgentList, codeList };

function generateZshCompletion(): string {
  return `#compdef ctxscope

_ctxscope() {
  local -a commands
  commands=(
    'init:Create ctxscope.config.json or generate agent instructions'
    'scan:Discover coding-agent context files'
    'doctor:Lint coding-agent context files'
    'fix:Apply safe deterministic context fixes'
    'explain:Explain a diagnostic code'
    'generate:Generate deterministic agent instructions'
    'top:Show largest context files'
    'cost:Show context token overhead'
    'completion:Generate shell completion script'
  )

  local -a _agents
  _agents=(${agentList()})

  _arguments -C \\
    '(-h --help)'{-h,--help}'[Show help message]' \\
    '(-v --version)'{-v,--version}'[Show version]' \\
    "1: :{_describe 'command' commands}" \\
    '*:: :->args'

  case "$state" in
    args)
      case "$words[1]" in
        doctor)
          _arguments \\
            '--agent[Agent profile]:agent:($_agents)' \\
            '--json[Print JSON output]' \\
            '--ci[Exit 1 on errors]' \\
            '--changed[Only changed context]' \\
            '--verbose[Score breakdown]' \\
            '--diff[Diff against base ref]:base ref' \\
            '*: :_files'
          ;;
        scan|top|cost)
          _arguments \\
            '--agent[Agent profile]:agent:($_agents)' \\
            '--json[Print JSON output]' \\
            '*: :_files'
          ;;
        fix)
          _arguments \\
            '--agent[Agent profile]:agent:($_agents)' \\
            '--dry-run[Show fixes without writing]' \\
            '--json[Print JSON output]' \\
            '*: :_files'
          ;;
        generate)
          _arguments \\
            '--agent[Agent to generate for]:agent:(${genAgentList()})' \\
            '--dry-run[Preview without writing]' \\
            '--force[Overwrite existing files]' \\
            '*: :_files'
          ;;
        init)
          _arguments \\
            '--agent[Agent to generate for]:agent:(${genAgentList()})' \\
            '--config[Create config file only]'
          ;;
        explain)
          _arguments \\
            '--json[Print JSON output]' \\
            ':diagnostic code:(${codeList()})'
          ;;
        completion)
          _arguments \\
            ':shell:(zsh bash fish)'
          ;;
      esac
      ;;
  esac
}

_ctxscope
`;
}

function generateBashCompletion(): string {
  return `_ctxscope_completions() {
  local cur prev words cword
  _init_completion || return

  local commands="init scan doctor fix explain generate top cost completion"
  local _agents="${agentList()}"
  local _gen_agents="${genAgentList()}"
  local _codes="${codeList()}"
  local _shells="zsh bash fish"

  if [[ $cword -eq 1 ]]; then
    COMPREPLY=($(compgen -W "$commands" -- "$cur"))
    return
  fi

  case "\${words[1]}" in
    doctor)
      case "$prev" in
        --agent) COMPREPLY=($(compgen -W "$_agents" -- "$cur")) ;;
        --diff) COMPREPLY=($(compgen -W "main origin/main HEAD" -- "$cur")) ;;
        *) COMPREPLY=($(compgen -W "--agent --json --ci --changed --verbose --diff" -- "$cur")) ;;
      esac
      ;;
    scan|top|cost)
      case "$prev" in
        --agent) COMPREPLY=($(compgen -W "$_agents" -- "$cur")) ;;
        *) COMPREPLY=($(compgen -W "--agent --json" -- "$cur")) ;;
      esac
      ;;
    fix)
      case "$prev" in
        --agent) COMPREPLY=($(compgen -W "$_agents" -- "$cur")) ;;
        *) COMPREPLY=($(compgen -W "--agent --dry-run --json" -- "$cur")) ;;
      esac
      ;;
    generate)
      case "$prev" in
        --agent) COMPREPLY=($(compgen -W "$_gen_agents" -- "$cur")) ;;
        *) COMPREPLY=($(compgen -W "--agent --dry-run --force" -- "$cur")) ;;
      esac
      ;;
    init)
      case "$prev" in
        --agent) COMPREPLY=($(compgen -W "$_gen_agents" -- "$cur")) ;;
        *) COMPREPLY=($(compgen -W "--agent --config" -- "$cur")) ;;
      esac
      ;;
    explain)
      if [[ "$prev" == "--json" ]]; then
        COMPREPLY=()
      else
        COMPREPLY=($(compgen -W "$_codes" -- "$cur"))
      fi
      COMPREPLY+=($(compgen -W "--json" -- "$cur"))
      ;;
    completion)
      COMPREPLY=($(compgen -W "$_shells" -- "$cur"))
      ;;
    *)
      COMPREPLY=($(compgen -W "$commands" -- "$cur"))
      ;;
  esac
}

complete -F _ctxscope_completions ctxscope
`;
}

function generateFishCompletion(): string {
  const agents = agentList();
  const genAgents = genAgentList();
  const codes = codeList();

  return `function __fish_ctxscope_using_command
  set -l cmd (commandline -opc)
  if [ (count $cmd) -gt 1 ]
    contains -- $cmd[2] $argv
  end
end

# Commands
complete -c ctxscope -f -a init -d "Create ctxscope.config.json or generate agent instructions"
complete -c ctxscope -f -a scan -d "Discover coding-agent context files"
complete -c ctxscope -f -a doctor -d "Lint coding-agent context files"
complete -c ctxscope -f -a fix -d "Apply safe deterministic context fixes"
complete -c ctxscope -f -a explain -d "Explain a diagnostic code"
complete -c ctxscope -f -a generate -d "Generate deterministic agent instructions"
complete -c ctxscope -f -a top -d "Show largest context files"
complete -c ctxscope -f -a cost -d "Show context token overhead"
complete -c ctxscope -f -a completion -d "Generate shell completion script"

# Global options
complete -c ctxscope -n "not __fish_ctxscope_using_command" -s h -l help -d "Show help message"
complete -c ctxscope -n "not __fish_ctxscope_using_command" -s v -l version -d "Show version"

# doctor
complete -c ctxscope -n "__fish_ctxscope_using_command doctor" -l agent -xa "${agents}" -d "Agent profile"
complete -c ctxscope -n "__fish_ctxscope_using_command doctor" -l json -d "Print JSON output"
complete -c ctxscope -n "__fish_ctxscope_using_command doctor" -l ci -d "Exit 1 on errors"
complete -c ctxscope -n "__fish_ctxscope_using_command doctor" -l changed -d "Only changed context"
complete -c ctxscope -n "__fish_ctxscope_using_command doctor" -l verbose -d "Score breakdown"
complete -c ctxscope -n "__fish_ctxscope_using_command doctor" -l diff -x -d "Diff against base ref"

# scan / top / cost
for cmd in scan top cost
  complete -c ctxscope -n "__fish_ctxscope_using_command $cmd" -l agent -xa "${agents}" -d "Agent profile"
  complete -c ctxscope -n "__fish_ctxscope_using_command $cmd" -l json -d "Print JSON output"
end

# fix
complete -c ctxscope -n "__fish_ctxscope_using_command fix" -l agent -xa "${agents}" -d "Agent profile"
complete -c ctxscope -n "__fish_ctxscope_using_command fix" -l dry-run -d "Show fixes without writing"
complete -c ctxscope -n "__fish_ctxscope_using_command fix" -l json -d "Print JSON output"

# generate
complete -c ctxscope -n "__fish_ctxscope_using_command generate" -l agent -xa "${genAgents}" -d "Agent"
complete -c ctxscope -n "__fish_ctxscope_using_command generate" -l dry-run -d "Preview without writing"
complete -c ctxscope -n "__fish_ctxscope_using_command generate" -l force -d "Overwrite existing files"

# init
complete -c ctxscope -n "__fish_ctxscope_using_command init" -l agent -xa "${genAgents}" -d "Agent"
complete -c ctxscope -n "__fish_ctxscope_using_command init" -l config -d "Create config file only"

# explain
complete -c ctxscope -n "__fish_ctxscope_using_command explain" -l json -d "Print JSON output"
complete -c ctxscope -n "__fish_ctxscope_using_command explain" -xa "${codes}"

# completion
complete -c ctxscope -n "__fish_ctxscope_using_command completion" -xa "zsh bash fish"
`;
}

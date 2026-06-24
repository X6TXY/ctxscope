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
  return "CTX001 CTX002 CTX003 CTX004 CTX005 CTX006 CTX101 CTX102 CTX103 CTX104 CTX105 CTX106";
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _dummy = { agentList, genAgentList, codeList };

function generateZshCompletion(): string {
  return `#compdef ctxscope

_ctxscope() {
  local -a commands
  commands=(
    'scan:Inventory discovered context files'
    'diagnose:Validate context files and score health'
    'fix:Preview or apply deterministic safe fixes'
    'generate:Generate deterministic agent instructions'
    'largest:Show largest context files'
    'tokens:Estimate context token overhead'
    'explain:Explain a diagnostic code'
    'skills:Manage agent skills'
    'init:Create ctxscope.config.json or generate agent instructions'
    'completion:Generate shell completion script'
    'doctor:Alias for diagnose'
    'top:Alias for largest'
    'cost:Alias for tokens'
    'categories:Alias for skills categories'
    'optimize:Alias for skills optimize'
  )

  local -a _agents
  _agents=(${agentList()})

  _arguments -C \
    '(-h --help)'{-h,--help}'[Show help message]' \
    '(-v --version)'{-v,--version}'[Show version]' \
    "1: :{_describe 'command' commands}" \
    '*:: :->args'

  case "$state" in
    args)
      case "$words[1]" in
        doctor|diagnose)
          _arguments \
            '--agent[Agent profile]:agent:($_agents)' \
            '--json[Print JSON output]' \
            '--ci[Exit 1 on errors]' \
            '--changed[Only changed context]' \
            '--verbose[Score breakdown]' \
            '--diff[Diff against base ref]:base ref' \
            '*: :_files'
          ;;
        scan|top|cost|largest|tokens)
          _arguments \
            '--agent[Agent profile]:agent:($_agents)' \
            '--json[Print JSON output]' \
            '*: :_files'
          ;;
        fix)
          _arguments \
            '--agent[Agent profile]:agent:($_agents)' \
            '--dry-run[Show fixes without writing]' \
            '--json[Print JSON output]' \
            '*: :_files'
          ;;
        generate)
          _arguments \
            '--agent[Agent to generate for]:agent:(${genAgentList()})' \
            '--dry-run[Preview without writing]' \
            '--force[Overwrite existing files]' \
            '*: :_files'
          ;;
        init)
          _arguments \
            '--agent[Agent to generate for]:agent:(${genAgentList()})' \
            '--config[Create config file only]'
          ;;
        explain)
          _arguments \
            '--json[Print JSON output]' \
            ':diagnostic code:(${codeList()})'
          ;;
        completion)
          _arguments \
            ':shell:(zsh bash fish)'
          ;;
        skills)
          _arguments \
            '1:skills command:(categories optimize)' \
            '--target[Target agent]:agent:($_agents)' \
            '--vault[Vault directory]:vault directory:_files -/' \
            '--dry-run[Show changes without moving files]' \
            '--undo[Restore skills from vault]' \
            '--noninteractive[Skip category prompt]'
          ;;
        optimize)
          _arguments \
            '--target[Target agent]:agent:($_agents)' \
            '--vault[Vault directory]:vault directory:_files -/' \
            '--dry-run[Show changes without moving files]' \
            '--undo[Restore skills from vault]' \
            '--noninteractive[Skip category prompt]'
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

  local commands="scan diagnose fix generate largest tokens explain skills init completion doctor top cost categories optimize"
  local _agents="${agentList()}"
  local _gen_agents="${genAgentList()}"
  local _codes="${codeList()}"
  local _shells="zsh bash fish"

  if [[ $cword -eq 1 ]]; then
    COMPREPLY=($(compgen -W "$commands" -- "$cur"))
    return
  fi

  case "\${words[1]}" in
    doctor|diagnose)
      case "$prev" in
        --agent) COMPREPLY=($(compgen -W "$_agents" -- "$cur")) ;;
        --diff) COMPREPLY=($(compgen -W "main origin/main HEAD" -- "$cur")) ;;
        *) COMPREPLY=($(compgen -W "--agent --json --ci --changed --verbose --diff" -- "$cur")) ;;
      esac
      ;;
    scan|top|cost|largest|tokens)
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
    skills)
      if [[ $cword -eq 2 ]]; then
        COMPREPLY=($(compgen -W "categories optimize" -- "$cur"))
        return
      fi
      case "$prev" in
        --target) COMPREPLY=($(compgen -W "$_agents" -- "$cur")) ;;
        --vault) COMPREPLY=($(compgen -d -- "$cur")) ;;
        *) COMPREPLY=($(compgen -W "--target --vault --dry-run --undo --noninteractive" -- "$cur")) ;;
      esac
      ;;
    optimize)
      case "$prev" in
        --target) COMPREPLY=($(compgen -W "$_agents" -- "$cur")) ;;
        --vault) COMPREPLY=($(compgen -d -- "$cur")) ;;
        *) COMPREPLY=($(compgen -W "--target --vault --dry-run --undo --noninteractive" -- "$cur")) ;;
      esac
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
complete -c ctxscope -f -a scan -d "Inventory discovered context files"
complete -c ctxscope -f -a diagnose -d "Validate context files and score health"
complete -c ctxscope -f -a fix -d "Preview or apply deterministic safe fixes"
complete -c ctxscope -f -a generate -d "Generate deterministic agent instructions"
complete -c ctxscope -f -a largest -d "Show largest context files"
complete -c ctxscope -f -a tokens -d "Estimate context token overhead"
complete -c ctxscope -f -a explain -d "Explain a diagnostic code"
complete -c ctxscope -f -a skills -d "Manage agent skills"
complete -c ctxscope -f -a init -d "Create ctxscope.config.json or generate agent instructions"
complete -c ctxscope -f -a completion -d "Generate shell completion script"
complete -c ctxscope -f -a doctor -d "Alias for diagnose"
complete -c ctxscope -f -a top -d "Alias for largest"
complete -c ctxscope -f -a cost -d "Alias for tokens"
complete -c ctxscope -f -a categories -d "Alias for skills categories"
complete -c ctxscope -f -a optimize -d "Alias for skills optimize"

# Global options
complete -c ctxscope -n "not __fish_ctxscope_using_command" -s h -l help -d "Show help message"
complete -c ctxscope -n "not __fish_ctxscope_using_command" -s v -l version -d "Show version"

# diagnose / doctor
for cmd in diagnose doctor
  complete -c ctxscope -n "__fish_ctxscope_using_command $cmd" -l agent -xa "${agents}" -d "Agent profile"
  complete -c ctxscope -n "__fish_ctxscope_using_command $cmd" -l json -d "Print JSON output"
  complete -c ctxscope -n "__fish_ctxscope_using_command $cmd" -l ci -d "Exit 1 on errors"
  complete -c ctxscope -n "__fish_ctxscope_using_command $cmd" -l changed -d "Only changed context"
  complete -c ctxscope -n "__fish_ctxscope_using_command $cmd" -l verbose -d "Score breakdown"
  complete -c ctxscope -n "__fish_ctxscope_using_command $cmd" -l diff -x -d "Diff against base ref"
end

# scan / largest / tokens
for cmd in scan top cost largest tokens
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

# skills / optimize alias
complete -c ctxscope -n "__fish_ctxscope_using_command skills" -xa "categories optimize"
for cmd in skills optimize
  complete -c ctxscope -n "__fish_ctxscope_using_command $cmd" -l target -xa "${agents}" -d "Target agent"
  complete -c ctxscope -n "__fish_ctxscope_using_command $cmd" -l vault -r -d "Vault directory"
  complete -c ctxscope -n "__fish_ctxscope_using_command $cmd" -l dry-run -d "Show changes without moving files"
  complete -c ctxscope -n "__fish_ctxscope_using_command $cmd" -l undo -d "Restore skills from vault"
  complete -c ctxscope -n "__fish_ctxscope_using_command $cmd" -l noninteractive -d "Skip category prompt"
end
`;
}

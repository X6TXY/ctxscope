import type { DiagnosticSeverity } from "./types.js";

export type RuleExplanation = {
  code: string;
  title: string;
  severity: DiagnosticSeverity;
  problem: string;
  whyItMatters: string;
  fix: string;
  safeAutofix: boolean;
};

const EXPLANATIONS: Record<string, RuleExplanation> = {
  CTX001: {
    code: "CTX001",
    title: "Oversized context file",
    severity: "warn",
    problem: "A context file exceeds the maximum allowed tokens.",
    whyItMatters: "Large files waste tokens and may cause agents to lose focus or exceed context windows.",
    fix: "Split the file into smaller focused files, or increase maxFileTokens in ctxscope.config.json.",
    safeAutofix: false,
  },
  CTX002: {
    code: "CTX002",
    title: "Duplicate heading across context files",
    severity: "warn",
    problem: "The same heading appears in multiple context files.",
    whyItMatters: "Duplicate headings create confusion and wasted tokens when agents read redundant instructions.",
    fix: "Remove or differentiate duplicate headings so each concept appears once.",
    safeAutofix: false,
  },
  CTX003: {
    code: "CTX003",
    title: "Stale relative markdown link",
    severity: "warn",
    problem: "A relative markdown link points to a file that does not exist.",
    whyItMatters: "Agents following stale links will waste tokens or produce incorrect results.",
    fix: "Update the link to an existing file or remove it.",
    safeAutofix: false,
  },
  CTX004: {
    code: "CTX004",
    title: "Empty context file",
    severity: "warn",
    problem: "A context file is empty.",
    whyItMatters: "Empty files waste discovery time and add no value to agent instructions.",
    fix: "Remove the empty file or populate it with instructions.",
    safeAutofix: false,
  },
  CTX005: {
    code: "CTX005",
    title: "TODO, FIXME, or obsolete marker",
    severity: "warn",
    problem: "A context file contains TODO, FIXME, or OBSOLETE markers.",
    whyItMatters: "Agents may interpret stale markers as current instructions, leading to incorrect behavior.",
    fix: "Remove stale markers or convert them to active instructions.",
    safeAutofix: false,
  },
  CTX006: {
    code: "CTX006",
    title: "Repeated paragraph",
    severity: "warn",
    problem: "A paragraph appears more than once in a context file.",
    whyItMatters: "Repeated text wastes tokens and can confuse agents into prioritizing duplications.",
    fix: "Keep only the first occurrence of the paragraph.",
    safeAutofix: true,
  },
  CTX101: {
    code: "CTX101",
    title: "Conflicting package manager instructions",
    severity: "error",
    problem: "Agent instructions reference multiple package managers (npm, pnpm, yarn, bun).",
    whyItMatters: "Agents may run commands with the wrong package manager, causing build failures or wasted debug time.",
    fix: "Use one package manager consistently in agent instructions.",
    safeAutofix: true,
  },
  CTX102: {
    code: "CTX102",
    title: "Missing package script",
    severity: "error",
    problem: "Agent instructions reference a package.json script that does not exist.",
    whyItMatters: "Agents may attempt to run missing commands, wasting tokens and time.",
    fix: "Update the instruction to an existing script, or add the missing script to package.json.",
    safeAutofix: false,
  },
  CTX105: {
    code: "CTX105",
    title: "Total context budget exceeded",
    severity: "error",
    problem: "The total estimated token count exceeds the configured budget.",
    whyItMatters: "Agents with too much context may lose focus, exceed limits, or incur higher costs.",
    fix: "Remove low-value instructions, deduplicate content, or increase maxTokens in ctxscope.config.json.",
    safeAutofix: false,
  },
};

export function getExplanation(code: string): RuleExplanation | undefined {
  return EXPLANATIONS[code];
}

export function getAllCodes(): string[] {
  return Object.keys(EXPLANATIONS);
}

export function getExplanationOrThrow(code: string): RuleExplanation {
  const explanation = getExplanation(code);
  if (!explanation) {
    throw new Error(`Unknown diagnostic code: ${code}. Expected one of: ${getAllCodes().join(", ")}`);
  }
  return explanation;
}

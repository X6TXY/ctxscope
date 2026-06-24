export const SUPPORTED_AGENTS = ["all", "codex", "opencode", "claude", "generic"] as const;

export type Agent = (typeof SUPPORTED_AGENTS)[number];
export type ConcreteAgent = Exclude<Agent, "all">;

export type ContextFile = {
  path: string;
  agents: ConcreteAgent[];
  tokens: number;
  skippedBinary: boolean;
};

export type RuleSeverity = "off" | "warn" | "error";

export type DiagnosticSeverity = Exclude<RuleSeverity, "off">;

export type DiagnosticFix = {
  title: string;
  kind: "replace" | "delete";
  safe: boolean;
};

export type Diagnostic = {
  code: "CTX001" | "CTX002" | "CTX003" | "CTX004" | "CTX005" | "CTX006" | "CTX105" | "CTX106" | string;
  severity: DiagnosticSeverity;
  path: string;
  message: string;
  line?: number;
  column?: number;
  recommendation?: string;
  fix?: DiagnosticFix;
};

export type ContextScore = {
  overall: number;
  correctness: number;
  freshness: number;
  efficiency: number;
  consistency: number;
  coverage: number;
};

export type ScorePenalty = {
  code: string;
  count: number;
  deduction: number;
  message: string;
};

export type ScoreBreakdown = Record<Exclude<keyof ContextScore, "overall">, {
  score: number;
  penalties: ScorePenalty[];
}>;

export type CtxscopeConfig = {
  maxTokens: number;
  maxFileTokens: number;
  ignore: string[];
  rules: Record<string, RuleSeverity>;
};

export type ScanResult = {
  agent: Agent;
  target: string;
  files: ContextFile[];
  totalTokens: number;
  warnings: Diagnostic[];
};

export type DoctorResult = {
  agent: Agent;
  target: string;
  status: "pass" | "fail";
  summary: {
    files: number;
    totalTokens: number;
    warnings: number;
    errors: number;
  };
  score: ContextScore;
  scoreBreakdown: ScoreBreakdown;
  files: ContextFile[];
  diagnostics: Diagnostic[];
};

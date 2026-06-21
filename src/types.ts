export const SUPPORTED_AGENTS = ["all", "codex", "opencode", "claude", "generic"] as const;

export type Agent = (typeof SUPPORTED_AGENTS)[number];
export type ConcreteAgent = Exclude<Agent, "all">;

export type ContextFile = {
  path: string;
  agents: ConcreteAgent[];
  tokens: number;
  skippedBinary: boolean;
};

export type Warning = {
  code: "CTX001" | "CTX002" | "CTX003" | "CTX004" | "CTX005" | "CTX006";
  severity: "warn";
  path: string;
  message: string;
};

export type ScanResult = {
  agent: Agent;
  target: string;
  files: ContextFile[];
  totalTokens: number;
  warnings: Warning[];
};

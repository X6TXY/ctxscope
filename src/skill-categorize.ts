import type { Agent } from "./types.js";

const DOMAIN_HEURISTICS: Record<string, string[]> = {
  security: [
    "attack", "injection", "vulnerability", "xss", "penetration",
    "privilege", "fuzzing", "auth", "jwt", "oauth",
    "bypass", "malware", "forensics", "hacker", "security",
    "exploit", "encryption", "wireshark", "nmap",
  ],
  "code-review": [
    "code-review", "code review", "codereview",
    "requesting-code-review", "code-review-excellence",
    "pr-review", "review-agent", "reviewer", "review-bot",
    "static-analysis", "quality-gate", "sonarqube",
  ],
  git: [
    "git", "github", "gitlab",
    "pull-request", "merge-request", "commit",
    "branch", "rebase", "cherry-pick", "stash",
    "tag", "release", "conventional-commits",
  ],
  "ai-ml": [
    "ai-", "ml-", "llm", "agent", "gpt",
    "claude", "gemini", "openai", "anthropic",
    "prompt", "rag", "diffusion", "huggingface",
    "pytorch", "tensorflow", "comfy", "flux",
    "machine-learning", "deep-learning", "vision", "nlp",
  ],
  "web-dev": [
    "angular", "react", "vue", "tailwind",
    "frontend", "css", "html", "nextjs",
    "svelte", "astro",
    "ui-patterns", "vercel", "shopify",
    "styles", "sass", "less", "bootstrap",
  ],
  "backend-dev": [
    "api", "nestjs", "express", "django", "flask",
    "fastapi", "spring", "laravel", "node",
    "graphql", "rest", "grpc",
    "backend", "server", "microservice", "go-", "rust-",
  ],
  devops: [
    "aws", "azure", "docker", "kubernetes",
    "ci-cd", "terraform", "ansible",
    "github-actions", "gitlab", "jenkins",
    "devops", "cloud", "linux", "ubuntu",
    "k8s", "bash", "deploy", "nginx",
  ],
  database: [
    "sql", "mysql", "postgres", "mongo",
    "redis", "database", "schema",
    "prisma", "orm", "nosql",
    "supabase", "neon", "db-", "sqlite",
  ],
  design: [
    "ui", "ux", "design", "figma",
    "avatar", "background-removal", "svg",
    "animation", "motion", "framer",
    "photoshop", "illustrator", "creative",
  ],
  automation: [
    "automation", "zapier", "make", "n8n",
    "selenium", "playwright", "puppeteer",
    "bot", "workflow", "scraper", "cron",
  ],
  mobile: [
    "ios", "android", "react-native", "flutter",
    "swift", "kotlin", "mobile", "xcode", "mobile-",
  ],
  "game-dev": [
    "game", "unity", "unreal", "godot",
    "phaser", "3d", "vr", "ar",
    "raylib", "pygame",
  ],
  business: [
    "business", "founder", "sales", "marketing",
    "seo", "growth", "product", "agile",
    "scrum", "jira", "b2b", "crm",
  ],
  writing: [
    "writing", "copywriting", "blog",
    "documentation", "readme", "study",
    "teardown", "content", "journalism",
  ],
  "3d-graphics": [
    "blender", "threejs", "webgl",
    "rendering", "3d-", "mesh", "texture", "shader",
  ],
  aerospace: [
    "satellite", "orbit", "space",
    "aerodynamics", "avionic", "spacecraft",
  ],
  agents: [
    "multi-agent", "swarm", "autonomous",
    "orchestration", "chain", "autogen", "crewai",
  ],
  animation: [
    "gsap", "lottie", "keyframe", "transition", "tween", "rigging",
  ],
  architecture: [
    "pattern", "clean-code", "system-design",
    "solid-", "ddd", "architect",
  ],
  biomedical: [
    "dna", "protein", "medical", "health", "genomics", "bioinfo", "clinical",
  ],
  blockchain: [
    "crypto", "web3", "solidity", "smart-contract",
    "ethereum", "bitcoin", "nft", "staking",
  ],
  compliance: [
    "gdpr", "hipaa", "soc2", "audit", "policy", "legal", "privacy",
  ],
  "data-science": [
    "pandas", "numpy", "matplotlib", "scikit",
    "jupyter", "visualization", "data-", "etl",
  ],
  education: [
    "learning", "course", "tutor", "student",
    "curriculum", "teaching", "university",
  ],
  finance: [
    "trading", "stock", "portfolio", "banking",
    "ledger", "investment", "fintech",
  ],
  marketing: [
    "ads", "campaign", "social-media", "brand",
    "analytics", "funnel", "email-marketing",
  ],
  mcp: [
    "mcp-", "model-context-protocol", "server-", "client-",
  ],
  "media-production": [
    "video", "audio", "podcast", "editing",
    "streaming", "ffmpeg", "obs",
  ],
  programming: [
    "python", "javascript", "typescript",
    "java", "cpp", "ruby", "php", "csharp",
    "swift", "kotlin",
    "algorithm", "data-structure",
  ],
  "prompt-engineering": [
    "system-prompt", "few-shot", "chain-of-thought",
    "prompt-", "meta-prompt",
  ],
  quantum: [
    "qubit", "qiskit", "quantum-", "superposition", "entanglement",
  ],
  robotics: [
    "ros", "arduino", "raspberry", "hardware",
    "sensor", "firmware", "robot",
  ],
  simulation: [
    "physics", "modeling", "sim-", "digital-twin", "solver",
  ],
  testing: [
    "test-", "unit-test", "jest", "pytest", "cypress", "quality", "qa-",
  ],
  tooling: [
    "cli", "prettier", "eslint", "bundler",
    "npm", "pip", "extension", "plugin",
  ],
};

export function categorizeSkill(skillName: string): string {
  const hasPrTerm = /pr-review|pull-request|merge-request/.test(skillName);
  if (/review/.test(skillName) && hasPrTerm) {
    return "code-review";
  }

  const name = `-${skillName.toLowerCase().replace(/_/g, "-")}-`;

  for (const [category, keywords] of Object.entries(DOMAIN_HEURISTICS)) {
    for (const kw of keywords) {
      const wrapped = kw.startsWith("-") || kw.endsWith("-") ? kw : `-${kw}-`;
      if (name.includes(wrapped)) {
        return category;
      }
    }
  }

  return "other";
}

export function getAllCategories(): string[] {
  return [
    ...Object.keys(DOMAIN_HEURISTICS),
    "other",
  ];
}

function getProjectLocalDirs(agent: Agent, cwd: string): string[] {
  switch (agent) {
    case "claude":
      return [`${cwd}/.claude/skills`];
    case "opencode":
      return [`${cwd}/.opencode/skills`];
    case "codex":
      return [`${cwd}/.codex/skills`];
    case "all":
      return [
        `${cwd}/.agents/skills`,
        `${cwd}/.claude/skills`,
        `${cwd}/.opencode/skills`,
        `${cwd}/.cursor/skills`,
      ];
    default:
      return [`${cwd}/.agents/skills`];
  }
}

function getGlobalDirs(agent: Agent): string[] {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
  switch (agent) {
    case "claude":
      return [`${home}/.claude/skills`];
    case "opencode":
      return [`${home}/.config/opencode/skills`];
    case "codex":
      return [`${home}/.codex/skills`];
    case "all":
      return [
        `${home}/.claude/skills`,
        `${home}/.config/opencode/skills`,
        `${home}/.codex/skills`,
      ];
    default:
      return [];
  }
}

export function getAgentSkillDirs(agent: Agent, cwd?: string): string[] {
  const globalDirs = getGlobalDirs(agent);
  const projectDirs = cwd ? getProjectLocalDirs(agent, cwd) : [];
  return [...globalDirs, ...projectDirs];
}

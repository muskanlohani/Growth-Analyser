export const CAREER_GOALS = [
  "Full-Stack Developer",
  "Frontend Developer",
  "Backend Developer",
  "AI/ML Engineer",
  "Data Analyst",
  "Data Scientist",
  "Software Developer",
  "Cybersecurity",
  "DevOps/Cloud",
] as const;

export type CareerGoal = (typeof CAREER_GOALS)[number];

export const CAREER_SKILLS: Record<CareerGoal, string[]> = {
  "Full-Stack Developer": ["JavaScript", "React", "Node.js", "SQL", "HTML", "CSS", "Git", "TypeScript"],
  "Frontend Developer": ["JavaScript", "React", "HTML", "CSS", "TypeScript", "Git"],
  "Backend Developer": ["Python", "Java", "Node.js", "SQL", "Go", "Git"],
  "AI/ML Engineer": ["Python", "Machine Learning", "Jupyter Notebook", "SQL", "Git"],
  "Data Analyst": ["Python", "SQL", "Jupyter Notebook", "Git"],
  "Data Scientist": ["Python", "Machine Learning", "SQL", "Jupyter Notebook", "Git"],
  "Software Developer": ["Java", "C++", "Python", "Git", "SQL"],
  Cybersecurity: ["Python", "Bash", "Linux", "Git"],
  "DevOps/Cloud": ["Docker", "Kubernetes", "Bash", "Python", "CI/CD", "Git"],
};

const SKILL_KEYWORDS: Record<string, string[]> = {
  JavaScript: ["javascript", "js", "nodejs"],
  TypeScript: ["typescript", "ts"],
  React: ["react", "reactjs", "react-native", "next.js", "nextjs"],
  "Node.js": ["node", "nodejs", "express", "expressjs"],
  Python: ["python", "django", "flask", "fastapi"],
  SQL: ["sql", "mysql", "postgres", "postgresql", "sqlite", "plpgsql"],
  HTML: ["html", "html5"],
  CSS: ["css", "css3", "tailwind", "tailwindcss", "sass", "scss"],
  Java: ["java", "spring", "springboot", "spring-boot"],
  "C++": ["c++", "cpp"],
  Go: ["golang"],
  Docker: ["docker", "dockerfile", "docker-compose", "container", "containers"],
  Kubernetes: ["kubernetes", "k8s", "helm"],
  "Machine Learning": [
    "machine-learning",
    "machine learning",
    "deep learning",
    "deep-learning",
    "tensorflow",
    "pytorch",
    "keras",
    "scikit",
    "sklearn",
    "ml",
    "neural",
  ],
  "Jupyter Notebook": ["jupyter", "notebook", "ipynb"],
  Bash: ["bash", "shell script", "shell-script", "shell"],
  Linux: ["linux", "ubuntu", "debian"],
  "CI/CD": ["ci/cd", "github-actions", "github actions", "cicd", "jenkins", "pipeline", "gitlab-ci"],
};

/** GitHub's `language` field doesn't always match our skill names. */
const LANGUAGE_ALIASES: Record<string, string> = {
  shell: "Bash",
  dockerfile: "Docker",
  tsql: "SQL",
  plpgsql: "SQL",
  "jupyter notebook": "Jupyter Notebook",
  "c++": "C++",
};

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

/**
 * Whole-word matching. The previous plain `includes()` made "java" match
 * "javascript", so every JavaScript repo inflated the Java score. Written
 * without lookbehind so it parses in older Safari versions.
 */
const KEYWORD_PATTERNS: Record<string, RegExp[]> = Object.fromEntries(
  Object.entries(SKILL_KEYWORDS).map(([skill, kws]) => [
    skill,
    kws.map((k) => new RegExp(`(^|[^a-z0-9])${escapeRegex(k)}($|[^a-z0-9])`, "i")),
  ])
);

export interface RepoLite {
  name: string;
  language: string | null;
  description: string | null;
  topics?: string[];
  pushed_at: string;
  updated_at?: string;
  created_at?: string;
  stargazers_count?: number;
  forks_count?: number;
  watchers_count?: number;
  open_issues_count?: number;
  size?: number;
  fork?: boolean;
  archived?: boolean;
  homepage?: string | null;
  html_url?: string;
  license?: { spdx_id?: string | null; name?: string | null } | null;
}

export type SkillLevel = "Strong" | "Intermediate" | "Developing" | "Beginner" | "No evidence";

export function levelFromScore(score: number): SkillLevel {
  if (score >= 75) return "Strong";
  if (score >= 50) return "Intermediate";
  if (score >= 25) return "Developing";
  if (score > 0) return "Beginner";
  return "No evidence";
}

export interface SkillEvidence {
  /** repositories that showed this skill (forks included) */
  repos: number;
  /** most recent push to a repository showing this skill */
  lastUsed: string | null;
}

/** Forked repositories mostly contain someone else's code, so they count for less. */
const FORK_WEIGHT = 0.35;

export function computeSkills(repos: RepoLite[]) {
  const now = Date.now();
  const scores: Record<string, number> = {};
  const evidence: Record<string, SkillEvidence> = {};
  const bump = (skill: string, amount: number, pushed: string | undefined) => {
    scores[skill] = Math.min(100, (scores[skill] || 0) + amount);
    const e = (evidence[skill] ||= { repos: 0, lastUsed: null });
    e.repos += 1;
    if (pushed && (!e.lastUsed || new Date(pushed) > new Date(e.lastUsed))) e.lastUsed = pushed;
  };

  repos.forEach((repo) => {
    const dateStr = repo.pushed_at || repo.updated_at;
    const monthsOld = dateStr ? (now - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24 * 30) : 99;
    const recencyBonus = monthsOld <= 6 ? 8 : monthsOld <= 18 ? 4 : 1;
    const starBonus = Math.min(6, (repo.stargazers_count || 0) * 1.5);
    const weight = repo.fork ? FORK_WEIGHT : 1;
    const haystack = [repo.language || "", repo.name || "", repo.description || "", ...(repo.topics || [])]
      .join(" ")
      .toLowerCase();
    const lang = (repo.language || "").toLowerCase();
    const aliased = LANGUAGE_ALIASES[lang];

    Object.keys(SKILL_KEYWORDS).forEach((skill) => {
      const langMatch = (!!lang && lang === skill.toLowerCase()) || aliased === skill;
      const kwMatch = KEYWORD_PATTERNS[skill].some((re) => re.test(haystack));
      if (langMatch || kwMatch) bump(skill, (16 + recencyBonus + starBonus) * weight, dateStr);
    });
  });

  const ownCount = repos.filter((r) => !r.fork).length;
  scores["Git"] = repos.length > 0 ? Math.min(100, 55 + ownCount * 2 + (repos.length - ownCount)) : 0;
  if (repos.length > 0) {
    const newest = repos.reduce((a, r) => (new Date(r.pushed_at) > new Date(a) ? r.pushed_at : a), repos[0].pushed_at);
    evidence["Git"] = { repos: repos.length, lastUsed: newest };
  }

  const skillList = Object.entries(scores)
    .map(([skill, score]) => ({ skill, score: Math.round(score), level: levelFromScore(score) }))
    .sort((a, b) => b.score - a.score);

  return { scores, skillList, evidence };
}

export interface SkillRow {
  skill: string;
  score: number;
  level: SkillLevel;
  repos: number;
  lastUsed: string | null;
}

export function categorize(scores: Record<string, number>, goal: CareerGoal, evidence: Record<string, SkillEvidence> = {}) {
  const goalSkills = CAREER_SKILLS[goal] || [];
  const rows: SkillRow[] = goalSkills.map((skill) => {
    const score = Math.round(scores[skill] || 0);
    return {
      skill,
      score,
      level: levelFromScore(score),
      repos: evidence[skill]?.repos || 0,
      lastUsed: evidence[skill]?.lastUsed || null,
    };
  });

  const strong = rows.filter((r) => r.level === "Strong" || r.level === "Intermediate");
  const developing = rows.filter((r) => r.level === "Developing");
  const gaps = rows.filter((r) => r.level === "Beginner" || r.level === "No evidence");

  const learnNow = gaps.slice(0, 3);
  const learnNext = [...gaps.slice(3), ...developing];
  const pause = strong;

  const growthScore = rows.length ? Math.round(rows.reduce((sum, r) => sum + r.score, 0) / rows.length) : 0;
  const coverage = rows.length ? Math.round(((strong.length + developing.length) / rows.length) * 100) : 0;

  return { rows, strong, developing, gaps, learnNow, learnNext, pause, growthScore, coverage };
}

export interface RoleFit {
  goal: CareerGoal;
  score: number;
  strong: number;
  total: number;
}

/** Growth score for every career goal, best fit first. */
export function computeRoleFits(scores: Record<string, number>): RoleFit[] {
  return CAREER_GOALS.map((goal) => {
    const rows = CAREER_SKILLS[goal];
    const sum = rows.reduce((s, sk) => s + Math.round(scores[sk] || 0), 0);
    const strong = rows.filter((sk) => levelFromScore(scores[sk] || 0) === "Strong" || levelFromScore(scores[sk] || 0) === "Intermediate").length;
    return { goal, score: rows.length ? Math.round(sum / rows.length) : 0, strong, total: rows.length };
  }).sort((a, b) => b.score - a.score);
}

export function buildRoadmap(goal: CareerGoal, scores: Record<string, number>) {
  const skills = CAREER_SKILLS[goal] || [];
  const known = (s: string) => levelFromScore(scores[s] || 0);
  const third = Math.ceil(skills.length / 3) || 1;
  const phases = [
    { title: "Foundation", items: skills.slice(0, third) },
    { title: "Development", items: skills.slice(third, third * 2) },
    {
      title: "Projects & portfolio",
      items: [...skills.slice(third * 2), "Build & deploy a project", "Improve GitHub portfolio"],
    },
  ];
  return phases.map((phase) => ({
    ...phase,
    items: phase.items.map((item) => ({
      label: item,
      done: CAREER_SKILLS[goal]?.includes(item) ? known(item) === "Strong" || known(item) === "Intermediate" : false,
    })),
  }));
}

export function extractUsername(input: string): string {
  let v = input.trim();
  const urlMatch = v.match(/github\.com\/([A-Za-z0-9-]+)/i);
  if (urlMatch) return urlMatch[1];
  v = v.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/^github\.com\//i, "").replace(/^@/, "");
  return v.replace(/\/+$/, "");
}

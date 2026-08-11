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
  JavaScript: ["javascript"],
  TypeScript: ["typescript"],
  React: ["react"],
  "Node.js": ["node", "express", "nodejs"],
  Python: ["python"],
  SQL: ["sql", "mysql", "postgres", "postgresql", "sqlite"],
  HTML: ["html"],
  CSS: ["css", "tailwind", "sass", "scss"],
  Java: ["java"],
  "C++": ["c++", "cpp"],
  Go: ["golang", " go "],
  Docker: ["docker", "container"],
  Kubernetes: ["kubernetes", "k8s"],
  "Machine Learning": ["machine-learning", "machine learning", "tensorflow", "pytorch", "scikit", "sklearn", "ml "],
  "Jupyter Notebook": ["jupyter", "notebook"],
  Bash: ["bash", "shell script", "shell-script"],
  Linux: ["linux"],
  "CI/CD": ["ci/cd", "github-actions", "github actions", "cicd", "jenkins", "pipeline"],
};

export interface RepoLite {
  name: string;
  language: string | null;
  description: string | null;
  topics?: string[];
  pushed_at: string;
  updated_at?: string;
  stargazers_count?: number;
}

export type SkillLevel = "Strong" | "Intermediate" | "Developing" | "Beginner" | "No evidence";

export function levelFromScore(score: number): SkillLevel {
  if (score >= 75) return "Strong";
  if (score >= 50) return "Intermediate";
  if (score >= 25) return "Developing";
  if (score > 0) return "Beginner";
  return "No evidence";
}

export function computeSkills(repos: RepoLite[]) {
  const now = Date.now();
  const scores: Record<string, number> = {};
  const bump = (skill: string, amount: number) => {
    scores[skill] = Math.min(100, (scores[skill] || 0) + amount);
  };

  repos.forEach((repo) => {
    const dateStr = repo.pushed_at || repo.updated_at;
    const monthsOld = dateStr ? (now - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24 * 30) : 99;
    const recencyBonus = monthsOld <= 6 ? 8 : monthsOld <= 18 ? 4 : 1;
    const starBonus = Math.min(6, (repo.stargazers_count || 0) * 1.5);
    const haystack = [repo.language || "", repo.name || "", repo.description || "", ...(repo.topics || [])]
      .join(" ")
      .toLowerCase();

    Object.entries(SKILL_KEYWORDS).forEach(([skill, keywords]) => {
      const langMatch = !!repo.language && repo.language.toLowerCase() === skill.toLowerCase();
      const kwMatch = keywords.some((k) => haystack.includes(k));
      if (langMatch || kwMatch) bump(skill, 16 + recencyBonus + starBonus);
    });
  });

  scores["Git"] = repos.length > 0 ? Math.min(100, 55 + repos.length * 2) : 0;

  const skillList = Object.entries(scores)
    .map(([skill, score]) => ({ skill, score: Math.round(score), level: levelFromScore(score) }))
    .sort((a, b) => b.score - a.score);

  return { scores, skillList };
}

export interface SkillRow {
  skill: string;
  score: number;
  level: SkillLevel;
}

export function categorize(scores: Record<string, number>, goal: CareerGoal) {
  const goalSkills = CAREER_SKILLS[goal] || [];
  const rows: SkillRow[] = goalSkills.map((skill) => {
    const score = Math.round(scores[skill] || 0);
    return { skill, score, level: levelFromScore(score) };
  });

  const strong = rows.filter((r) => r.level === "Strong" || r.level === "Intermediate");
  const developing = rows.filter((r) => r.level === "Developing");
  const gaps = rows.filter((r) => r.level === "Beginner" || r.level === "No evidence");

  const learnNow = gaps.slice(0, 3);
  const learnNext = [...gaps.slice(3), ...developing];
  const pause = strong;

  const growthScore = rows.length ? Math.round(rows.reduce((sum, r) => sum + r.score, 0) / rows.length) : 0;

  return { rows, strong, developing, gaps, learnNow, learnNext, pause, growthScore };
}

export function buildRoadmap(goal: CareerGoal, scores: Record<string, number>) {
  const skills = CAREER_SKILLS[goal] || [];
  const known = (s: string) => levelFromScore(scores[s] || 0);
  const third = Math.ceil(skills.length / 3) || 1;
  const phases = [
    { title: "Phase 1 — Foundation", items: skills.slice(0, third) },
    { title: "Phase 2 — Development", items: skills.slice(third, third * 2) },
    {
      title: "Phase 3 — Projects & Portfolio",
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
  v = v.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/^github\.com\//i, "");
  return v.replace(/\/+$/, "");
}

import type { CareerGoal, RoleFit, SkillRow } from "./analysis";
import type { ProfileStats } from "./stats";
import type { AiRecommendation, Insights, Priority } from "./types";

interface AnalysisLike {
  rows: SkillRow[];
  strong: SkillRow[];
  developing: SkillRow[];
  gaps: SkillRow[];
  learnNow: SkillRow[];
  growthScore: number;
}

const PRIORITY_ORDER: Record<Priority, number> = { High: 0, Medium: 1, Low: 2 };

export function sortRecommendations(list: AiRecommendation[]): AiRecommendation[] {
  return [...list].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
}

/**
 * Plain, data-driven findings. They are used in two places:
 *  1. sent to Gemini as "signals" so its advice is grounded in the numbers
 *  2. shown directly when the AI call is unavailable
 */
export function buildFallbackInsights(
  stats: ProfileStats,
  an: AnalysisLike,
  goal: CareerGoal,
  fits: RoleFit[]
): Insights {
  const recs: AiRecommendation[] = [];
  const add = (r: AiRecommendation) => recs.push(r);

  an.learnNow.forEach((s) =>
    add({
      title: `Build something with ${s.skill}`,
      detail: s.repos
        ? `${s.skill} shows up in only ${s.repos} repo${s.repos === 1 ? "" : "s"} so far, and ${goal} roles expect it. A small, finished project will move this faster than a course.`
        : `There's no ${s.skill} in your public repos yet, and ${goal} roles expect it. Start with one small project and push it publicly.`,
      priority: "High",
      category: "Skills",
    })
  );

  an.developing.slice(0, 2).forEach((s) =>
    add({
      title: `Go deeper in ${s.skill}`,
      detail: `${s.skill} scores ${s.score}/100 across ${s.repos} repo${s.repos === 1 ? "" : "s"}, so it's started but not yet convincing. Extend an existing project with a harder ${s.skill} feature rather than starting from scratch.`,
      priority: "Medium",
      category: "Skills",
    })
  );

  if (stats.daysSinceLastPush == null || stats.daysSinceLastPush > 90 || stats.last90 === 0) {
    add({
      title: "Restart a regular pushing habit",
      detail:
        stats.daysSinceLastPush == null
          ? "No repositories were found to measure activity. Publish one project to start."
          : `Your most recent push was ${stats.daysSinceLastPush} days ago. Recruiters read recency as momentum — aim for at least one push a week, even small ones.`,
      priority: "High",
      category: "Consistency",
    });
  } else if (stats.activeMonths < 6) {
    add({
      title: "Spread your work across more months",
      detail: `You were active in ${stats.activeMonths} of the last 12 months. Short, regular sessions beat occasional bursts.`,
      priority: "Medium",
      category: "Consistency",
    });
  }

  if (stats.pctDescribed < 60 && stats.ownRepos > 0) {
    add({
      title: "Describe every repository",
      detail: `Only ${stats.pctDescribed}% of your repos have a real description. One clear sentence on what it does and which stack it uses makes each repo skimmable.`,
      priority: stats.pctDescribed < 30 ? "High" : "Medium",
      category: "Portfolio",
    });
  }
  if (stats.pctTopics < 40 && stats.ownRepos > 0) {
    add({
      title: "Add topics to your repos",
      detail: `${100 - stats.pctTopics}% of your repos have no topics. Topics help people find your work and make your skills visible at a glance.`,
      priority: "Low",
      category: "Portfolio",
    });
  }
  if (stats.pctLiveDemo < 20 && stats.ownRepos >= 3) {
    add({
      title: "Deploy a live demo of your best project",
      detail: "Almost none of your repos link to a running demo. A hosted link lets someone judge your work in ten seconds.",
      priority: "Medium",
      category: "Portfolio",
    });
  }
  if (stats.pctLicensed < 30 && stats.ownRepos >= 3) {
    add({
      title: "Add a license to projects you want others to use",
      detail: `${stats.pctLicensed}% of your repos have a license. MIT is a quick default for portfolio work.`,
      priority: "Low",
      category: "Portfolio",
    });
  }
  if (stats.stars < 5 && stats.ownRepos >= 3) {
    add({
      title: "Polish and pin your three best repos",
      detail: "Your repos have few stars yet. A clear README with a screenshot, setup steps and a pinned slot on your profile is the cheapest way to earn attention.",
      priority: "Medium",
      category: "Portfolio",
    });
  }
  if (stats.forkedRepos > stats.ownRepos && stats.forkedRepos > 2) {
    add({
      title: "Add more original work",
      detail: `${stats.forkedRepos} of your ${stats.totalRepos} repos are forks. Forks don't show what you can build — create or substantially extend a few projects of your own.`,
      priority: "High",
      category: "Projects",
    });
  }
  if (stats.staleRepos >= 5 && stats.staleRepos / Math.max(1, stats.ownRepos) > 0.5) {
    add({
      title: "Tidy up old repositories",
      detail: `${stats.staleRepos} repos haven't been touched in over a year. Archive the experiments and pin the work you're proud of so your profile reads as current.`,
      priority: "Low",
      category: "Portfolio",
    });
  }
  if (stats.languageCount <= 2 && stats.ownRepos >= 4) {
    add({
      title: "Broaden your toolkit",
      detail: `Your repos use ${stats.languageCount || "no detectable"} language${stats.languageCount === 1 ? "" : "s"}. Adding one complementary language or framework widens the roles you can credibly apply for.`,
      priority: "Low",
      category: "Skills",
    });
  }
  if (stats.events && stats.events.total >= 10 && stats.events.collaboration < 3) {
    add({
      title: "Collaborate in the open",
      detail: "Your recent public activity is almost all solo pushes. Open a pull request or review one on a project you use — it's strong evidence of teamwork.",
      priority: "Medium",
      category: "Collaboration",
    });
  }

  const best = fits[0];
  const target = fits.find((f) => f.goal === goal);
  if (best && target && best.goal !== goal && best.score - target.score >= 10) {
    add({
      title: `Compare with ${best.goal}`,
      detail: `Your profile matches ${best.goal} at ${best.score}% against ${target.score}% for ${goal}. If you're flexible, that role is the quicker win — otherwise use it to see which strengths carry over.`,
      priority: "Low",
      category: "Career",
    });
  }

  const sorted = sortRecommendations(recs).slice(0, 7);

  const strengths: string[] = [];
  an.strong.slice(0, 3).forEach((s) => strengths.push(`${s.skill} is a clear strength (${s.score}/100 across ${s.repos} repos).`));
  if (stats.activeMonths >= 8) strengths.push(`Steady activity: pushes in ${stats.activeMonths} of the last 12 months.`);
  if (stats.stars >= 10) strengths.push(`Your work gets noticed: ${stats.stars} stars across your repos.`);
  if (stats.languageCount >= 4) strengths.push(`Good range: ${stats.languageCount} languages in use.`);
  if (stats.pctDescribed >= 75 && stats.ownRepos >= 3) strengths.push("Repos are well described and easy to scan.");
  if (!strengths.length) strengths.push("You have a public profile to build on — every repo you add improves the picture.");

  const quickWins: string[] = [];
  if (stats.pctDescribed < 100 && stats.ownRepos > 0) quickWins.push("Add a one-line description to every repo that lacks one.");
  quickWins.push("Pin your three strongest repositories on your profile.");
  quickWins.push("Create a profile README that states what you're learning and building.");
  if (an.learnNow[0]) quickWins.push(`Start a tiny ${an.learnNow[0].skill} project this week and push the first commit.`);

  const topNames = an.strong.slice(0, 2).map((s) => s.skill);
  const gapNames = an.learnNow.map((s) => s.skill);
  const devNames = an.developing.map((s) => s.skill);
  const summary =
    `Your public GitHub scores ${an.growthScore}/100 toward ${goal}, with portfolio health at ${stats.health}/100 (${stats.healthLabel.toLowerCase()}). ` +
    (topNames.length ? `Strongest evidence: ${topNames.join(" and ")}. ` : "There's little evidence for the core skills yet. ") +
    (gapNames.length
      ? `The clearest next moves are ${gapNames.join(", ")}.`
      : devNames.length
        ? `No skill is missing outright; the next step is to deepen ${devNames.join(", ")}.`
        : "You've covered the core skills, so focus on depth and showcasing your best work.");

  const project = an.learnNow[0]
    ? {
        title: `${an.strong[0]?.skill ?? "Your best skill"} + ${an.learnNow[0].skill} mini project`,
        why: `Pairing something you already do well with ${an.learnNow[0].skill} closes your biggest gap while building on solid ground.`,
        skills: [an.strong[0]?.skill, an.learnNow[0].skill].filter(Boolean) as string[],
        difficulty: (an.growthScore >= 55 ? "Intermediate" : "Beginner") as "Beginner" | "Intermediate",
        outcome: `A deployed project with a README that proves ${an.learnNow[0].skill}.`,
        milestones: ["Sketch the idea and list three features", "Build the smallest working version", "Deploy it and add a README with a screenshot"],
      }
    : null;

  return {
    headline: `${stats.healthLabel} portfolio, ${an.growthScore}% of the way to ${goal}`,
    summary,
    strengths: strengths.slice(0, 5),
    recommendations: sorted,
    recommendationSummary:
      sorted.length > 0
        ? `Focus first on ${sorted
            .filter((r) => r.priority === "High")
            .slice(0, 2)
            .map((r) => r.title.toLowerCase())
            .join(" and ") || sorted[0].title.toLowerCase()}, then work through the lower-priority portfolio fixes.`
        : "Keep shipping and polishing — nothing urgent stands out.",
    quickWins: quickWins.slice(0, 4),
    learnNowReasons: Object.fromEntries(
      an.learnNow.map((s) => [
        s.skill,
        s.repos ? `Only ${s.repos} repo${s.repos === 1 ? "" : "s"} touch ${s.skill}, scoring ${s.score}/100.` : `No ${s.skill} found in your public repos.`,
      ])
    ),
    project,
  };
}

/** Compact, size-bounded payload for /api/explain. */
export function buildAiPayload(args: {
  username: string;
  goal: CareerGoal;
  stats: ProfileStats;
  an: AnalysisLike;
  fits: RoleFit[];
  extraSkills: { skill: string; score: number }[];
  repos: { name: string; language: string | null; description: string | null; stars: number }[];
  signals: string[];
}) {
  const { stats, an } = args;
  return {
    username: args.username,
    careerGoal: args.goal,
    growthScore: an.growthScore,
    portfolioHealth: { overall: stats.health, label: stats.healthLabel, dimensions: stats.dimensions.map((d) => ({ name: d.label, score: d.score, note: d.detail })) },
    skills: an.rows.map((r) => ({ skill: r.skill, score: r.score, level: r.level, repos: r.repos, lastUsed: r.lastUsed ? r.lastUsed.slice(0, 10) : null })),
    learnNow: an.learnNow.map((r) => r.skill),
    otherSkillsDetected: args.extraSkills.slice(0, 6),
    roleFits: args.fits.slice(0, 5).map((f) => ({ role: f.goal, score: f.score })),
    github: {
      ownRepos: stats.ownRepos,
      forkedRepos: stats.forkedRepos,
      stars: stats.stars,
      forksReceived: stats.forksReceived,
      followers: stats.followers,
      accountAgeYears: stats.accountAgeYears,
      languages: stats.languages.slice(0, 6).map((l) => ({ name: l.name, pct: l.pct })),
      pushedLast30Days: stats.last30,
      pushedLast90Days: stats.last90,
      activeMonthsOfLast12: stats.activeMonths,
      longestStreakMonths: stats.longestStreak,
      staleReposOverOneYear: stats.staleRepos,
      pctWithDescription: stats.pctDescribed,
      pctWithTopics: stats.pctTopics,
      pctWithLicense: stats.pctLicensed,
      pctWithLiveDemo: stats.pctLiveDemo,
      recentEvents: stats.events ? { total: stats.events.total, mix: stats.events.byGroup.slice(0, 5) } : null,
    },
    topRepos: args.repos.slice(0, 6),
    signals: args.signals.slice(0, 8),
  };
}

/** Markdown report for the "Download report" button. */
export function buildReport(args: {
  name: string;
  login: string;
  goal: CareerGoal;
  growthScore: number;
  stats: ProfileStats;
  insights: Insights;
  an: AnalysisLike;
  fits: RoleFit[];
}): string {
  const { stats, insights: i, an } = args;
  const lines: string[] = [];
  lines.push(`# Growth report — ${args.name} (@${args.login})`);
  lines.push(`Target role: **${args.goal}** — match ${args.growthScore}/100 — portfolio health ${stats.health}/100 (${stats.healthLabel})`);
  lines.push("", `_${i.headline}_`, "", "## Summary", i.summary);
  lines.push("", "## Strengths", ...i.strengths.map((s) => `- ${s}`));
  lines.push("", "## Recommendations", ...i.recommendations.map((r) => `- **[${r.priority}] ${r.title}** (${r.category}) — ${r.detail}`));
  if (i.recommendationSummary) lines.push("", i.recommendationSummary);
  lines.push("", "## Quick wins this week", ...i.quickWins.map((q) => `- [ ] ${q}`));
  lines.push("", "## Skills for this role", ...an.rows.map((r) => `- ${r.skill}: ${r.level} (${r.score}/100, ${r.repos} repos)`));
  lines.push("", "## Best-fit roles", ...args.fits.slice(0, 5).map((f) => `- ${f.goal}: ${f.score}/100`));
  lines.push("", "## Portfolio health", ...stats.dimensions.map((d) => `- ${d.label}: ${d.score}/100 — ${d.detail}`));
  if (i.project) {
    lines.push("", `## Recommended project: ${i.project.title} (${i.project.difficulty})`, i.project.why, "", ...i.project.milestones.map((m) => `1. ${m}`), "", `Outcome: ${i.project.outcome}`);
  }
  lines.push("", "_Estimated from public GitHub activity only._");
  return lines.join("\n");
}

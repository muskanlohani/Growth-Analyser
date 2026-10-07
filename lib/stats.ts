import type { RepoLite } from "./analysis";
import type { GithubEvent, GithubUser } from "./types";

const DAY = 86_400_000;

export interface LanguageSlice {
  name: string;
  count: number;
  pct: number;
}

export interface MonthBucket {
  key: string;
  label: string;
  count: number;
}

export type DimensionKey = "activity" | "consistency" | "documentation" | "impact" | "diversity";

export interface Dimension {
  key: DimensionKey;
  label: string;
  score: number;
  /** One plain sentence explaining the number. */
  detail: string;
}

export interface TopRepo {
  name: string;
  url: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  pushed: string;
}

export interface EventSummary {
  total: number;
  /** Sunday-first, length 7 */
  byWeekday: number[];
  byGroup: { label: string; count: number }[];
  activeDays: number;
  busiestDay: string | null;
  /** pull requests + reviews + issue discussion — a rough collaboration signal */
  collaboration: number;
}

export interface ProfileStats {
  totalRepos: number;
  ownRepos: number;
  forkedRepos: number;
  archivedRepos: number;
  stars: number;
  forksReceived: number;
  followers: number;
  following: number;
  accountAgeYears: number;
  joinedYear: number | null;
  languages: LanguageSlice[];
  languageCount: number;
  last30: number;
  last90: number;
  last365: number;
  staleRepos: number;
  daysSinceLastPush: number | null;
  monthly: MonthBucket[];
  activeMonths: number;
  currentStreak: number;
  longestStreak: number;
  busiestMonth: string | null;
  pctDescribed: number;
  pctTopics: number;
  pctLicensed: number;
  pctLiveDemo: number;
  topRepos: TopRepo[];
  dimensions: Dimension[];
  health: number;
  healthLabel: string;
  highlights: string[];
  events: EventSummary | null;
  /** true when the account has more public repos than we could read */
  truncated: boolean;
}

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

const EVENT_GROUPS: Record<string, string> = {
  PushEvent: "Pushes",
  PullRequestEvent: "Pull requests",
  PullRequestReviewEvent: "Reviews",
  PullRequestReviewCommentEvent: "Reviews",
  IssuesEvent: "Issues",
  IssueCommentEvent: "Comments",
  CommitCommentEvent: "Comments",
  CreateEvent: "Branches & repos",
  WatchEvent: "Stars given",
  ForkEvent: "Forks",
};

export function summarizeEvents(events: GithubEvent[] | null | undefined): EventSummary | null {
  if (!events || events.length === 0) return null;
  const byWeekday = Array(7).fill(0) as number[];
  const groups = new Map<string, number>();
  const days = new Set<string>();
  events.forEach((e) => {
    const d = new Date(e.created_at);
    if (isNaN(d.getTime())) return;
    byWeekday[d.getDay()] += 1;
    days.add(d.toDateString());
    const g = EVENT_GROUPS[e.type] || "Other";
    groups.set(g, (groups.get(g) || 0) + 1);
  });
  const byGroup = [...groups.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  const names = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];
  const max = Math.max(...byWeekday);
  const collab = ["Pull requests", "Reviews", "Issues", "Comments"].reduce((s, l) => s + (groups.get(l) || 0), 0);
  return {
    total: events.length,
    byWeekday,
    byGroup,
    activeDays: days.size,
    busiestDay: max > 0 ? names[byWeekday.indexOf(max)] : null,
    collaboration: collab,
  };
}

export function computeStats(user: Partial<GithubUser> | null, repos: RepoLite[], events?: GithubEvent[] | null): ProfileStats {
  const now = Date.now();
  const own = repos.filter((r) => !r.fork);
  // Accounts that only fork still get stats — they just describe the forks.
  const basis = own.length ? own : repos;
  const n = basis.length;

  const ageOf = (r: RepoLite) => {
    const t = new Date(r.pushed_at || r.updated_at || 0).getTime();
    return t ? (now - t) / DAY : Infinity;
  };

  // languages (by repository count)
  const langCounts = new Map<string, number>();
  basis.forEach((r) => r.language && langCounts.set(r.language, (langCounts.get(r.language) || 0) + 1));
  const langTotal = [...langCounts.values()].reduce((a, b) => a + b, 0);
  const sorted = [...langCounts.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 6).map(([name, count]) => ({ name, count, pct: pct(count, langTotal) }));
  const restCount = sorted.slice(6).reduce((s, [, c]) => s + c, 0);
  const languages: LanguageSlice[] = restCount ? [...top, { name: "Other", count: restCount, pct: pct(restCount, langTotal) }] : top;

  // recency windows
  const last30 = basis.filter((r) => ageOf(r) <= 30).length;
  const last90 = basis.filter((r) => ageOf(r) <= 90).length;
  const last365 = basis.filter((r) => ageOf(r) <= 365).length;
  const staleRepos = basis.filter((r) => ageOf(r) > 365).length;
  const youngest = basis.length ? Math.min(...basis.map(ageOf)) : Infinity;
  const daysSinceLastPush = isFinite(youngest) ? Math.round(youngest) : null;

  // twelve-month activity strip (month a repository was last pushed)
  const monthly: MonthBucket[] = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (11 - i));
    return { key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleString("en", { month: "short" }), count: 0 };
  });
  basis.forEach((r) => {
    const d = new Date(r.pushed_at || r.updated_at || 0);
    const b = monthly.find((m) => m.key === `${d.getFullYear()}-${d.getMonth()}`);
    if (b) b.count += 1;
  });
  const activeMonths = monthly.filter((m) => m.count > 0).length;
  let longestStreak = 0;
  let run = 0;
  monthly.forEach((m) => {
    run = m.count > 0 ? run + 1 : 0;
    longestStreak = Math.max(longestStreak, run);
  });
  // current streak: allow the (possibly just-started) latest month to be empty
  let currentStreak = 0;
  for (let i = monthly.length - 1; i >= 0; i--) {
    if (monthly[i].count > 0) currentStreak++;
    else if (i === monthly.length - 1) continue;
    else break;
  }
  const bestMonth = monthly.reduce((a, m) => (m.count > a.count ? m : a), monthly[0]);
  const busiestMonth = bestMonth.count > 0 ? bestMonth.label : null;

  // documentation signals
  const pctDescribed = pct(basis.filter((r) => (r.description || "").trim().length >= 12).length, n);
  const pctTopics = pct(basis.filter((r) => (r.topics || []).length > 0).length, n);
  const pctLicensed = pct(basis.filter((r) => !!r.license && r.license.spdx_id !== "NOASSERTION").length, n);
  const pctLiveDemo = pct(basis.filter((r) => !!(r.homepage || "").trim()).length, n);

  // impact
  const stars = own.reduce((s, r) => s + (r.stargazers_count || 0), 0);
  const forksReceived = own.reduce((s, r) => s + (r.forks_count || 0), 0);
  const followers = Number(user?.followers) || 0;
  const following = Number(user?.following) || 0;

  const topRepos: TopRepo[] = [...basis]
    .sort(
      (a, b) =>
        (b.stargazers_count || 0) * 3 + (b.forks_count || 0) * 2 - ((a.stargazers_count || 0) * 3 + (a.forks_count || 0) * 2) ||
        new Date(b.pushed_at || 0).getTime() - new Date(a.pushed_at || 0).getTime()
    )
    .slice(0, 5)
    .map((r) => ({
      name: r.name,
      url: r.html_url || `https://github.com/${user?.login || ""}/${r.name}`,
      description: r.description,
      language: r.language,
      stars: r.stargazers_count || 0,
      forks: r.forks_count || 0,
      pushed: r.pushed_at,
    }));

  const created = user?.created_at ? new Date(user.created_at) : null;
  const accountAgeYears = created ? Math.max(0, Math.round(((now - created.getTime()) / (365.25 * DAY)) * 10) / 10) : 0;

  // five scored dimensions → portfolio health
  const recency = daysSinceLastPush == null ? 0 : daysSinceLastPush <= 14 ? 40 : daysSinceLastPush <= 60 ? 30 : daysSinceLastPush <= 180 ? 18 : daysSinceLastPush <= 365 ? 8 : 0;
  const activity = clamp(recency + Math.min(60, last90 * 12 + Math.max(0, last365 - last90) * 2));
  const consistency = clamp(Math.round((activeMonths / 12) * 70 + (longestStreak / 12) * 30));
  const documentation = clamp(Math.round(pctDescribed * 0.4 + pctTopics * 0.25 + pctLicensed * 0.2 + pctLiveDemo * 0.15));
  const impact = clamp(Math.round(22 * Math.log10(1 + stars) + 18 * Math.log10(1 + forksReceived) + 18 * Math.log10(1 + followers)));
  const diversity = clamp(langCounts.size * 16);

  const dimensions: Dimension[] = [
    {
      key: "activity",
      label: "Activity",
      score: activity,
      detail:
        daysSinceLastPush == null
          ? "No pushes found."
          : `${plural(last90, "repo")} pushed in the last 90 days; latest push ${daysSinceLastPush === 0 ? "today" : plural(daysSinceLastPush, "day") + " ago"}.`,
    },
    {
      key: "consistency",
      label: "Consistency",
      score: consistency,
      detail: `Active in ${activeMonths} of the last 12 months; longest run is ${plural(longestStreak, "month")}.`,
    },
    {
      key: "documentation",
      label: "Documentation",
      score: documentation,
      detail: `${pctDescribed}% of repos have a description, ${pctTopics}% have topics, ${pctLicensed}% have a license.`,
    },
    {
      key: "impact",
      label: "Impact",
      score: impact,
      detail: `${plural(stars, "star")}, ${plural(forksReceived, "fork")} on your repos and ${plural(followers, "follower")}.`,
    },
    {
      key: "diversity",
      label: "Range",
      score: diversity,
      detail: langCounts.size ? `${plural(langCounts.size, "language")} across ${plural(n, "repo")}.` : "No languages detected.",
    },
  ];

  const health = Math.round(activity * 0.25 + consistency * 0.2 + documentation * 0.2 + impact * 0.15 + diversity * 0.2);
  const healthLabel = health >= 80 ? "Excellent" : health >= 60 ? "Solid" : health >= 40 ? "Growing" : "Early stage";

  const highlights: string[] = [];
  if (daysSinceLastPush != null && daysSinceLastPush <= 14) highlights.push("Pushed in the last 2 weeks");
  if (activeMonths >= 9) highlights.push("Active most months");
  if (langCounts.size >= 5) highlights.push("Polyglot");
  if (stars >= 50) highlights.push("Repos people star");
  else if (stars >= 10) highlights.push("First stars earned");
  if (n >= 4 && pctDescribed >= 75) highlights.push("Well-described repos");
  if (pctLiveDemo >= 30) highlights.push("Ships live demos");
  if (accountAgeYears >= 5) highlights.push(`${Math.floor(accountAgeYears)}+ years on GitHub`);
  if (user?.public_repos && user.public_repos >= 30) highlights.push("Prolific builder");

  return {
    totalRepos: repos.length,
    ownRepos: own.length,
    forkedRepos: repos.length - own.length,
    archivedRepos: repos.filter((r) => r.archived).length,
    stars,
    forksReceived,
    followers,
    following,
    accountAgeYears,
    joinedYear: created ? created.getFullYear() : null,
    languages,
    languageCount: langCounts.size,
    last30,
    last90,
    last365,
    staleRepos,
    daysSinceLastPush,
    monthly,
    activeMonths,
    currentStreak,
    longestStreak,
    busiestMonth,
    pctDescribed,
    pctTopics,
    pctLicensed,
    pctLiveDemo,
    topRepos,
    dimensions,
    health,
    healthLabel,
    highlights,
    events: summarizeEvents(events),
    truncated: !!user?.public_repos && user.public_repos > repos.length,
  };
}

export function formatCompact(n: number): string {
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

export function monthsAgo(iso: string | null | undefined): string {
  if (!iso) return "never";
  const days = (Date.now() - new Date(iso).getTime()) / DAY;
  if (days < 1) return "today";
  if (days < 31) return `${Math.round(days)}d ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  return `${(days / 365).toFixed(1).replace(/\.0$/, "")}y ago`;
}

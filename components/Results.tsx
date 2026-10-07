import React, { useState } from "react";
import { CAREER_GOALS, CareerGoal, RoleFit, SkillLevel, buildRoadmap, categorize } from "@/lib/analysis";
import { ProfileStats, formatCompact, monthsAgo } from "@/lib/stats";
import type { GithubUser, Insights, Priority } from "@/lib/types";
import type { AiStatus } from "./GrowthAnalyser";
import { Contours, Donut, MonthBars, Radar, TrailMap, WeekBars, langClass } from "./charts";
import { Icon, IconName, Panel, Pill, SectionHead, Skeleton, cx } from "./ui";

type Analysis = ReturnType<typeof categorize>;
type Roadmap = ReturnType<typeof buildRoadmap>;

interface Props {
  user: GithubUser;
  goal: CareerGoal;
  setGoal: (g: CareerGoal) => void;
  stats: ProfileStats;
  analysis: Analysis;
  roadmap: Roadmap;
  fits: RoleFit[];
  extraSkills: { skill: string; score: number }[];
  insights: Insights;
  aiStatus: AiStatus;
  aiError: string;
  aiModel?: string;
  onRetryAi: () => void;
  onRefresh: () => void;
  refreshing: boolean;
  onDownload: () => void;
  onNewSearch: () => void;
}

const levelTone = (l: SkillLevel) => (l === "Strong" || l === "Intermediate" ? "ridge" : l === "Developing" ? "sun" : "survey");
const priorityTone = (p: Priority) => (p === "High" ? "survey" : p === "Medium" ? "sun" : "neutral");
const scoreTone = (n: number) => (n >= 70 ? "ridge" : n >= 40 ? "sun" : "survey");

function agoDays(d: number | null) {
  if (d == null) return "—";
  if (d === 0) return "Today";
  if (d < 31) return `${d}d ago`;
  if (d < 365) return `${Math.round(d / 30)}mo ago`;
  return `${(d / 365).toFixed(1).replace(/\.0$/, "")}y ago`;
}

const NAV = [
  ["overview", "Overview"],
  ["health", "Health"],
  ["skills", "Skills"],
  ["advice", "Advice"],
  ["roadmap", "Roadmap"],
  ["repos", "Repos"],
] as const;

export default function Results(p: Props) {
  const { user, goal, stats, analysis, fits, insights, aiStatus } = p;
  const loading = aiStatus === "loading";
  const best = fits[0];
  const target = fits.find((f) => f.goal === goal);

  return (
    <main className="results">
      <ProfileHeader {...p} />

      <nav className="subnav" aria-label="Sections">
        {NAV.map(([id, label]) => (
          <a key={id} href={`#${id}`}>
            {label}
          </a>
        ))}
      </nav>

      {/* ---------- overview: where you are ---------- */}
      <Panel id="overview" className="hero">
        <Contours className="hero-contours" />
        <div className="hero-copy">
          <p className="hero-label">Growth score for {goal}</p>
          <h1 className="hero-title">
            {analysis.growthScore > 0 ? (
              <>
                You&apos;re {analysis.growthScore}% of the way to{" "}
                {goal.split(" ").map((w, i, a) => (
                  <React.Fragment key={i}>
                    <span className="nowrap">{w}</span>
                    {i < a.length - 1 ? " " : ""}
                  </React.Fragment>
                ))}
                .
              </>
            ) : (
              <>No public evidence for {goal} yet. Every project you push starts the trail.</>
            )}
          </h1>
          <p className="hero-sub">
            {analysis.strong.length
              ? `Strong in ${analysis.strong.map((s) => s.skill).join(", ")}.`
              : "No skill has reached intermediate level for this role yet."}{" "}
            {analysis.learnNow.length ? `Next stops: ${analysis.learnNow.map((s) => s.skill).join(", ")}.` : "No major gaps left."}
          </p>
          <dl className="hero-stats">
            <div>
              <dt>Skills covered</dt>
              <dd>
                {analysis.strong.length + analysis.developing.length}
                <span>/{analysis.rows.length}</span>
              </dd>
            </div>
            <div>
              <dt>Portfolio health</dt>
              <dd>
                {stats.health}
                <span>/100 {stats.healthLabel.toLowerCase()}</span>
              </dd>
            </div>
            <div>
              <dt>Closest role</dt>
              <dd className="hero-stat-text">
                {best.goal === goal ? "This one" : best.goal}
                <span> {best.score}%</span>
              </dd>
            </div>
          </dl>
        </div>
        <div className="hero-map">
          <TrailMap score={analysis.growthScore} waypoints={analysis.learnNow.map((s) => s.skill)} goal={goal} />
          <ul className="trail-legend">
            <li>
              <span className="key key-you" /> You are here
            </li>
            {analysis.learnNow.length > 0 && (
              <li>
                <span className="key key-stop" /> Next stops: {analysis.learnNow.slice(0, 3).map((s, i) => `${i + 1} ${s.skill}`).join(", ")}
              </li>
            )}
            <li>
              <span className="key key-flag" /> {goal}
            </li>
          </ul>
        </div>
      </Panel>

      {/* ---------- AI read ---------- */}
      <Panel className="ai-panel">
        <div className="ai-top">
          <AiBadge status={aiStatus} model={p.aiModel} />
          {aiStatus === "error" && (
            <div className="ai-note" role="status">
              <Icon name="alert" size={16} />
              <span>{p.aiError}</span>
              <button className="btn btn-ghost btn-sm" onClick={p.onRetryAi}>
                <Icon name="refresh" size={14} /> Try again
              </button>
            </div>
          )}
        </div>
        {loading ? (
          <div className="ai-grid">
            <Skeleton lines={5} />
            <Skeleton lines={4} />
          </div>
        ) : (
          <div className="ai-grid">
            <div>
              <h2 className="ai-headline">{insights.headline}</h2>
              <p className="prose">{insights.summary}</p>
            </div>
            <div>
              <h3 className="mini-title">What&apos;s working</h3>
              <ul className="ticks">
                {insights.strengths.map((s) => (
                  <li key={s}>
                    <Icon name="check" size={16} className="tick" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Panel>

      {/* ---------- headline numbers ---------- */}
      <div className="kpis" role="list">
        <Kpi icon="repo" value={String(stats.ownRepos)} label="Original repos" note={stats.forkedRepos ? `${stats.forkedRepos} forks excluded` : undefined} />
        <Kpi icon="star" value={formatCompact(stats.stars)} label="Stars earned" />
        <Kpi icon="fork" value={formatCompact(stats.forksReceived)} label="Forks of your repos" />
        <Kpi icon="code" value={String(stats.languageCount)} label="Languages" />
        <Kpi icon="calendar" value={`${stats.activeMonths}/12`} label="Active months" note={stats.longestStreak ? `${stats.longestStreak}-month best run` : undefined} />
        <Kpi icon="clock" value={agoDays(stats.daysSinceLastPush)} label="Last push" note={`${stats.last30} repos in 30 days`} />
      </div>

      {/* ---------- portfolio health ---------- */}
      <Panel id="health">
        <SectionHead
          title="Portfolio health"
          sub="How your public profile reads to a recruiter or collaborator who has two minutes."
          icon="activity"
        />
        <div className="health">
          <div className="health-radar">
            <Radar dims={stats.dimensions} />
          </div>
          <div className="health-body">
            <div className="health-total">
              <span className={cx("health-num", `tone-${scoreTone(stats.health)}`)}>{stats.health}</span>
              <div>
                <div className="health-label">{stats.healthLabel}</div>
                <div className="muted small">Weighted blend of the five measures below</div>
              </div>
            </div>
            <ul className="dims">
              {stats.dimensions.map((d) => (
                <li key={d.key}>
                  <div className="dim-top">
                    <span className="dim-name">{d.label}</span>
                    <span className="dim-score">{d.score}</span>
                  </div>
                  <div className="meter" aria-hidden="true">
                    <div className={cx("meter-fill", `fill-${scoreTone(d.score)}`)} style={{ width: `${Math.max(2, d.score)}%` }} />
                  </div>
                  <p className="dim-detail">{d.detail}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
        {stats.highlights.length > 0 && (
          <div className="chips" aria-label="Highlights">
            {stats.highlights.map((h) => (
              <Pill key={h} tone="ridge">
                {h}
              </Pill>
            ))}
          </div>
        )}
      </Panel>

      {/* ---------- languages + activity ---------- */}
      <div className="grid-2">
        <Panel>
          <SectionHead title="Languages" sub={`Share of your ${stats.ownRepos || stats.totalRepos} ${stats.ownRepos ? "original " : ""}repositories.`} icon="code" />
          {stats.languages.length === 0 ? (
            <p className="muted">GitHub detected no languages in your repositories yet.</p>
          ) : (
            <div className="lang">
              <Donut slices={stats.languages} total={stats.languageCount} />
              <ul className="lang-list">
                {stats.languages.map((l, i) => (
                  <li key={l.name}>
                    <span className={cx("swatch", langClass(l.name, i))} />
                    <span className="lang-name">{l.name}</span>
                    <span className="lang-meta">
                      {l.count} {l.count === 1 ? "repo" : "repos"}
                    </span>
                    <span className="lang-pct">{l.pct}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>

        <Panel>
          <SectionHead title="Activity" sub="Repositories by the month they were last pushed to." icon="calendar" />
          <MonthBars months={stats.monthly} />
          <dl className="facts">
            <div>
              <dt>Pushed in 90 days</dt>
              <dd>{stats.last90}</dd>
            </div>
            <div>
              <dt>Busiest month</dt>
              <dd>{stats.busiestMonth ?? "—"}</dd>
            </div>
            <div>
              <dt>Untouched for a year</dt>
              <dd>{stats.staleRepos}</dd>
            </div>
          </dl>
        </Panel>
      </div>

      {stats.events && (
        <Panel>
          <SectionHead
            title="Recent public activity"
            sub={`Your latest ${stats.events.total} public GitHub events${stats.events.busiestDay ? `, busiest on ${stats.events.busiestDay}` : ""}.`}
            icon="activity"
          />
          <div className="events-grid">
            <div>
              <h3 className="mini-title">By weekday</h3>
              <WeekBars days={stats.events.byWeekday} />
            </div>
            <div>
              <h3 className="mini-title">What you did</h3>
              <ul className="mix">
                {stats.events.byGroup.slice(0, 6).map((g) => (
                  <li key={g.label}>
                    <span className="mix-name">{g.label}</span>
                    <span className="meter" aria-hidden="true">
                      <span className="meter-fill fill-sun" style={{ width: `${Math.max(3, (g.count / stats.events!.byGroup[0].count) * 100)}%` }} />
                    </span>
                    <span className="mix-count">{g.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Panel>
      )}

      {/* ---------- role fit ---------- */}
      <Panel>
        <SectionHead
          title="How you match each role"
          sub={
            best.goal === goal
              ? `${goal} is already your closest match at ${best.score}%.`
              : `Closest match is ${best.goal} at ${best.score}%; your target ${goal} is at ${target?.score ?? 0}%. Select a role to switch your target.`
          }
          icon="pin"
        />
        <ul className="fits">
          {fits.map((f, i) => (
            <li key={f.goal}>
              <button className={cx("fit", f.goal === goal && "fit-active")} onClick={() => p.setGoal(f.goal)} aria-pressed={f.goal === goal}>
                <span className="fit-name">
                  {f.goal}
                  {f.goal === goal && <Pill tone="ridge">Your target</Pill>}
                  {i === 0 && f.goal !== goal && <Pill tone="sun">Closest</Pill>}
                </span>
                <span className="meter fit-meter" aria-hidden="true">
                  <span className={cx("meter-fill", f.goal === goal ? "fill-ridge" : "fill-muted")} style={{ width: `${Math.max(2, f.score)}%` }} />
                </span>
                <span className="fit-score">{f.score}%</span>
              </button>
            </li>
          ))}
        </ul>
      </Panel>

      {/* ---------- skill terrain ---------- */}
      <Panel id="skills">
        <SectionHead title={`Skill terrain for ${goal}`} sub="Scored from languages, repo names, descriptions and topics, weighted toward recent work." icon="code" />
        {analysis.rows.length === 0 ? (
          <p className="muted">No mapped skills for this role yet.</p>
        ) : (
          <ul className="terrain">
            {analysis.rows.map((r) => (
              <li key={r.skill} className="terrain-row">
                <div className="terrain-head">
                  <span className="terrain-name">{r.skill}</span>
                  <Pill tone={levelTone(r.level)}>{r.level}</Pill>
                </div>
                <div className="meter meter-lg" aria-hidden="true">
                  <div className={cx("meter-fill", `fill-${levelTone(r.level)}`)} style={{ width: `${Math.max(2, r.score)}%` }} />
                </div>
                <div className="terrain-meta">
                  <span className="terrain-score">{r.score}/100</span>
                  <span className="muted">
                    {r.repos ? `${r.repos} ${r.repos === 1 ? "repo" : "repos"}, last used ${monthsAgo(r.lastUsed)}` : "No repos yet"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
        {p.extraSkills.length > 0 && (
          <div className="extras">
            <h3 className="mini-title">Also on your profile</h3>
            <div className="chips">
              {p.extraSkills.slice(0, 10).map((s) => (
                <Pill key={s.skill}>
                  {s.skill} {s.score}
                </Pill>
              ))}
            </div>
          </div>
        )}
      </Panel>

      {/* ---------- recommendations ---------- */}
      <Advice {...p} />

      {/* ---------- learn now / next / pause ---------- */}
      <div className="grid-3">
        <Column title="Learn now" tone="survey" items={analysis.learnNow.map((s) => s.skill)} empty="No urgent gaps.">
          {(skill) => (
            <p className="column-reason">
              {loading ? <span className="skeleton skeleton-inline" /> : insights.learnNowReasons[skill] || `Limited evidence of ${skill} in your recent repositories.`}
            </p>
          )}
        </Column>
        <Column title="Learn next" tone="sun" items={analysis.learnNext.map((s) => s.skill)} empty="Nothing queued." />
        <Column
          title="Pause for now"
          tone="ridge"
          items={analysis.pause.map((s) => s.skill)}
          note="Already covered, so your time is better spent elsewhere first."
          empty="Nothing here yet."
        />
      </div>

      {/* ---------- roadmap ---------- */}
      <Panel id="roadmap">
        <SectionHead title="Personalized roadmap" sub="Skills you already show are checked off." icon="pin" />
        <ol className="phases">
          {p.roadmap.map((phase, i) => (
            <li key={phase.title} className="phase">
              <div className="phase-head">
                <span className="phase-num">{i + 1}</span>
                <h3 className="phase-title">{phase.title}</h3>
              </div>
              <ul className="phase-items">
                {phase.items.map((it) => (
                  <li key={it.label} className={cx("phase-item", it.done && "is-done")}>
                    <span className="phase-check" aria-hidden="true">
                      {it.done && <Icon name="check" size={12} />}
                    </span>
                    <span>
                      {it.label}
                      {it.done && <span className="sr-only"> (done)</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </Panel>

      {/* ---------- project ---------- */}
      <ProjectCard {...p} />

      {/* ---------- repositories ---------- */}
      <Panel id="repos">
        <SectionHead title="Top repositories" sub="Ranked by stars, forks and recent activity." icon="repo" />
        {stats.topRepos.length === 0 ? (
          <p className="muted">No public repositories found.</p>
        ) : (
          <ul className="repos">
            {stats.topRepos.map((r) => (
              <li key={r.name} className="repo">
                <div className="repo-main">
                  <a className="repo-name" href={r.url} target="_blank" rel="noopener noreferrer">
                    {r.name}
                    <Icon name="external" size={13} />
                  </a>
                  <p className="repo-desc">{r.description || <span className="muted">No description. Adding one makes this repo easier to scan.</span>}</p>
                </div>
                <div className="repo-meta">
                  {r.language && <span className="repo-lang">{r.language}</span>}
                  <span title="Stars">
                    <Icon name="star" size={14} /> {r.stars}
                  </span>
                  <span title="Forks">
                    <Icon name="fork" size={14} /> {r.forks}
                  </span>
                  <span className="muted">{monthsAgo(r.pushed)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <footer className="foot">
        {stats.truncated && (
          <p>
            {user.login} has {user.public_repos} public repositories; this analysis read the {stats.totalRepos} most recently pushed.
          </p>
        )}
        <p>
          Estimated from public GitHub activity only: repositories, languages, topics and recency. GitHub doesn&apos;t capture everything a
          developer knows, so treat this as a starting point, not a verdict.
        </p>
        <p>Written advice is generated by Google Gemini from the numbers above.</p>
      </footer>
    </main>
  );
}

/* ================= pieces ================= */

function ProfileHeader(p: Props) {
  const { user, stats } = p;
  return (
    <div className="profile">
      <div className="profile-id">
        {user.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="avatar" src={user.avatar_url} alt="" width={72} height={72} />
        ) : (
          <div className="avatar avatar-fallback" aria-hidden="true">
            {user.login.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="profile-text">
          <h2 className="profile-name">{user.name || user.login}</h2>
          <a className="profile-handle" href={user.html_url || `https://github.com/${user.login}`} target="_blank" rel="noopener noreferrer">
            @{user.login}
            <Icon name="external" size={13} />
          </a>
          {user.bio && <p className="profile-bio">{user.bio}</p>}
          <div className="profile-meta">
            {user.location && (
              <span>
                <Icon name="pin" size={14} /> {user.location}
              </span>
            )}
            {stats.joinedYear && (
              <span>
                <Icon name="calendar" size={14} /> Joined {stats.joinedYear}
              </span>
            )}
            <span>
              <Icon name="users" size={14} /> {formatCompact(stats.followers)} followers, {formatCompact(stats.following)} following
            </span>
          </div>
        </div>
      </div>

      <div className="profile-actions">
        <div className="field field-inline">
          <label htmlFor="target-role">Target role</label>
          <select id="target-role" value={p.goal} onChange={(e) => p.setGoal(e.target.value as CareerGoal)}>
            {CAREER_GOALS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
        <div className="btn-row">
          <button className="btn btn-secondary btn-sm" onClick={p.onRefresh} disabled={p.refreshing}>
            <Icon name="refresh" size={15} /> {p.refreshing ? "Refreshing…" : "Refresh data"}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={p.onDownload}>
            <Icon name="download" size={15} /> Download report
          </button>
          <button className="btn btn-ghost btn-sm" onClick={p.onNewSearch}>
            New profile
          </button>
        </div>
      </div>
    </div>
  );
}

function AiBadge({ status, model }: { status: AiStatus; model?: string }) {
  if (status === "loading")
    return (
      <span className="ai-badge ai-badge-busy">
        <span className="spinner spinner-sm" aria-hidden="true" /> Gemini is reading your profile…
      </span>
    );
  if (status === "done")
    return (
      <span className="ai-badge">
        <Icon name="sparkles" size={15} /> Written by Gemini{model ? <span className="ai-model">{model}</span> : null}
      </span>
    );
  return (
    <span className="ai-badge ai-badge-off">
      <Icon name="activity" size={15} /> Based on your data
    </span>
  );
}

function Kpi({ icon, value, label, note }: { icon: IconName; value: string; label: string; note?: string }) {
  return (
    <div className="kpi" role="listitem">
      <Icon name={icon} size={18} className="kpi-icon" />
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
      {note && <div className="kpi-note">{note}</div>}
    </div>
  );
}

function Column({
  title,
  tone,
  items,
  note,
  empty,
  children,
}: {
  title: string;
  tone: "ridge" | "sun" | "survey";
  items: string[];
  note?: string;
  empty: string;
  children?: (skill: string) => React.ReactNode;
}) {
  return (
    <Panel className="column">
      <h3 className="column-title">
        <span className={cx("dot", `dot-${tone}`)} aria-hidden="true" />
        {title}
        <span className="column-count">{items.length}</span>
      </h3>
      {note && <p className="muted small">{note}</p>}
      {items.length === 0 ? (
        <p className="muted small">{empty}</p>
      ) : (
        <ul className={children ? "column-list" : "column-pills"}>
          {items.map((s) => (
            <li key={s}>
              <Pill tone={tone}>{s}</Pill>
              {children?.(s)}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Advice(p: Props) {
  const { insights, aiStatus } = p;
  const [view, setView] = useState<"points" | "summary">("points");
  const [done, setDone] = useState<Record<string, boolean>>({});
  const loading = aiStatus === "loading";

  return (
    <Panel id="advice">
      <SectionHead
        title="Recommendations"
        sub="What to do next, most important first."
        icon="sparkles"
        aside={
          <div className="segmented" role="tablist" aria-label="Recommendation format">
            <button role="tab" aria-selected={view === "points"} className={cx("seg", view === "points" && "seg-on")} onClick={() => setView("points")}>
              Point by point
            </button>
            <button role="tab" aria-selected={view === "summary"} className={cx("seg", view === "summary" && "seg-on")} onClick={() => setView("summary")}>
              Summary
            </button>
          </div>
        }
      />

      <div className="advice">
        <div className="advice-main" role="tabpanel">
          {loading ? (
            <Skeleton lines={7} />
          ) : view === "points" ? (
            <ul className="recs">
              {insights.recommendations.map((r) => (
                <li key={r.title} className={cx("rec", `rec-${priorityTone(r.priority)}`)}>
                  <div className="rec-top">
                    <h3 className="rec-title">{r.title}</h3>
                    <div className="rec-tags">
                      <Pill tone={priorityTone(r.priority)}>{r.priority} priority</Pill>
                      <Pill>{r.category}</Pill>
                    </div>
                  </div>
                  <p className="rec-detail">{r.detail}</p>
                </li>
              ))}
              {insights.recommendations.length === 0 && <li className="muted">Nothing urgent stands out. Keep shipping and polishing.</li>}
            </ul>
          ) : (
            <div className="summary-view">
              <p className="prose prose-lg">{insights.recommendationSummary || insights.summary}</p>
              {insights.recommendations.filter((r) => r.priority === "High").length > 0 && (
                <>
                  <h3 className="mini-title">Top priorities</h3>
                  <ul className="ticks">
                    {insights.recommendations
                      .filter((r) => r.priority === "High")
                      .slice(0, 4)
                      .map((r) => (
                        <li key={r.title}>
                          <Icon name="flag" size={16} className="tick tick-survey" />
                          <span>{r.title}</span>
                        </li>
                      ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>

        <aside className="wins">
          <h3 className="wins-title">
            <Icon name="zap" size={17} /> Quick wins this week
          </h3>
          {loading ? (
            <Skeleton lines={4} />
          ) : (
            <ul className="wins-list">
              {insights.quickWins.map((w) => (
                <li key={w}>
                  <label className={cx("win", done[w] && "win-done")}>
                    <input type="checkbox" checked={!!done[w]} onChange={(e) => setDone({ ...done, [w]: e.target.checked })} />
                    <span className="win-box" aria-hidden="true">
                      {done[w] && <Icon name="check" size={12} />}
                    </span>
                    <span className="win-text">{w}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </Panel>
  );
}

function ProjectCard(p: Props) {
  const { insights, aiStatus } = p;
  const proj = insights.project;
  return (
    <Panel>
      <SectionHead title="Project to build next" sub="Chosen to close your biggest gap using what you already do well." icon="zap" />
      {aiStatus === "loading" ? (
        <Skeleton lines={4} />
      ) : proj ? (
        <div className="project">
          <div className="project-main">
            <div className="project-head">
              <h3 className="project-title">{proj.title}</h3>
              <Pill tone="sun">{proj.difficulty}</Pill>
            </div>
            <p className="prose">{proj.why}</p>
            <div className="chips">
              {proj.skills.map((s) => (
                <Pill key={s} tone="ridge">
                  {s}
                </Pill>
              ))}
            </div>
            <p className="project-outcome">
              <strong>Outcome:</strong> {proj.outcome}
            </p>
          </div>
          {proj.milestones.length > 0 && (
            <div className="project-steps">
              <h3 className="mini-title">Milestones</h3>
              <ol className="steps">
                {proj.milestones.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      ) : (
        <p className="muted">
          Build something that pairs {p.analysis.strong[0]?.skill || "a skill you know"} with {p.analysis.learnNow[0]?.skill || "a skill you're missing"}.
        </p>
      )}
    </Panel>
  );
}

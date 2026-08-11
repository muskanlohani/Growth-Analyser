"use client";

import React, { useCallback, useState } from "react";
import {
  CAREER_GOALS,
  CareerGoal,
  computeSkills,
  categorize,
  buildRoadmap,
  extractUsername,
  RepoLite,
  SkillLevel,
} from "@/lib/analysis";
import { fetchGithub, GithubFetchError } from "@/lib/github";

const THEME = {
  dark: {
    bg: "#0B0E14",
    bgElevated: "#12161F",
    bgCard: "#151A24",
    border: "#232A38",
    text: "#EDEFF3",
    textMuted: "#8B93A3",
    textFaint: "#5A6272",
    accent: "#E8A33D",
    accentSoft: "#E8A33D22",
    depth: "#2F8F8A",
    depthSoft: "#2F8F8A22",
    gap: "#E2574C",
    gapSoft: "#E2574C22",
  },
  light: {
    bg: "#F6F5F1",
    bgElevated: "#FFFFFF",
    bgCard: "#FFFFFF",
    border: "#DEDBD1",
    text: "#181B22",
    textMuted: "#5B6270",
    textFaint: "#9298A3",
    accent: "#B9791F",
    accentSoft: "#B9791F1A",
    depth: "#1F6F78",
    depthSoft: "#1F6F781A",
    gap: "#C13F35",
    gapSoft: "#C13F351A",
  },
} as const;

type Theme = (typeof THEME)[keyof typeof THEME];

function levelColor(level: SkillLevel, t: Theme) {
  if (level === "Strong" || level === "Intermediate") return t.depth;
  if (level === "Developing" || level === "Beginner") return t.accent;
  return t.gap;
}

function Tag({ children, color, soft }: { children: React.ReactNode; color: string; soft: string }) {
  return (
    <span
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
        padding: "3px 8px",
        borderRadius: 4,
        color,
        background: soft,
        border: `1px solid ${color}44`,
        letterSpacing: 0.3,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function TerrainBar({ skill, score, level, t }: { skill: string; score: number; level: SkillLevel; t: Theme }) {
  const color = levelColor(level, t);
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, color: t.text }}>{skill}</span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: t.textMuted }}>
          {level} · {score}
        </span>
      </div>
      <div
        style={{
          height: 12,
          borderRadius: 3,
          background: t.bgElevated,
          border: `1px solid ${t.border}`,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${Math.max(3, score)}%`,
            height: "100%",
            background: `repeating-linear-gradient(135deg, ${color} 0px, ${color} 6px, ${color}CC 6px, ${color}CC 12px)`,
            transition: "width 0.8s cubic-bezier(0.16,1,0.3,1)",
          }}
        />
      </div>
    </div>
  );
}

function Card({
  title,
  children,
  t,
  accentColor,
}: {
  title?: string;
  children: React.ReactNode;
  t: Theme;
  accentColor?: string;
}) {
  return (
    <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 10, padding: "18px 20px" }}>
      {title && (
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            letterSpacing: 1,
            textTransform: "uppercase",
            color: accentColor || t.textFaint,
            marginBottom: 14,
          }}
        >
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

function ActivityGrid({ repos, t }: { repos: RepoLite[]; t: Theme }) {
  const now = Date.now();
  const buckets = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (11 - i));
    return { key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleString("default", { month: "short" }), count: 0 };
  });
  repos.forEach((r) => {
    const d = new Date(r.pushed_at || r.updated_at || now);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const bucket = buckets.find((b) => b.key === key);
    if (bucket) bucket.count += 1;
  });
  const max = Math.max(1, ...buckets.map((m) => m.count));

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 70 }}>
      {buckets.map((m) => (
        <div key={m.key} style={{ flex: 1, textAlign: "center" }}>
          <div title={`${m.label}: ${m.count} repo(s) updated`} style={{ height: 44, display: "flex", alignItems: "flex-end" }}>
            <div
              style={{
                width: "100%",
                height: `${Math.max(4, (m.count / max) * 44)}px`,
                background: m.count ? t.depth : t.border,
                borderRadius: 2,
              }}
            />
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: t.textFaint, marginTop: 4 }}>
            {m.label}
          </div>
        </div>
      ))}
    </div>
  );
}

async function generateExplanations(payload: unknown) {
  const res = await fetch("/api/explain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("AI_FAILED");
  return res.json();
}

export default function GrowthAnalyser() {
  const [mode, setMode] = useState<"dark" | "light">("dark");
  const t = THEME[mode];

  const [stage, setStage] = useState<"input" | "loading" | "done" | "error">("input");
  const [username, setUsername] = useState("");
  const [goal, setGoal] = useState<CareerGoal>(CAREER_GOALS[0]);
  const [errorMsg, setErrorMsg] = useState("");

  const [ghUser, setGhUser] = useState<any>(null);
  const [repos, setRepos] = useState<RepoLite[]>([]);
  const [analysis, setAnalysis] = useState<ReturnType<typeof categorize> | null>(null);
  const [roadmap, setRoadmap] = useState<ReturnType<typeof buildRoadmap> | null>(null);

  const [ai, setAi] = useState<any>(null);
  const [aiStatus, setAiStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  const runFromRepos = useCallback(
    (rawUsername: string, repoList: RepoLite[], userObj?: any) => {
      const cleanUsername = extractUsername(rawUsername) || rawUsername.trim();
      const sd = computeSkills(repoList);
      const an = categorize(sd.scores, goal);
      const rm = buildRoadmap(goal, sd.scores);

      setGhUser(
        userObj || {
          login: cleanUsername,
          name: cleanUsername,
          avatar_url: null,
          public_repos: repoList.length,
          followers: "—",
        }
      );
      setRepos(repoList);
      setAnalysis(an);
      setRoadmap(rm);
      setStage("done");

      setAiStatus("loading");
      const topRepos = [...repoList]
        .sort((a, b) => new Date(b.pushed_at || 0).getTime() - new Date(a.pushed_at || 0).getTime())
        .slice(0, 8)
        .map((r) => ({ name: r.name, language: r.language, description: r.description }));

      generateExplanations({
        username: cleanUsername,
        careerGoal: goal,
        growthScore: an.growthScore,
        strong: an.strong.map((r) => r.skill),
        developing: an.developing.map((r) => r.skill),
        gaps: an.gaps.map((r) => r.skill),
        learnNow: an.learnNow.map((r) => r.skill),
        topRepos,
      })
        .then((result) => {
          setAi(result);
          setAiStatus("done");
        })
        .catch(() => setAiStatus("error"));
    },
    [goal]
  );

  const runAnalysis = useCallback(async () => {
    if (!username.trim()) return;
    setStage("loading");
    setErrorMsg("");
    setAi(null);
    setAiStatus("idle");
    try {
      const { user, repos: fetchedRepos } = await fetchGithub(username.trim());
      runFromRepos(username, fetchedRepos, user);
    } catch (e) {
      setStage("error");
      if (e instanceof GithubFetchError) {
        if (e.code === "NOT_FOUND") setErrorMsg("No GitHub user found with that username.");
        else if (e.code === "RATE_LIMIT")
          setErrorMsg(
            `GitHub's API rate limit was hit${e.detail ? ": " + e.detail : ""}. Add a GITHUB_TOKEN env var to raise this from 60/hr to 5,000/hr.`
          );
        else setErrorMsg(`Something went wrong reaching GitHub${e.detail ? ": " + e.detail : ""}.`);
      } else {
        setErrorMsg("Something went wrong. Please try again.");
      }
    }
  }, [username, runFromRepos]);

  return (
    <div style={{ minHeight: "100vh", background: t.bg, color: t.text, fontFamily: "'Inter', sans-serif" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "18px 28px",
          borderBottom: `1px solid ${t.border}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18 }}>Growth Analyser</span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: t.textFaint }}>
            /{goal.toLowerCase().replace(/\s+/g, "-")}
          </span>
        </div>
        <button
          onClick={() => setMode(mode === "dark" ? "light" : "dark")}
          style={{
            background: "transparent",
            border: `1px solid ${t.border}`,
            color: t.textMuted,
            borderRadius: 6,
            padding: "6px 12px",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            cursor: "pointer",
          }}
        >
          {mode === "dark" ? "☾ dark" : "☀ light"}
        </button>
      </div>

      {stage !== "done" ? (
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "70px 24px 40px" }}>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 40, lineHeight: 1.15, fontWeight: 700, margin: "0 0 10px", letterSpacing: -0.5 }}>
            Understand where you are.
            <br />
            <span style={{ color: t.accent }}>Discover where to grow.</span>
          </h1>
          <p style={{ color: t.textMuted, fontSize: 15, marginBottom: 36, maxWidth: 480 }}>
            Enter a public GitHub profile and a target role. We&apos;ll read your repositories and build a skill
            terrain, gap analysis, and a roadmap grounded in what you&apos;ve actually shipped.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: t.textFaint, display: "block", marginBottom: 6 }}>
                GITHUB USERNAME
              </label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runAnalysis()}
                placeholder="e.g. torvalds or github.com/torvalds"
                style={{
                  width: "100%",
                  background: t.bgCard,
                  border: `1px solid ${t.border}`,
                  borderRadius: 8,
                  padding: "12px 14px",
                  color: t.text,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 14,
                }}
              />
            </div>

            <div>
              <label style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: t.textFaint, display: "block", marginBottom: 6 }}>
                TARGET CAREER
              </label>
              <select
                value={goal}
                onChange={(e) => setGoal(e.target.value as CareerGoal)}
                style={{
                  width: "100%",
                  background: t.bgCard,
                  border: `1px solid ${t.border}`,
                  borderRadius: 8,
                  padding: "12px 14px",
                  color: t.text,
                  fontSize: 14,
                }}
              >
                {CAREER_GOALS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={runAnalysis}
              disabled={stage === "loading" || !username.trim()}
              style={{
                marginTop: 8,
                background: t.accent,
                color: mode === "dark" ? "#14100A" : "#FFFFFF",
                border: "none",
                borderRadius: 8,
                padding: "13px 20px",
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 600,
                fontSize: 15,
                cursor: stage === "loading" ? "default" : "pointer",
                opacity: stage === "loading" || !username.trim() ? 0.6 : 1,
              }}
            >
              {stage === "loading" ? "Reading your GitHub…" : "Analyze My Growth →"}
            </button>

            {stage === "error" && (
              <div style={{ color: t.gap, background: t.gapSoft, border: `1px solid ${t.gap}44`, borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>
                {errorMsg}
              </div>
            )}
          </div>

          <p style={{ color: t.textFaint, fontSize: 12, marginTop: 28, lineHeight: 1.6 }}>
            Only public GitHub data is read. This gives an estimated technical profile based on what&apos;s visible
            on GitHub — it isn&apos;t a full picture of your professional experience.
          </p>
        </div>
      ) : (
        analysis &&
        roadmap && (
          <ResultsView
            t={t}
            mode={mode}
            goal={goal}
            setGoal={setGoal}
            ghUser={ghUser}
            repos={repos}
            analysis={analysis}
            roadmap={roadmap}
            ai={ai}
            aiStatus={aiStatus}
            onReanalyze={runAnalysis}
            onNewSearch={() => setStage("input")}
          />
        )
      )}
    </div>
  );
}

function ResultsView({
  t,
  mode,
  goal,
  setGoal,
  ghUser,
  repos,
  analysis,
  roadmap,
  ai,
  aiStatus,
  onReanalyze,
  onNewSearch,
}: {
  t: Theme;
  mode: "dark" | "light";
  goal: CareerGoal;
  setGoal: (g: CareerGoal) => void;
  ghUser: any;
  repos: RepoLite[];
  analysis: ReturnType<typeof categorize>;
  roadmap: ReturnType<typeof buildRoadmap>;
  ai: any;
  aiStatus: "idle" | "loading" | "done" | "error";
  onReanalyze: () => void;
  onNewSearch: () => void;
}) {
  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "32px 24px 80px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
        {ghUser?.avatar_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ghUser.avatar_url} alt="" style={{ width: 56, height: 56, borderRadius: 10, border: `1px solid ${t.border}` }} />
        )}
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 20 }}>{ghUser?.name || ghUser?.login}</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: t.textMuted }}>
            @{ghUser?.login} · {ghUser?.public_repos} public repos · {ghUser?.followers} followers
          </div>
        </div>
        <select
          value={goal}
          onChange={(e) => setGoal(e.target.value as CareerGoal)}
          style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 8, padding: "8px 12px", color: t.text, fontSize: 13 }}
        >
          {CAREER_GOALS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <button
          onClick={onReanalyze}
          style={{ background: t.accent, color: mode === "dark" ? "#14100A" : "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          Re-run
        </button>
        <button
          onClick={onNewSearch}
          style={{ background: "transparent", color: t.textMuted, border: `1px solid ${t.border}`, borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer" }}
        >
          New search
        </button>
      </div>

      <Card t={t} title="Growth Summary" accentColor={t.accent}>
        {aiStatus === "loading" && <div style={{ color: t.textFaint, fontSize: 13 }}>Generating…</div>}
        {aiStatus === "error" && (
          <p style={{ color: t.textMuted, fontSize: 14, margin: 0 }}>
            Numbers-based read: your strongest evidence is in {analysis.strong.map((s) => s.skill).join(", ") || "a few areas"}, and the
            clearest next moves are {analysis.learnNow.map((s) => s.skill).join(", ") || "listed below"}.
          </p>
        )}
        {aiStatus === "done" && ai?.summary && <p style={{ color: t.text, fontSize: 14.5, lineHeight: 1.6, margin: 0 }}>{ai.summary}</p>}
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, margin: "16px 0" }}>
        <Card t={t} title="Growth Score">
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 38, fontWeight: 700, color: t.accent }}>
            {analysis.growthScore}
            <span style={{ fontSize: 16, color: t.textFaint }}>/100</span>
          </div>
          <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>toward {goal}</div>
        </Card>
        <Card t={t} title="Already Strong">
          <div style={{ fontSize: 24, fontWeight: 700, color: t.depth }}>{analysis.strong.length}</div>
          <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>skills with solid evidence</div>
        </Card>
        <Card t={t} title="Skill Gaps">
          <div style={{ fontSize: 24, fontWeight: 700, color: t.gap }}>{analysis.gaps.length}</div>
          <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>skills missing or thin</div>
        </Card>
        <Card t={t} title="GitHub Activity">
          <ActivityGrid repos={repos} t={t} />
        </Card>
      </div>

      <div style={{ margin: "24px 0" }}>
        <Card t={t} title={`Skill Terrain — ${goal}`}>
          {analysis.rows.length === 0 ? (
            <p style={{ color: t.textMuted, fontSize: 13 }}>No mapped skills for this goal yet.</p>
          ) : (
            analysis.rows.map((r) => <TerrainBar key={r.skill} skill={r.skill} score={r.score} level={r.level} t={t} />)
          )}
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, margin: "24px 0" }}>
        <PriorityColumn title="🔥 Learn Now" items={analysis.learnNow} t={t} color={t.gap} soft={t.gapSoft} ai={ai} aiStatus={aiStatus} showReason />
        <PriorityColumn title="📈 Learn Next" items={analysis.learnNext} t={t} color={t.accent} soft={t.accentSoft} />
        <PriorityColumn
          title="⏸️ Pause For Now"
          items={analysis.pause}
          t={t}
          color={t.depth}
          soft={t.depthSoft}
          note="Not useless — just already covered, so focus goes elsewhere first."
        />
      </div>

      <div style={{ margin: "24px 0" }}>
        <Card t={t} title="Personalized Roadmap">
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {roadmap.map((phase, i) => (
              <div key={phase.title}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: t.textMuted, marginBottom: 8 }}>{phase.title}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {phase.items.map((it) => (
                    <span
                      key={it.label}
                      style={{
                        fontSize: 12.5,
                        padding: "6px 10px",
                        borderRadius: 6,
                        border: `1px solid ${it.done ? t.depth : t.border}`,
                        color: it.done ? t.depth : t.text,
                        background: it.done ? t.depthSoft : t.bgElevated,
                        textDecoration: it.done ? "line-through" : "none",
                      }}
                    >
                      {it.label}
                    </span>
                  ))}
                </div>
                {i < roadmap.length - 1 && <div style={{ color: t.textFaint, fontSize: 12, marginTop: 10 }}>↓</div>}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card t={t} title="Recommended Project" accentColor={t.accent}>
        {aiStatus === "loading" && <div style={{ color: t.textFaint, fontSize: 13 }}>Generating…</div>}
        {aiStatus !== "loading" && ai?.project ? (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 17 }}>{ai.project.title}</div>
              <Tag color={t.accent} soft={t.accentSoft}>
                {ai.project.difficulty}
              </Tag>
            </div>
            <p style={{ color: t.textMuted, fontSize: 13.5, margin: "8px 0" }}>{ai.project.why}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "8px 0" }}>
              {(ai.project.skills || []).map((s: string) => (
                <Tag key={s} color={t.depth} soft={t.depthSoft}>
                  {s}
                </Tag>
              ))}
            </div>
            <p style={{ color: t.text, fontSize: 13, margin: 0 }}>
              <span style={{ color: t.textFaint }}>Outcome: </span>
              {ai.project.outcome}
            </p>
          </div>
        ) : (
          aiStatus !== "loading" && (
            <p style={{ color: t.textMuted, fontSize: 13 }}>
              Try building something that pairs {analysis.strong[0]?.skill || "a skill you know"} with{" "}
              {analysis.learnNow[0]?.skill || "a skill you're missing"} — that combination closes the biggest gap.
            </p>
          )
        )}
      </Card>

      <p style={{ color: t.textFaint, fontSize: 11.5, marginTop: 28, lineHeight: 1.6 }}>
        Estimated from public GitHub activity only — repositories, languages, topics, and recency. GitHub doesn&apos;t
        capture everything a developer knows, so treat this as a starting point, not a verdict.
      </p>
    </div>
  );
}

function PriorityColumn({
  title,
  items,
  t,
  color,
  soft,
  ai,
  aiStatus,
  showReason,
  note,
}: {
  title: string;
  items: { skill: string; score: number; level: SkillLevel }[];
  t: Theme;
  color: string;
  soft: string;
  ai?: any;
  aiStatus?: "idle" | "loading" | "done" | "error";
  showReason?: boolean;
  note?: string;
}) {
  return (
    <Card t={t}>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{title}</div>
      {note && <div style={{ fontSize: 11.5, color: t.textFaint, marginBottom: 10 }}>{note}</div>}
      {items.length === 0 ? (
        <div style={{ fontSize: 12.5, color: t.textFaint, marginTop: 8 }}>Nothing here right now.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          {items.map((it) => (
            <div key={it.skill}>
              <Tag color={color} soft={soft}>
                {it.skill}
              </Tag>
              {showReason && (
                <div style={{ fontSize: 12, color: t.textMuted, marginTop: 4 }}>
                  {aiStatus === "loading" ? "…" : ai?.learnNowReasons?.[it.skill] || `Limited evidence of ${it.skill} in recent repositories.`}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

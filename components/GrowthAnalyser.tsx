"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CAREER_GOALS,
  CAREER_SKILLS,
  CareerGoal,
  RepoLite,
  buildRoadmap,
  categorize,
  computeRoleFits,
  computeSkills,
  extractUsername,
} from "@/lib/analysis";
import { GithubFetchError, fetchGithub } from "@/lib/github";
import { computeStats } from "@/lib/stats";
import { buildAiPayload, buildFallbackInsights, buildReport } from "@/lib/insights";
import type { GithubEvent, GithubUser, Insights } from "@/lib/types";
import { Icon, LogoMark } from "./ui";
import Landing from "./Landing";
import Results from "./Results";

type ThemeMode = "dark" | "light";
type Stage = "input" | "loading" | "done" | "error";
export type AiStatus = "idle" | "loading" | "done" | "error";

interface Session {
  user: GithubUser;
  repos: RepoLite[];
  events: GithubEvent[];
  fetchedAt: number;
}

class AiRequestError extends Error {
  code: string;
  detail?: string;
  constructor(code: string, detail?: string) {
    super(code);
    this.code = code;
    this.detail = detail;
  }
}

function mergeInsights(ai: Insights, fb: Insights): Insights {
  return {
    headline: ai.headline || fb.headline,
    summary: ai.summary || fb.summary,
    strengths: ai.strengths.length ? ai.strengths : fb.strengths,
    recommendations: ai.recommendations.length ? ai.recommendations : fb.recommendations,
    recommendationSummary: ai.recommendationSummary || fb.recommendationSummary,
    quickWins: ai.quickWins.length ? ai.quickWins : fb.quickWins,
    learnNowReasons: { ...fb.learnNowReasons, ...ai.learnNowReasons },
    project: ai.project || fb.project,
  };
}

function friendlyAiError(e: unknown): string {
  if (e instanceof AiRequestError) {
    if (e.code === "MISSING_API_KEY") return "Gemini isn't set up yet. Add GEMINI_API_KEY to your environment to turn on AI advice.";
    if (e.code === "GEMINI_REJECTED") return `Google rejected the request${e.detail ? `: ${e.detail}` : "."} Check your GEMINI_API_KEY.`;
    if (e.code === "PAYLOAD_TOO_LARGE") return "The profile was too large to send to Gemini.";
  }
  return "Gemini didn't respond. Showing advice computed from your data instead.";
}

export default function GrowthAnalyser() {
  const [mode, setMode] = useState<ThemeMode>("dark");
  const [stage, setStage] = useState<Stage>("input");
  const [username, setUsername] = useState("");
  const [goal, setGoal] = useState<CareerGoal>(CAREER_GOALS[0]);
  const [errorMsg, setErrorMsg] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [ai, setAi] = useState<(Insights & { model?: string }) | null>(null);
  const [aiStatus, setAiStatus] = useState<AiStatus>("idle");
  const [aiError, setAiError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const aiCache = useRef(new Map<string, Insights & { model?: string }>());

  // theme: the inline script in layout.tsx sets data-theme before first paint
  useEffect(() => {
    const current = document.documentElement.dataset.theme;
    if (current === "light" || current === "dark") setMode(current);
  }, []);
  const toggleTheme = useCallback(() => {
    const next: ThemeMode = mode === "dark" ? "light" : "dark";
    setMode(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("ga-theme", next);
    } catch {
      /* storage unavailable — theme still applies for this visit */
    }
  }, [mode]);

  const runAnalysis = useCallback(async (raw: string, refresh = false) => {
    const name = extractUsername(raw);
    if (!name) return;
    // A refresh keeps the dashboard on screen; a first run shows progress on the landing form.
    if (refresh) setRefreshing(true);
    else setStage("loading");
    setErrorMsg("");
    try {
      const { user, repos, events } = await fetchGithub(name);
      setSession({ user, repos, events, fetchedAt: Date.now() });
      setStage("done");
      setRefreshing(false);
      if (!refresh) window.scrollTo({ top: 0 });
    } catch (e) {
      setRefreshing(false);
      setUsername(name);
      setStage("error");
      if (e instanceof GithubFetchError) {
        if (e.code === "NOT_FOUND") setErrorMsg("No GitHub user found with that username. Check the spelling or paste the profile link.");
        else if (e.code === "RATE_LIMIT")
          setErrorMsg(
            `GitHub's API rate limit was hit${e.detail ? ` (${e.detail})` : ""}. Add a GITHUB_TOKEN environment variable to raise the limit from 60 to 5,000 requests an hour.`
          );
        else setErrorMsg(`Couldn't reach GitHub${e.detail ? `: ${e.detail}` : ""}. Try again in a moment.`);
      } else {
        setErrorMsg("Something went wrong. Please try again.");
      }
    }
  }, []);

  // Everything except the AI text is computed locally and instantly, so
  // switching the target role re-renders the dashboard with no network wait.
  const derived = useMemo(() => {
    if (!session) return null;
    const sd = computeSkills(session.repos);
    const analysis = categorize(sd.scores, goal, sd.evidence);
    const roadmap = buildRoadmap(goal, sd.scores);
    const fits = computeRoleFits(sd.scores);
    const stats = computeStats(session.user, session.repos, session.events);
    const inGoal = new Set(CAREER_SKILLS[goal]);
    const extraSkills = sd.skillList.filter((s) => !inGoal.has(s.skill) && s.score >= 25);
    const fallback = buildFallbackInsights(stats, analysis, goal, fits);
    return { analysis, roadmap, fits, stats, extraSkills, fallback };
  }, [session, goal]);

  // Ask Gemini for the written summary + recommendations (re-runs when the role changes)
  useEffect(() => {
    if (!derived || !session) return;
    const key = `${session.user.login}|${goal}|${session.fetchedAt}`;
    const cached = aiCache.current.get(key);
    if (cached) {
      setAi(cached);
      setAiStatus("done");
      setAiError("");
      return;
    }
    const ctrl = new AbortController();
    setAi(null);
    setAiStatus("loading");
    setAiError("");

    const payload = buildAiPayload({
      username: session.user.login,
      goal,
      stats: derived.stats,
      an: derived.analysis,
      fits: derived.fits,
      extraSkills: derived.extraSkills,
      repos: derived.stats.topRepos.map((r) => ({ name: r.name, language: r.language, description: r.description, stars: r.stars })),
      signals: derived.fallback.recommendations.map((r) => `${r.title}: ${r.detail}`),
    });

    fetch("/api/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new AiRequestError(body.error || "UNKNOWN", body.detail);
        return body as Insights & { model?: string };
      })
      .then((body) => {
        aiCache.current.set(key, body);
        setAi(body);
        setAiStatus("done");
      })
      .catch((e) => {
        if (ctrl.signal.aborted) return;
        setAiStatus("error");
        setAiError(friendlyAiError(e));
      });

    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [derived, retryKey]);

  // Gemini's answer wins; any field it left empty is filled from the data-based fallback.
  const insights: Insights | null = derived
    ? aiStatus === "done" && ai
      ? mergeInsights(ai, derived.fallback)
      : derived.fallback
    : null;

  const downloadReport = useCallback(() => {
    if (!derived || !session || !insights) return;
    const md = buildReport({
      name: session.user.name || session.user.login,
      login: session.user.login,
      goal,
      growthScore: derived.analysis.growthScore,
      stats: derived.stats,
      insights,
      an: derived.analysis,
      fits: derived.fits,
    });
    const url = URL.createObjectURL(new Blob([md], { type: "text/markdown" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `growth-report-${session.user.login}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [derived, session, insights, goal]);

  return (
    <div className="app">
      <header className="topbar">
        <button
          className="brand"
          onClick={() => {
            setStage("input");
            setSession(null);
          }}
          aria-label="Growth Analyser home"
        >
          <LogoMark />
          <span className="brand-name">Growth Analyser</span>
        </button>
        <button className="icon-btn" onClick={toggleTheme} aria-label={`Switch to ${mode === "dark" ? "light" : "dark"} theme`}>
          <Icon name={mode === "dark" ? "sun" : "moon"} size={17} />
          <span className="icon-btn-text">{mode === "dark" ? "Light" : "Dark"}</span>
        </button>
      </header>

      {stage !== "done" || !derived || !session || !insights ? (
        <Landing
          username={username}
          setUsername={setUsername}
          goal={goal}
          setGoal={setGoal}
          loading={stage === "loading"}
          error={stage === "error" ? errorMsg : ""}
          onSubmit={() => runAnalysis(username)}
        />
      ) : (
        <Results
          user={session.user}
          goal={goal}
          setGoal={setGoal}
          stats={derived.stats}
          analysis={derived.analysis}
          roadmap={derived.roadmap}
          fits={derived.fits}
          extraSkills={derived.extraSkills}
          insights={insights}
          aiStatus={aiStatus}
          aiError={aiError}
          aiModel={ai?.model}
          onRetryAi={() => setRetryKey((k) => k + 1)}
          onRefresh={() => runAnalysis(session.user.login, true)}
          refreshing={refreshing}
          onDownload={downloadReport}
          onNewSearch={() => {
            setStage("input");
            setSession(null);
          }}
        />
      )}
    </div>
  );
}

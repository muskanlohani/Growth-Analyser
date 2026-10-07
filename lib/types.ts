export interface GithubUser {
  login: string;
  name?: string | null;
  avatar_url?: string | null;
  html_url?: string;
  bio?: string | null;
  company?: string | null;
  location?: string | null;
  blog?: string | null;
  public_repos: number;
  public_gists?: number;
  followers: number;
  following?: number;
  created_at?: string;
}

export interface GithubEvent {
  type: string;
  created_at: string;
  repo?: { name: string };
}

export type Priority = "High" | "Medium" | "Low";

export interface AiRecommendation {
  title: string;
  detail: string;
  priority: Priority;
  category: string;
}

export interface AiProject {
  title: string;
  why: string;
  skills: string[];
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  outcome: string;
  milestones: string[];
}

/**
 * Shape returned by /api/explain (Google Gemini) and also produced by the
 * deterministic fallback in lib/insights.ts, so the UI renders either one.
 */
export interface Insights {
  headline: string;
  summary: string;
  strengths: string[];
  recommendations: AiRecommendation[];
  recommendationSummary: string;
  quickWins: string[];
  learnNowReasons: Record<string, string>;
  project: AiProject | null;
}

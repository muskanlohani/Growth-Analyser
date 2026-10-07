import React from "react";
import { CAREER_GOALS, CareerGoal } from "@/lib/analysis";
import { Contours } from "./charts";
import { Icon } from "./ui";

const INCLUDED = [
  "A match score for each of 9 career paths",
  "Portfolio health across five dimensions",
  "Prioritised advice, point by point and as a summary",
  "A project to build next, with milestones",
];

export default function Landing({
  username,
  setUsername,
  goal,
  setGoal,
  loading,
  error,
  onSubmit,
}: {
  username: string;
  setUsername: (v: string) => void;
  goal: CareerGoal;
  setGoal: (g: CareerGoal) => void;
  loading: boolean;
  error: string;
  onSubmit: () => void;
}) {
  return (
    <main className="landing">
      <Contours className="landing-contours" />
      <div className="landing-grid">
        <div className="landing-copy">
          <h1 className="landing-title">
            Understand where you are.
            <br />
            Discover where to grow.
          </h1>
          <p className="landing-lede">
            Paste a public GitHub profile and pick the role you want. You get a map of your skills, a health check on your
            portfolio, and advice written from what you&apos;ve actually shipped.
          </p>
          <ul className="included">
            {INCLUDED.map((t) => (
              <li key={t}>
                <Icon name="check" size={16} className="included-icon" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <form
          className="start-card"
          onSubmit={(e) => {
            e.preventDefault();
            if (!loading && username.trim()) onSubmit();
          }}
        >
          <div className="field">
            <label htmlFor="gh-user">GitHub username or profile link</label>
            <input
              id="gh-user"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="torvalds or github.com/torvalds"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-invalid={!!error}
              aria-describedby={error ? "start-error" : undefined}
            />
          </div>

          <div className="field">
            <label htmlFor="gh-goal">Target role</label>
            <select id="gh-goal" value={goal} onChange={(e) => setGoal(e.target.value as CareerGoal)}>
              {CAREER_GOALS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <button className="btn btn-primary btn-lg" type="submit" disabled={loading || !username.trim()}>
            {loading ? (
              <>
                <span className="spinner" aria-hidden="true" />
                Reading your GitHub…
              </>
            ) : (
              "Analyze my GitHub"
            )}
          </button>

          {error && (
            <div id="start-error" className="alert alert-error" role="alert">
              <Icon name="alert" size={18} />
              <span>{error}</span>
            </div>
          )}

          <p className="fineprint">
            Only public GitHub data is read and nothing is stored. The result is an estimate from what&apos;s visible on GitHub,
            not a full picture of your experience.
          </p>
        </form>
      </div>
    </main>
  );
}

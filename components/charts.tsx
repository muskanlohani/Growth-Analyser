import React from "react";
import type { Dimension, LanguageSlice, MonthBucket } from "@/lib/stats";

/* ---------- topographic contour background ---------- */

function contourRing(cx: number, cy: number, r: number, seed: number): string {
  const N = 84;
  const pts: string[] = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const wob = 1 + 0.1 * Math.sin(3 * a + seed) + 0.06 * Math.sin(5 * a + seed * 1.7) + 0.03 * Math.sin(9 * a + seed * 0.6);
    pts.push(`${(cx + Math.cos(a) * r * wob * 1.45).toFixed(1)},${(cy + Math.sin(a) * r * wob).toFixed(1)}`);
  }
  return `M${pts.join("L")}Z`;
}

const PEAKS: { cx: number; cy: number; rings: number; step: number; seed: number }[] = [
  { cx: 930, cy: 210, rings: 13, step: 24, seed: 0.8 },
  { cx: 120, cy: 560, rings: 9, step: 22, seed: 2.4 },
];

const CONTOUR_PATHS = PEAKS.flatMap((p, pi) =>
  Array.from({ length: p.rings }, (_, k) => ({
    key: `${pi}-${k}`,
    d: contourRing(p.cx, p.cy, 14 + k * p.step, p.seed + k * 0.07),
    // index lines (every 4th) are a little stronger, like a real survey map
    strong: k % 4 === 0,
  }))
);

export function Contours({ className }: { className?: string }) {
  return (
    <svg className={className ? `contours ${className}` : "contours"} viewBox="0 0 1200 640" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {CONTOUR_PATHS.map((c) => (
        <path key={c.key} d={c.d} className={c.strong ? "contour-line contour-strong" : "contour-line"} />
      ))}
    </svg>
  );
}

/* ---------- trail map: where you are on the way to the target role ---------- */

const TRAIL = { x0: 24, w: 432, y0: 150, rise: 100, amp: 20 };
const trailPoint = (t: number) => ({
  x: TRAIL.x0 + TRAIL.w * t,
  y: TRAIL.y0 - TRAIL.rise * t + TRAIL.amp * Math.sin(Math.PI * 3 * t),
});
const TRAIL_D =
  "M" +
  Array.from({ length: 121 }, (_, i) => {
    const p = trailPoint(i / 120);
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }).join("L");

export function TrailMap({ score, waypoints, goal }: { score: number; waypoints: string[]; goal: string }) {
  const t = Math.max(0.03, Math.min(0.97, score / 100));
  const you = trailPoint(t);
  const end = trailPoint(1);
  const shown = score >= 95 ? [] : waypoints.slice(0, 3);
  const stops = shown.map((label, i) => ({ label, n: i + 1, ...trailPoint(t + ((1 - t) * (i + 1)) / (shown.length + 1)) }));
  return (
    <svg
      className="trail"
      viewBox="0 0 480 200"
      role="img"
      aria-label={`Trail map: you are ${score} percent of the way to ${goal}${shown.length ? `. Next stops: ${shown.join(", ")}` : ""}.`}
    >
      <path d={TRAIL_D} pathLength={100} className="trail-todo" />
      <path d={TRAIL_D} pathLength={100} className="trail-done" style={{ strokeDashoffset: 100 - Math.max(3, score) }} />
      <circle cx={trailPoint(0).x} cy={trailPoint(0).y} r="4" className="trail-start" />
      {stops.map((s) => (
        <g key={s.label} className="trail-stop">
          <title>{s.label}</title>
          <circle cx={s.x} cy={s.y} r="11" />
          <text x={s.x} y={s.y + 4.5} textAnchor="middle">
            {s.n}
          </text>
        </g>
      ))}
      <g className="trail-flag">
        <title>{goal}</title>
        <line x1={end.x} y1={end.y + 4} x2={end.x} y2={end.y - 28} />
        <path d={`M${end.x},${end.y - 28} L${end.x + 22},${end.y - 21} L${end.x},${end.y - 14} Z`} />
      </g>
      <g className="trail-you" transform={`translate(${you.x.toFixed(1)} ${you.y.toFixed(1)})`}>
        <title>You are here</title>
        <circle r="17" className="trail-you-halo" />
        <circle r="8" className="trail-you-dot" />
      </g>
    </svg>
  );
}

/* ---------- radar for the five portfolio dimensions ---------- */

export function Radar({ dims }: { dims: Dimension[] }) {
  const cx = 200;
  const cy = 150;
  const R = 100;
  const n = dims.length;
  const ang = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pt = (i: number, r: number) => ({ x: cx + Math.cos(ang(i)) * r, y: cy + Math.sin(ang(i)) * r });
  const poly = (r: (i: number) => number) => dims.map((_, i) => `${pt(i, r(i)).x.toFixed(1)},${pt(i, r(i)).y.toFixed(1)}`).join(" ");
  return (
    <svg
      className="radar"
      viewBox="0 0 400 300"
      role="img"
      aria-label={`Portfolio health: ${dims.map((d) => `${d.label} ${d.score}`).join(", ")}`}
    >
      {[25, 50, 75, 100].map((p) => (
        <polygon key={p} points={poly(() => (R * p) / 100)} className="radar-ring" />
      ))}
      {dims.map((_, i) => (
        <line key={i} x1={cx} y1={cy} x2={pt(i, R).x} y2={pt(i, R).y} className="radar-axis" />
      ))}
      <polygon points={poly((i) => Math.max(4, (R * dims[i].score) / 100))} className="radar-shape" />
      {dims.map((d, i) => {
        const p = pt(i, Math.max(4, (R * d.score) / 100));
        return <circle key={d.key} cx={p.x} cy={p.y} r="4" className="radar-dot" />;
      })}
      {dims.map((d, i) => {
        const p = pt(i, R + 20);
        const cos = Math.cos(ang(i));
        const anchor = Math.abs(cos) < 0.25 ? "middle" : cos > 0 ? "start" : "end";
        const top = Math.sin(ang(i)) < -0.5;
        return (
          <text key={d.key} x={p.x} y={p.y + (top ? -8 : 4)} textAnchor={anchor} className="radar-label">
            <tspan>{d.label}</tspan>
            <tspan x={p.x} dy="15" className="radar-value">
              {d.score}
            </tspan>
          </text>
        );
      })}
    </svg>
  );
}

/* ---------- language donut ---------- */

export function Donut({ slices, total }: { slices: LanguageSlice[]; total: number }) {
  const r = 58;
  const C = 2 * Math.PI * r;
  const sum = slices.reduce((s, x) => s + x.count, 0) || 1;
  let acc = 0;
  return (
    <svg className="donut" viewBox="0 0 160 160" role="img" aria-label={`${total} languages across your repositories`}>
      <circle cx="80" cy="80" r={r} className="donut-track" />
      <g transform="rotate(-90 80 80)">
        {slices.map((s, i) => {
          const len = (s.count / sum) * C;
          const gap = slices.length > 1 ? 2.5 : 0;
          const el = (
            <circle
              key={s.name}
              cx="80"
              cy="80"
              r={r}
              className={`donut-seg lang-${s.name === "Other" ? "other" : i % 6}`}
              strokeDasharray={`${Math.max(0.5, len - gap)} ${C}`}
              strokeDashoffset={-acc}
            >
              <title>{`${s.name}: ${s.count} repos (${s.pct}%)`}</title>
            </circle>
          );
          acc += len;
          return el;
        })}
      </g>
      <text x="80" y="82" textAnchor="middle" className="donut-num">
        {total}
      </text>
      <text x="80" y="100" textAnchor="middle" className="donut-cap">
        {total === 1 ? "language" : "languages"}
      </text>
    </svg>
  );
}

export const langClass = (name: string, i: number) => `lang-${name === "Other" ? "other" : i % 6}`;

/* ---------- plain HTML bar strips (scale with their container) ---------- */

export function MonthBars({ months }: { months: MonthBucket[] }) {
  const max = Math.max(1, ...months.map((m) => m.count));
  return (
    <div className="bars" role="img" aria-label={`Repositories last pushed per month: ${months.map((m) => `${m.label} ${m.count}`).join(", ")}`}>
      {months.map((m) => (
        <div key={m.key} className="bars-col" title={`${m.label}: ${m.count} ${m.count === 1 ? "repo" : "repos"}`}>
          <span className="bars-count">{m.count || ""}</span>
          <div className="bars-track">
            <div className={m.count ? "bars-fill" : "bars-fill bars-empty"} style={{ height: `${m.count ? Math.max(8, (m.count / max) * 100) : 4}%` }} />
          </div>
          <span className="bars-label">{m.label}</span>
        </div>
      ))}
    </div>
  );
}

export function WeekBars({ days }: { days: number[] }) {
  const labels = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  const max = Math.max(1, ...days);
  return (
    <div className="bars bars-week" role="img" aria-label={`Recent events by weekday: ${days.map((d, i) => `${labels[i]} ${d}`).join(", ")}`}>
      {days.map((d, i) => (
        <div key={i} className="bars-col" title={`${labels[i]}: ${d} events`}>
          <span className="bars-count">{d || ""}</span>
          <div className="bars-track">
            <div className={d ? "bars-fill bars-alt" : "bars-fill bars-empty"} style={{ height: `${d ? Math.max(8, (d / max) * 100) : 4}%` }} />
          </div>
          <span className="bars-label">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

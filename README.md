# Growth Analyser

**Understand where you are. Discover where to grow.**

Growth Analyser analyzes publicly available GitHub activity to provide an estimated
technical skill profile, identify skill gaps, and suggest personalized learning
priorities — grounded in what you've actually shipped, not a generic checklist.

## Features

- **GitHub-based skill detection** — reads your public repos (languages, names,
  descriptions, topics, recency) and scores your exposure to each skill
- **Career-goal skill gap analysis** — pick a target role and see what you're
  already strong in, developing, or missing
- **Learn Now / Learn Next / Pause For Now** — clear, prioritized recommendations,
  each with an AI-generated reason tied to your actual data
- **Personalized 3-phase roadmap** — adapts to skills you already have instead of
  starting everyone from zero
- **AI project recommendation** — a specific project suggestion that targets your
  biggest gap
- **Dark / light mode**, mobile-responsive

## How it works

1. You enter a GitHub username and pick a target career (e.g. Full-Stack Developer)
2. The server reads your public profile and repositories from the GitHub API
   (`/api/github`)
3. Skill scores are computed from language usage, repo names/descriptions/topics,
   and recency — no AI involved in this step, it's deterministic
4. That structured analysis is sent to Claude (`/api/explain`) to generate the
   plain-language summary, gap reasons, and project recommendation — the model
   explains the numbers, it doesn't invent them
5. Results render as a dashboard: growth score, skill terrain, gaps, roadmap

## Tech stack

- [Next.js 14](https://nextjs.org/) (App Router) + React + TypeScript
- GitHub REST API (public data only)
- [Anthropic API](https://docs.anthropic.com/) (Claude) for generated explanations
- No database — fully stateless, nothing is stored server-side

## Screenshots

_Add screenshots here after your first deploy — homepage, results dashboard, and
dark/light mode both look good in a README._

## Getting started locally

```bash
git clone <your-repo-url>
cd growth-analyser
npm install
cp .env.example .env.local   # then fill in ANTHROPIC_API_KEY (see below)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable            | Required | Purpose                                                                                     |
| -------------------- | -------- | --------------------------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`  | Yes      | Powers `/api/explain` — the AI-generated summary, gap reasons, and project pick. Get one at [console.anthropic.com](https://console.anthropic.com/) |
| `GITHUB_TOKEN`       | No       | Raises GitHub's rate limit from 60/hr (unauthenticated, shared across all visitors) to 5,000/hr. A plain personal access token with no special scopes works. Create one at [github.com/settings/tokens](https://github.com/settings/tokens) |

Never commit real values — `.env.local` is gitignored. Use `.env.example` as the
template.

## Deploying to Vercel

1. Push this repo to GitHub (see below if you haven't yet)
2. Go to [vercel.com/new](https://vercel.com/new) and import the repository —
   Vercel auto-detects Next.js, no config needed
3. Before the first deploy (or in Project Settings → Environment Variables
   afterward), add:
   - `ANTHROPIC_API_KEY` — required
   - `GITHUB_TOKEN` — optional but recommended
4. Deploy. You'll get a `*.vercel.app` URL immediately; attach a custom domain
   later from the same settings page if you want one

### Updating after the first deploy

```
Make changes  →  git add .  →  git commit -m "..."  →  git push
```

Vercel automatically rebuilds and redeploys on every push to your default branch.
No manual redeploy step.

## Pushing this to GitHub for the first time

```bash
git init
git add .
git commit -m "Initial commit — Growth Analyser"
git branch -M main
git remote add origin https://github.com/<your-username>/growth-analyser.git
git push -u origin main
```

## Error handling

The app distinguishes and shows a plain-language message for:

- Username doesn't exist (404 from GitHub)
- GitHub rate limit reached (403) — includes a note about adding `GITHUB_TOKEN`
- Network/API errors reaching GitHub or the AI endpoint
- Empty/invalid username input

The AI-generated summary and project recommendation degrade gracefully to a
deterministic, data-based fallback if `/api/explain` fails or is slow — the rest
of the dashboard (skill terrain, gaps, roadmap) never depends on the AI call
succeeding.

## Privacy & limitations

Only publicly available GitHub information is read — no authentication or private
data access. This produces an **estimated** technical profile based on what's
visible on GitHub; it can't capture everything a developer knows (private repos,
work done outside GitHub, non-coding skills, etc.), so treat it as a starting
point rather than a verdict.

## Future improvements

- GitHub OAuth login (to include private repos with consent)
- Save and compare past analyses over time (progress tracking)
- Resume / LinkedIn profile analysis alongside GitHub
- Course recommendations linked to specific gaps
- Job-role matching against real listings

## License

MIT

## Author

Built by Muskan.

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_REPO_PAGES = 3; // up to 300 repositories

async function ghFetch(url: string) {
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return fetch(url, { headers, next: { revalidate: 60 } });
}

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get("username")?.trim();
  if (!username) return NextResponse.json({ error: "Missing username" }, { status: 400 });
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(username)) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const u = encodeURIComponent(username);

  const userRes = await ghFetch(`https://api.github.com/users/${u}`);
  if (userRes.status === 404) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (userRes.status === 403 || userRes.status === 429) {
    const body = await userRes.json().catch(() => ({}));
    return NextResponse.json({ error: "RATE_LIMIT", detail: body.message }, { status: 403 });
  }
  if (!userRes.ok) return NextResponse.json({ error: `HTTP ${userRes.status}` }, { status: 502 });
  const user = await userRes.json();

  // Only read extra pages when the account has more than 100 repos.
  const repoPages = Math.min(MAX_REPO_PAGES, Math.max(1, Math.ceil((user.public_repos || 0) / 100)));
  // Recent public events: one page without a token (saves rate limit), three with one.
  const eventPages = process.env.GITHUB_TOKEN ? 3 : 1;

  const repoRequests = Array.from({ length: repoPages }, (_, i) =>
    ghFetch(`https://api.github.com/users/${u}/repos?per_page=100&sort=pushed&page=${i + 1}`)
  );
  const eventRequests = Array.from({ length: eventPages }, (_, i) =>
    ghFetch(`https://api.github.com/users/${u}/events/public?per_page=100&page=${i + 1}`).catch(() => null)
  );

  const [repoResponses, eventResponses] = await Promise.all([Promise.all(repoRequests), Promise.all(eventRequests)]);

  const firstRepos = repoResponses[0];
  if (firstRepos.status === 403 || firstRepos.status === 429) {
    const body = await firstRepos.json().catch(() => ({}));
    return NextResponse.json({ error: "RATE_LIMIT", detail: body.message }, { status: 403 });
  }
  if (!firstRepos.ok) return NextResponse.json({ error: `HTTP ${firstRepos.status}` }, { status: 502 });

  const repos: unknown[] = [];
  for (const r of repoResponses) {
    if (!r.ok) continue;
    const page = await r.json().catch(() => []);
    if (Array.isArray(page)) repos.push(...page);
  }

  // Events are a bonus: any failure just means "no events", never a failed analysis.
  const events: { type: string; created_at: string; repo?: { name: string } }[] = [];
  for (const r of eventResponses) {
    if (!r || !r.ok) continue;
    const page = await r.json().catch(() => []);
    if (Array.isArray(page)) {
      page.forEach((e: any) => events.push({ type: e.type, created_at: e.created_at, repo: e.repo ? { name: e.repo.name } : undefined }));
    }
  }

  return NextResponse.json({ user, repos, events });
}

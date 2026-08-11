import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

async function ghFetch(url: string) {
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return fetch(url, { headers, next: { revalidate: 60 } });
}

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get("username")?.trim();
  if (!username) return NextResponse.json({ error: "Missing username" }, { status: 400 });

  const userRes = await ghFetch(`https://api.github.com/users/${encodeURIComponent(username)}`);
  if (userRes.status === 404) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (userRes.status === 403) {
    const body = await userRes.json().catch(() => ({}));
    return NextResponse.json({ error: "RATE_LIMIT", detail: body.message }, { status: 403 });
  }
  if (!userRes.ok) return NextResponse.json({ error: `HTTP ${userRes.status}` }, { status: 502 });
  const user = await userRes.json();

  const reposRes = await ghFetch(
    `https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&sort=pushed`
  );
  if (!reposRes.ok) return NextResponse.json({ error: `HTTP ${reposRes.status}` }, { status: 502 });
  const repos = await reposRes.json();

  return NextResponse.json({ user, repos: Array.isArray(repos) ? repos : [] });
}

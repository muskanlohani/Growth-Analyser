import { extractUsername } from "./analysis";

export class GithubFetchError extends Error {
  code: "NOT_FOUND" | "RATE_LIMIT" | "NETWORK_ERROR" | "UNKNOWN";
  detail?: string;
  constructor(code: GithubFetchError["code"], detail?: string) {
    super(code);
    this.code = code;
    this.detail = detail;
  }
}

/**
 * Goes through our own /api/github route rather than calling
 * api.github.com directly from the browser. That lets the server
 * attach an optional GITHUB_TOKEN (set it in Vercel env vars) to get
 * a 5,000/hr rate limit instead of the unauthenticated 60/hr — the
 * limit that kept getting hit during testing.
 */
export async function fetchGithub(rawUsername: string) {
  const username = extractUsername(rawUsername);
  if (!username) throw new GithubFetchError("NOT_FOUND");

  let res: Response;
  try {
    res = await fetch(`/api/github?username=${encodeURIComponent(username)}`);
  } catch (e: any) {
    throw new GithubFetchError("NETWORK_ERROR", e?.message);
  }

  if (res.status === 404) throw new GithubFetchError("NOT_FOUND");
  if (res.status === 403) {
    const body = await res.json().catch(() => ({}));
    throw new GithubFetchError("RATE_LIMIT", body.detail);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new GithubFetchError("UNKNOWN", body.error || `HTTP ${res.status}`);
  }

  const data = await res.json();
  return { user: data.user, repos: Array.isArray(data.repos) ? data.repos : [] };
}

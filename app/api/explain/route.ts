import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const SYSTEM_PROMPT =
  "You are a concise, encouraging developer growth coach. You are given structured GitHub-derived skill analysis data (already computed — do not invent new skills or scores). Respond ONLY with minified JSON, no markdown fences, no extra text, matching exactly this shape: " +
  '{"summary":"2-3 sentence overview","learnNowReasons":{"<skill>":"1 sentence reason, reference their actual data"},"project":{"title":"string","why":"1-2 sentences","skills":["string"],"difficulty":"Beginner|Intermediate|Advanced","outcome":"1 sentence"}}';

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Server is missing ANTHROPIC_API_KEY" }, { status: 500 });
  }

  const payload = await req.json();

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: JSON.stringify(payload) }],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json({ error: `Anthropic API error: ${text}` }, { status: 502 });
    }

    const data = await response.json();
    const textBlock = (data.content || []).find((b: any) => b.type === "text");
    if (!textBlock) return NextResponse.json({ error: "Empty AI response" }, { status: 502 });

    const cleaned = textBlock.text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return NextResponse.json(parsed);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}

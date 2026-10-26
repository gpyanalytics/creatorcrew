import { requireAuth } from "./_auth.js";
import { streamClaude, claudeConfigured } from "../lib/claude.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (!requireAuth(req, res)) return;
  if (!claudeConfigured()) return res.status(503).json({ code: "no_claude_key", message: "ANTHROPIC_API_KEY is not set." });
  const { messages, tier, maxTokens } = req.body || {};
  if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ code: "invalid_request", message: "messages required" });
  const ctl = new AbortController();
  res.on("close", () => { if (!res.writableEnded) ctl.abort(); });
  try {
    await streamClaude({ messages, tier, maxTokens: Math.min(Number(maxTokens) || 4000, 8000) }, res, ctl.signal);
  } catch (e) {
    if (ctl.signal.aborted) return;
    console.error("[claude]", e.message);
    const code = e.status === 429 ? "rate_limited" : e.status === 401 ? "bad_claude_key" : "upstream_error";
    if (!res.headersSent) res.status(502).json({ code, message: e.message });
    else res.end(`\n\n[error: ${e.message}]`);
  }
}

// Thin proxy to the Anthropic Messages API. Keeps the API key on the server.
const API = "https://api.anthropic.com/v1/messages";

function headers() {
  return {
    "content-type": "application/json",
    "x-api-key": process.env.ANTHROPIC_API_KEY,
    "anthropic-version": "2023-06-01",
  };
}

export function claudeConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function pickModel(tier) {
  return tier === "quick"
    ? process.env.CLAUDE_FAST_MODEL || "claude-haiku-5-5"
    : process.env.CLAUDE_MODEL || "claude-sonnet-5-5";
}

// Streams plain-text deltas to `res` as Claude writes them.
export async function streamClaude({ messages, tier, maxTokens = 4000 }, res, signal) {
  const upstream = await fetch(API, {
    method: "POST",
    headers: headers(),
    signal,
    body: JSON.stringify({ model: pickModel(tier), max_tokens: maxTokens, stream: true, messages }),
  });
  if (!upstream.ok) {
    const detail = await upstream.text();
    const err = new Error(`Claude API ${upstream.status}: ${detail.slice(0, 400)}`);
    err.status = upstream.status;
    throw err;
  }
  res.writeHead(200, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-cache", "x-accel-buffering": "no" });
  const decoder = new TextDecoder();
  let buffer = "";
  let stopReason = null;
  for await (const chunk of upstream.body) {
    buffer += decoder.decode(chunk, { stream: true });
    let idx;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const event = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const dataLine = event.split("\n").find((l) => l.startsWith("data:"));
      if (!dataLine) continue;
      let data;
      try { data = JSON.parse(dataLine.slice(5).trim()); } catch { continue; }
      if (data.type === "content_block_delta" && data.delta?.type === "text_delta") res.write(data.delta.text);
      else if (data.type === "message_delta" && data.delta?.stop_reason) stopReason = data.delta.stop_reason;
      else if (data.type === "error") res.write(`\n\n[error: ${data.error?.message || "stream error"}]`);
    }
  }
  if (stopReason === "max_tokens") res.write("\n\n[cut short: reached the length limit]");
  res.end();
}

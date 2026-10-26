// Gemini Omni Flash through Google's Interactions API. Docs: https://ai.google.dev/gemini-api/docs/omni
const BASE = "https://generativelanguage.googleapis.com/v1beta";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function gfetch(url, init = {}) {
  const headers = { "x-goog-api-key": process.env.GEMINI_API_KEY, ...(init.body ? { "content-type": "application/json" } : {}) };
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    let msg = await res.text();
    try { msg = JSON.parse(msg).error?.message || msg; } catch {}
    const err = new Error(`Gemini API ${res.status}: ${String(msg).slice(0, 400)}`);
    err.status = res.status;
    throw err;
  }
  return res;
}

function buildBody(prompt, seconds, aspectRatio, background) {
  const dur = Math.max(3, Math.min(10, Math.round(Number(seconds) || 6)));
  return {
    model: process.env.GEMINI_VIDEO_MODEL || "gemini-omni-1.1-flash",
    // Omni likes multi-scene stories; a storyboard scene should be one shot.
    input: `${prompt}\n\nA single continuous ${dur}-second shot, no scene cuts. No on-screen text, captions or logos. No dialogue.`,
    response_format: { type: "video", aspect_ratio: aspectRatio === "16:9" ? "16:9" : "9:16", resolution: process.env.GEMINI_VIDEO_RESOLUTION || "720p" },
    ...(background ? { background: true, store: true } : { store: false }),
  };
}

// Starts a clip. With background mode Google answers at once with an id to poll;
// if background mode is refused, falls back to waiting for the finished clip in this call.
export async function startClip({ prompt, seconds, aspectRatio }) {
  try {
    const r = await gfetch(`${BASE}/interactions`, { method: "POST", body: JSON.stringify(buildBody(prompt, seconds, aspectRatio, true)) });
    return await r.json();
  } catch (e) {
    if (e.status === 400 && /background|store/i.test(e.message)) {
      const r = await gfetch(`${BASE}/interactions`, { method: "POST", body: JSON.stringify(buildBody(prompt, seconds, aspectRatio, false)) });
      return await r.json();
    }
    throw e;
  }
}

export async function getInteraction(id) {
  return (await gfetch(`${BASE}/interactions/${encodeURIComponent(id)}`)).json();
}

export function findVideo(interaction) {
  if (interaction?.output_video && (interaction.output_video.data || interaction.output_video.uri)) return interaction.output_video;
  const stack = [interaction];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== "object") continue;
    if ((node.type === "video" || String(node.mime_type || "").startsWith("video/")) && (node.data || node.uri)) return node;
    for (const v of Object.values(node)) if (v && typeof v === "object") stack.push(v);
  }
  return null;
}

export async function videoBytes(video) {
  if (video.data) return Buffer.from(video.data, "base64");
  const fileId = (String(video.uri).match(/files\/([^/:?]+)/) || [])[1];
  if (!fileId) throw new Error(`Unrecognised video link from Gemini: ${video.uri}`);
  for (let i = 0; i < 40; i++) {
    const info = await (await gfetch(`${BASE}/files/${fileId}`)).json();
    const state = info.state?.name || info.state;
    if (state === "ACTIVE") break;
    if (state === "FAILED") throw new Error("Google reported the video file as failed.");
    await sleep(5000);
  }
  const dl = await gfetch(`${BASE}/files/${fileId}:download?alt=media`);
  return Buffer.from(await dl.arrayBuffer());
}

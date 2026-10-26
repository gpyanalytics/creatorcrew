import { put } from "@vercel/blob";

// Indirection so tests can swap the uploader.
export const deps = { put };
import { requireAuth } from "./_auth.js";
import { startClip, getInteraction, findVideo, videoBytes } from "../lib/omni.js";

// POST {prompt, seconds}  → {status:"running", id} or {status:"done", url}
// GET  ?id=...            → same shape; the page polls until done or failed
export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;
  if (!process.env.GEMINI_API_KEY) return res.status(503).json({ code: "no_gemini_key", message: "GEMINI_API_KEY is not set." });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(503).json({ code: "no_blob", message: "Connect a Vercel Blob store to this project (Storage tab), then redeploy." });
  try {
    if (req.method === "POST") {
      const { prompt, seconds, aspectRatio } = req.body || {};
      if (!prompt || typeof prompt !== "string") return res.status(400).json({ code: "invalid_request", message: "prompt required" });
      return res.json(await settle(await startClip({ prompt: prompt.slice(0, 4000), seconds, aspectRatio })));
    }
    if (req.method === "GET") {
      const id = String(req.query.id || "");
      if (!/^[\w.\-]{1,200}$/.test(id)) return res.status(400).json({ code: "invalid_request", message: "bad id" });
      return res.json(await settle(await getInteraction(id)));
    }
    res.status(405).end();
  } catch (e) {
    console.error("[video]", e.message);
    res.status(502).json({ code: e.status === 429 ? "rate_limited" : "video_failed", message: e.message });
  }
}

async function settle(interaction) {
  const status = interaction.status;
  if (status === "failed" || status === "cancelled") {
    return { status: "failed", error: interaction.error?.message || "Gemini could not make this clip (it may have been blocked by a safety filter)." };
  }
  const video = findVideo(interaction);
  if (!video) {
    if (status === "completed") return { status: "failed", error: "Gemini finished but returned no video. The prompt may have been blocked by a safety filter." };
    return { status: "running", id: interaction.id };
  }
  const bytes = await videoBytes(video);
  const blob = await deps.put(`clips/${String(interaction.id || "clip").replace(/[^\w-]/g, "")}.mp4`, bytes, {
    access: "public",
    contentType: video.mime_type || "video/mp4",
    addRandomSuffix: true,
  });
  return { status: "done", url: blob.url };
}

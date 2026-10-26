import { authorized } from "./_auth.js";

export default function handler(req, res) {
  const ok = authorized(req);
  res.json({
    passwordSet: Boolean(process.env.APP_PASSWORD),
    authorized: ok,
    // Only reveal setup status to someone who knows the password.
    claude: ok && Boolean(process.env.ANTHROPIC_API_KEY),
    gemini: ok && Boolean(process.env.GEMINI_API_KEY),
    blob: ok && Boolean(process.env.BLOB_READ_WRITE_TOKEN),
  });
}

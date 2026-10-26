// Every API route is behind APP_PASSWORD, because a public URL could otherwise spend your API credits.
import crypto from "node:crypto";

export function authorized(req) {
  const pw = process.env.APP_PASSWORD;
  if (!pw) return false;
  const got = Buffer.from(String(req.headers["x-app-password"] || ""));
  const want = Buffer.from(pw);
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

export function requireAuth(req, res) {
  if (!process.env.APP_PASSWORD) {
    res.status(503).json({ code: "no_password", message: "Set APP_PASSWORD in your Vercel environment variables, then redeploy." });
    return false;
  }
  if (!authorized(req)) {
    res.status(401).json({ code: "unauthorized", message: "Wrong or missing password." });
    return false;
  }
  return true;
}

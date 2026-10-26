# Creator Crew on Vercel (free Hobby plan)

Your multi-agent studio for Instagram and YouTube, hosted on Vercel at a link you can open from your phone or laptop.
Claude writes for the agents; Google's **Gemini Omni Flash** turns each storyboard scene into a 9:16 clip that plays
inside the Instagram Reel, Instagram post, YouTube Shorts and YouTube Live previews.

## Deploy (about 10 minutes, no terminal needed)

1. **Put the code on GitHub.** Create a new private repository and upload this folder's files (drag and drop works on github.com).
2. **Import into Vercel.** On vercel.com → Add New → Project → pick the repo. Framework preset: **Other**. Leave the build settings empty and deploy.
3. **Add a Blob store for clips.** In the project → **Storage** → Create → **Blob** → choose **public** access → connect it to the project. This adds `BLOB_READ_WRITE_TOKEN` for you.
4. **Add environment variables** (Settings → Environment Variables):
   - `APP_PASSWORD`: any password. You'll type it once per browser to open the studio.
   - `ANTHROPIC_API_KEY`: from https://console.anthropic.com
   - `GEMINI_API_KEY`: from https://aistudio.google.com/apikey (video needs billing on the key's Google Cloud project)
5. **Redeploy** (Deployments → ⋯ → Redeploy) so the new variables take effect, then open your `*.vercel.app` link.

Prefer the terminal? `npm i -g vercel`, then `vercel` in this folder, and add the same variables with `vercel env add`.

## Using it

1. Fill in **My profile** once. Every agent reads it.
2. In **Studio**, run the **See it before I film** crew, or ask the Producer to "show me how it looks".
3. In the Visual Director's preview, press **Generate clip** on a scene, or **Generate all scenes**. You confirm before anything is billed.
4. Clips are stored in your Blob store and linked into the run, so they replay from the **Library**.

## What's free and what isn't

- **Vercel Hobby: free.** It can't bill you; if you hit a limit, the feature pauses instead. Note that Vercel's Hobby plan is meant for personal, non-commercial projects. If this becomes part of paid brand work, check Vercel's terms or move to Pro.
- **Vercel Blob: free up to the Hobby limits** (about 1 GB stored). A 720p clip is a few MB, so roughly a couple of hundred clips fit. Delete old ones from the Storage tab when needed.
- **Gemini Omni clips: billed by Google** to your API key's project. Pricing: https://ai.google.dev/gemini-api/docs/pricing
- **Claude (text agents): billed by Anthropic** per use of your API key, separately from any Claude.ai plan.

## How it fits together

```
public/index.html   the studio; profile + library saved in your browser
api/claude.js       streams Claude's replies (key stays on Vercel)
api/video.js        starts a Gemini Omni clip, polls it, saves the .mp4 to Vercel Blob
api/health.js       tells the page what's configured
api/_auth.js        APP_PASSWORD check on every API call
lib/omni.js         Gemini Interactions API client
```

Each clip request runs in Google's background mode and the page polls every few seconds, so no single Vercel
function has to wait out a whole generation (Hobby functions stop at 5 minutes).

## Good to know

- Your profile and saved runs live in the browser you use. Open the studio on another device and you'll start with an empty library (clips themselves stay in Blob).
- Clip links are public but unguessable. Anyone you send a clip link to can watch it.
- Generated videos carry Google's invisible SynthID watermark. Instagram may label AI-generated content; disclose it where the platform asks.

# Deploying TV ROOM GAGA on Vercel

1. Import the GitHub repository and select **Next.js**, not a static-site framework.
2. Keep the repository root as the root directory. Use `pnpm build` as the build command; do not replace it with `next export` or direct `next build`.
3. Do not add a catch-all rewrite to `/index.html`. `/api/*` must run as Next.js server functions, not return the website's HTML.
4. Redeploy after pulling these fixes. If a stale override remains, remove it from the project's Build & Development Settings.

`vercel.json` supplies the framework and build command. Music and YouTube resolver functions allow up to 60 seconds (subject to your Vercel plan). Upstream failures return JSON errors instead of uncaught parser failures.

## Secure media links

No manually supplied secret is required to start. The build generates a private random signing/encryption key that is included only in server bundles, so separate serverless instances in the same deployment can open the same media links. `.generated/` must never be committed or served publicly.

For stable links across redeployments, optionally configure a strong, random `SESSION_SECRET` in Vercel's encrypted environment-variable settings and redeploy. Never put it in Git, a `NEXT_PUBLIC_*` variable, or chat. Replit secrets do not automatically transfer to Vercel.

## Full songs and music videos

Home and Music play buttons request full audio by default. Chart samples remain discovery metadata, not a fallback for a failed full-song request. The full-media resolver handles both the direct YouTube downloader endpoints and keyword endpoints, validates actual media responses, and supports the API's `download`, `dl_url`, `dl`, and native audio/video response fields.

Open **Media downloader → YouTube Media Tools** to paste a YouTube link or type a song/artist. Select a result to play full audio, watch its video inside the website, or download either format. Video carries the TV ROOM GAGA watermark. External media can still be removed, denied, or unavailable; the app reports failure rather than substituting a short preview.

Downloads and playback are relayed through opaque same-origin links. Only configured media/CDN hosts are accepted, including validated redirects. Use these tools only for material you are authorized to access or save.

## Background video watermarking

Replit’s connected Shotstack account works in the Replit runtime through its connectors SDK. That runtime identity does **not** automatically transfer to Vercel. For Vercel, add your production Shotstack credential as the encrypted, server-only `SHOTSTACK_API_KEY` environment variable, then redeploy. Do not use a `NEXT_PUBLIC_` name or commit it. The app uses production `/edit/v1`, not sandbox credentials.

Without a working connection/credential, watermark processing returns an explicit error; it never silently offers the original unbranded video instead. Shotstack performs the long render outside the server function. The browser polls short status requests, then downloads the output through the existing secure media relay. Set account-level usage controls before broadly enabling this paid feature on the authentication-free public app; local browser/server-instance limits are not a global spending cap.

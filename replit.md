# TV Room GAGA

Imported Next.js 15 App Router / React 19 app. Keep the existing structure and stack.

## Run and verify

- Managed workflow **TV Room** serves the optimized build with `pnpm start` on `0.0.0.0:5000` for fast navigation. Build before restart after code changes; temporarily use `pnpm dev` when hot reload is needed.
- `pnpm typecheck`, `pnpm test`, and `pnpm build` verify types, normalization/security/fallback behavior, and production compilation.
- `node tests/browser-check.cjs` checks the unified library, series/anime episodes, page sizes, responsive routes, splash and real live TV. It needs Chromium and external services. Generated output belongs in ignored `generated-artifacts/`.
- Do not run build and dev concurrently against the same `.next` directory.
- Keep Tailwind scanning explicit to `app`, `components` and `styles`; root scanning can repeatedly rebuild the imported workspace and truncate hydration JS.
- Detailed web/development documentation: `docs/WEB.md`. Public guide: `/docs`.

## Product rules

- No authentication gate. Playlists and download history stay browser-local, not cross-device.
- Keep the interface compact and responsive across phones, tablets and desktops.
- Do not display movie integration names, selection controls, native request forms or upstream URLs in the customer interface. The server automatically tries compatible alternate connections.
- The library has the requested genre collections, separate movie/series/anime controls, and page sizes 12/24/36.
- Show known seasons and episodes for series/anime. Use actual resource counts; never invent unavailable seasons or unlock paid episodes.
- Downloads must be real files, not trailers or manifests renamed to MP4. The browser controls saving to the device.
- Use full country names and flags for TV country selection.
- Creator website: `https://traxxiontech.com`.
- Keep the user-supplied TV Room GAGA logo. Splash auto-enters after four seconds even with reduced motion; only animation is reduced.
- Use MovieBox-pro as the default movie/series integration, with automatic compatible fallbacks. Task IDs and origins remain server-side/opaque.
- Media playback displays the text TV ROOM GAGA without exposing stream links in the controls.
- Music must use real latest/current-chart data and explicit preview labels; do not reintroduce fabricated tracks or save previews as full-song downloads.

## Server integration and security

Server-only adapters remain in `lib/providers/`; `lib/library/` handles normalized public discovery, same-title fallbacks and opaque routing. The public integration-inspection and gateway endpoints were removed. `/api/library` provides list/detail/stream operations without revealing integration identifiers.

`SESSION_SECRET` authenticates and encrypts opaque title/media/caption keys. Never expose its value or upstream signed URLs. `/api/media` streams allowlisted files, handles byte ranges, and rewrites HLS child URLs; `/api/subtitle` converts captions. Do not forward upstream Content-Length after automatic decompression.

The supplied DramaBox host strings contained two concatenated origins. The adapter uses the actual API origin. Read-only API integrations are not an entitlement system: locked chapters stay locked, and invalid/denied stream URLs are not bypassed.

The social downloader still uses its server-only adapter and public platform inputs. Never simulate a completed media transfer. Some external catalogue/resolver services return HTTP 403 or unavailable files even when title metadata works; report those limitations honestly.

Use content the user is authorized to access. No login does not mean unrestricted content rights.

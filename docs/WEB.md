# TV Room GAGA web documentation

## Using the website

The public guide is available at `/docs`. It covers searching, categories, page sizes, seasons and episodes, live TV country selection, playback, downloads, and browser-local playlists.

- `/` is the branded welcome screen. It opens the room after four seconds, including with reduced motion; Enter opens it immediately.
- `/home` is the compact entertainment starting page.
- `/movies`, `/discover`, and `/search` share the unified movie and series library.
- `/live-tv` and `/channels` share the live television player and country/category filters.
- `/music` and `/playlists` retain browser-local music features.
- `/download` and `/downloader` provide the local download history and media tools.

The app has no sign-in requirement. Catalogue entries and stream availability are independent: not every listed title has a downloadable file.

## Development

Use Node.js and pnpm:

```sh
pnpm dev
pnpm typecheck
pnpm test
pnpm build
```

The `TV Room` workflow serves the optimized build with `pnpm start` on `0.0.0.0:5000` to avoid development-time compilation on navigation. After code changes, rebuild before restarting. For active hot-reload development, temporarily use `pnpm dev`. Never build and run dev concurrently against the same `.next` folder.

## Library architecture

`lib/providers/` contains the server-only integrations and response normalization. `lib/library/` coordinates catalogue fallback, editorial categories, same-title matching, episode resources and encrypted media routing.

Public library calls go through `/api/library`:

| Action | Inputs | Output |
| --- | --- | --- |
| `list` | `q`, `category`, `type`, `page`, `limit` | Bounded list of display metadata and opaque title keys |
| `detail` | `key` | Title metadata, known seasons, episode counts/entries and audio editions |
| `stream` | `key`, `season`, `episode`, optional `chapter` and `retry` | Verified playable sources and downloadable file links |

Page sizes are 12, 24 or 36. Genre collections use real catalogue section metadata, checked against detailed title genres where available because section headings can be inaccurate. Where section coverage is missing, family, sci-fi and cartoon collections use editorial title searches and include only real returned records, never invented titles. These collections are not a parental-control or ratings system.

Failed compatible requests fall back to another connection. Sources use the same subject ID where shared, or a verified normalized title and release year. A series is not replaced by a film of the same name. Locked episodes stay locked. A temporary failure is cached briefly per integration/action to avoid repeatedly waiting for a known outage.

Task-based search records retain their task identifier and original parameter spelling inside the encrypted title key. Download preparation follows a same-origin status URL returned by the service, or repeats its documented download action with the task identifier. Polling is bounded. Pending tasks survive transient errors briefly on the server, so Check progress resumes a job rather than creating duplicates. Ready direct-file URLs also work without starting a task.

The movie, live-TV, legacy video and music players display TV ROOM GAGA branding. Video overlays remain inside the web fullscreen container. Playback controls do not offer a raw stream link. Branding is a web overlay, not a watermark burned into downloaded files.

## Music

The music page shows real current-chart records, ordered by supplied release date, and live search results through the existing music integration. It never fabricates replacement tracks. Chart listening samples are labeled Preview and start without waiting for full-song processing. Play full song and Download full song use a separate title/artist lookup and audio resolver; the listening sample itself is never saved as a full song. The branded player stays visible while listening. Audio formats retain their native file extension. A full file may still be unavailable when the corresponding sample works.

Home also has a Trending songs section with song/artist search, eight cards, preview/full playback, downloads, and a reset-to-trending control. Trending preserves the real chart rank; the Music page's latest feed sorts those records by release date.

## Stream resolution and recovery

Opening a movie card searches its displayed title through the preferred movie search endpoint, verifies title/year/type identity, and prepares playback/download buttons directly in the Home library. A card does not automatically save a large file: the user chooses Download. When the API supplies both originalStreamUrl and a gateway streamUrl, the original is preferred and file MIME/byte-range availability is checked. Provider requests use a compatible browser User-Agent; a short branded agent can receive an upstream 1010/403 rejection.

Live TV uses encrypted same-origin relay URLs, including HLS child playlists, encryption keys and media segments. Relay redirects are revalidated, private/reserved IPs are rejected, and public DNS results are pinned into the TLS connection to prevent DNS rebinding. No arbitrary URL proxy is exposed. Players attempt alternate sources automatically, recover one HLS media error, and avoid choosing unsupported DASH before ordinary video sources. An offline or geo-restricted channel may still be unavailable.

Streaming connection deadlines stop after response headers arrive; they do not truncate a full movie body after fifteen seconds. Video and HLS relay links last six hours to accommodate long playback sessions.

## Source confidentiality and transfers

Customer pages never show integration names, native action forms or upstream media URLs. Legacy public integration-inspection/gateway routes have been removed.

Server code encrypts and authenticates opaque title/media keys with AES-256-GCM. If `SESSION_SECRET` is configured, it is used; otherwise the build creates a cryptographically random, server-only key shared by every function in that build. No secret is sent to clients or checked into Git. Title keys expire after one day; long-media links last six hours. A new build rotates the automatic key, so previously issued links must be refreshed.

`/api/media` accepts an authenticated opaque key, validates the media host, validates each redirect, forwards single byte ranges for playback, and streams file bodies instead of buffering an entire movie. HLS manifests are rewritten so their child requests also use opaque routes. Caption requests go through SRT-to-VTT conversion. Downloadable files use an attachment response; HLS/DASH playlists are never represented as complete MP4 downloads.

A public, authentication-free site is not a DRM or entitlement system. Opaque URLs can be shared while valid. This routing hides integration details and prevents arbitrary proxy targets; it does not grant rights to content or override upstream access controls.

The browser decides the destination for a download. The website cannot silently select arbitrary folders or write directly into a phone's storage without browser permission. Safari and mobile operating systems may show a save/share prompt.

## Reliability

Movie source resolution starts the preferred connection first, tries compatible same-subject connections after 700 milliseconds, and starts verified title/year/type alternatives after 1.2 seconds if needed. Empty results, failed media probes and stream-only playlists do not prevent another connection from finding a downloadable file. Task-preparation responses are retained if no alternate file succeeds; locked short-drama chapters never trigger title-based bypasses. If no file exists but a playable adaptive stream does, playback can still use it; download requests never mislabel that playlist as an MP4.

Client requests show pending states immediately, cancel stale requests, and time out with a retry action. Lists and normalized metadata use short-lived caches. Movie files are probed before links are offered, and playback still reports media-host errors honestly. External services can be offline, geo-restricted, or return expired/denied files.

The catalogue keeps up to eight recent views in browser storage for thirty minutes. A loaded app can show these during a connection outage and retries the catalogue when the network returns. This is metadata caching, not offline movie storage: uncached streams, searches and downloads require an internet connection.

Search/download actions prioritize the Nayan endpoints, including playlist lookup, YouTube search, YouTube media resolution, and platform-specific social endpoints. The older downloader services are retained as fallback and are also tried if the preferred services respond too slowly. Silent adaptive video-only formats are not advertised as complete videos.

Download actions check the secured file endpoint before handing an attachment to the browser. A failed download URL can fall back to the playable file for the same title. The site does not hold an entire movie in a JavaScript Blob and does not simulate download completion or invent transfer speeds. Once handed off, the browser owns progress, pause/resume and the save location.

`TV ROOM GAGA` is displayed directly over the visible video area, including container fullscreen. The playback overlay does not alter media bytes. Movie-library downloads save the original file immediately after checking availability, without watermark processing. Other video downloader tools still use the background watermarked export flow described below. Audio-only downloads remain direct.

Trending song picks, new music discovery and song searches use Nayan’s YouTube search endpoints, including keyword, pasted video link and playlist lookup. They do not silently switch to Apple chart samples if search fails. Trending picks are discovery results, not a verified ranked chart. Play/download actions resolve full files, not short previews.

## Background watermarked exports

The connected Shotstack account is used through the server-only Replit connectors SDK. `POST /api/video-exports` accepts only signed original-video keys and same-origin confirmed requests. The server probes dimensions/duration, preserves aspect ratio (up to 1920 pixels per edge), uses the full source duration and retains its audio. It does not bypass source access controls. Live/adaptive streams are not exportable here.

The **Watermarked videos** panel polls render status and offers the processed file only when rendering finishes. Jobs survive page changes and reloads in the same browser through local storage for 23 hours. Submission needs the tab open until confirmed; rendering itself continues on Shotstack after the tab closes. Temporary render files expire after 24 hours; save completed files promptly. No unbranded original is substituted when processing fails. Removing a queue item does not cancel or refund the remote render. Original signed URLs may expire before the processor fetches them.

Render credentials, upstream URLs and render IDs stay server-side; the browser receives purpose-scoped opaque job/file tokens. These are bearer capabilities, not account authentication. Clearing browser storage loses the local job list. Blocked storage prevents job submission rather than risking an untracked paid job. Submission interrupted before confirmation has an unknown outcome; check the processor account before retrying.

Limits: three pending jobs per browser, ten submissions/hour per running server instance, six-hour maximum source duration. In-memory deduplication/limits are **not** durable global billing protection across serverless instances or restarts. Configure account-level usage controls before opening public paid processing broadly; rendering, hosting, and transfer incur provider costs. The app remains authentication-free.

Respect copyright and only access/download content you are authorized to use. Never fabricate a successful download, replace a full film with a trailer, edit a signature, or bypass a locked episode.

## Advertising

The root document includes the Adcash library once in its head (`https://acscdn.com/script/aclib.js`, element id `aclib`) and initializes AutoTag zone `txhkagiska` once after the library is ready. Loading is asynchronous so a blocked advertising server does not hold up the app. Client-side navigation does not duplicate the tag. Ad blockers or failed network requests can prevent ads from appearing without breaking media controls.

This connects the supplied advertising zone; it does not verify account/domain approval or guarantee impressions, revenue, payment eligibility or ad availability. The publisher must configure appropriate ad categories and any required consent/privacy controls for the countries and audiences served. Advertising data practices are disclosed on `/privacy`.

## Creator

Created by Vincent Ganiza / Traxxion Tech: <https://traxxiontech.com>.

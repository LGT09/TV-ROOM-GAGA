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

The existing `SESSION_SECRET` is used only by server code to encrypt and authenticate opaque title/media keys with AES-256-GCM. It is never sent to clients. Title keys expire after one day; file/caption links after 30 minutes. Changing the secret invalidates existing links.

`/api/media` accepts an authenticated opaque key, validates the media host, validates each redirect, forwards single byte ranges for playback, and streams file bodies instead of buffering an entire movie. HLS manifests are rewritten so their child requests also use opaque routes. Caption requests go through SRT-to-VTT conversion. Downloadable files use an attachment response; HLS/DASH playlists are never represented as complete MP4 downloads.

A public, authentication-free site is not a DRM or entitlement system. Opaque URLs can be shared while valid. This routing hides integration details and prevents arbitrary proxy targets; it does not grant rights to content or override upstream access controls.

The browser decides the destination for a download. The website cannot silently select arbitrary folders or write directly into a phone's storage without browser permission. Safari and mobile operating systems may show a save/share prompt.

## Reliability

Client requests show pending states immediately, cancel stale requests, and time out with a retry action. Lists and normalized metadata use short-lived caches. Movie files are probed before links are offered, and playback still reports media-host errors honestly. External services can be offline, geo-restricted, or return expired/denied files.

Respect copyright and only access/download content you are authorized to use. Never fabricate a successful download, replace a full film with a trailer, edit a signature, or bypass a locked episode.

## Creator

Created by Vincent Ganiza / Traxxion Tech: <https://traxxiontech.com>.

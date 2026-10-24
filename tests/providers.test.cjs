const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const ts = require("typescript")
const cache = new Map()
function load(file) {
  file = path.resolve(file)
  if (cache.has(file)) return cache.get(file)
  const module = { exports: {} }
  cache.set(file, module.exports)
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  const requireLocal = (id) => id === "server-only" ? {} : id.startsWith(".") ? load(path.resolve(path.dirname(file), id + ".ts")) : require(id)
  new Function("require", "module", "exports", code)(requireLocal, module, module.exports)
  return module.exports
}
const { normalizeProvider } = load("lib/providers/normalize.ts")
const { parseM3u } = load("lib/providers/iptv.ts")
const { allowedMediaUrl } = load("lib/providers/media-url.ts")
const { providers } = load("lib/providers/registry.ts")
const { runProvider } = load("lib/providers/service.ts")

test("all 28 requested Omega routes, plus MovieBox, DramaBox and npm provider are registered", () => {
  assert.equal(providers.length, 31)
  assert.equal(new Set(providers.map(p => p.id)).size, 31)
  assert.equal(providers.find(p => p.id === "omega-MoviesTv").route, "MovieTV")
})
test("MovieBox discovery preserves large subject IDs and nested sections", () => {
  const d = normalizeProvider({ sections: [{ items: [{ subject_id: "8906247916759695608", name: "Avatar", slug: "avatar-WLDIi21IUBa", poster_url: "https://cdn.example/poster.jpg" }] }] }, "moviebox")
  assert.equal(d.items[0].id, "8906247916759695608")
  assert.equal(d.items[0].detailPath, "avatar-WLDIi21IUBa")
  assert.equal(d.sources.length, 0)
})
test("quality responses become real sources, never title pages, covers or trailers", () => {
  const d = normalizeProvider({ data: { sources: [{ resolution: "1080p", url: "https://cdn.example/film.mp4" }], subject: { title: "Film", id: "1", url: "https://site.example/title", trailer: { url: "https://cdn.example/trailer.mp4" }, cover: { url: "https://cdn.example/image.jpg" } } } }, "moviebox")
  assert.equal(d.sources.length, 1)
  assert.equal(d.sources[0].quality, "1080p")
  assert.equal(d.sources[0].format, "MP4")
})
test("subtitle languages and SRT conversion URLs are preserved", () => {
  const d = normalizeProvider({ captions: [{ lan: "en", lanName: "English", url: "https://cacdn.hakunaymatata.com/test.srt" }] }, "moviebox")
  assert.equal(d.subtitles[0].language, "en")
  assert.equal(d.subtitles[0].label, "English")
  assert.ok(d.subtitles[0].proxyUrl.startsWith("/api/subtitle?url="))
})
test("seasons and audio editions normalize from actual MovieBox resource response", () => {
  const d = normalizeProvider({ resources: { seasons: [{ season: 2, max_episodes: 13 }] }, audio_tracks: [{ subject_id: "1382465867459478920", slug: "breaking-bad-hindi-mz0TdRUH7E1", name: "Hindi" }] }, "moviebox")
  assert.equal(d.seasons[0].episode_count, 13)
  assert.equal(d.audioTracks[0].id, "1382465867459478920")
})
test("DramaBox details do not automatically play all chapters or unlock paid content", () => {
  const d = normalizeProvider({ book: { id: "123", title: "Drama" }, episodes: [{ id: "1", index: 0, unlock: true, video_url: "https://example.com/one.mp4" }, { id: "2", index: 1, unlock: false, video_url: "https://example.com/two.mp4" }] }, "dramabox")
  assert.equal(d.episodes[0].episode, 1)
  assert.equal(d.episodes[1].locked, true)
  assert.equal(d.sources.length, 0)
})
test("M3U parser associates attributes with HTTPS URLs, excluding mixed content", () => {
  const d = parseM3u('#EXTM3U\n#EXTINF:-1 tvg-id="Test.us@HD" tvg-logo="https://example.com/logo.png" group-title="News",Test TV (720p)\n#EXTVLCOPT:http-user-agent=agent\nhttps://example.com/test.m3u8\n#EXTINF:-1 tvg-id="Unsafe.us",Unsafe\nhttp://127.0.0.1/test\n')
  assert.equal(d.length, 1)
  assert.equal(d[0].id, "Test.us")
  assert.equal(d[0].country, "US")
  assert.equal(d[0].category, "news")
  assert.equal(d[0].streams[0].quality, "720p")
})
test("media proxies cannot fetch arbitrary URLs or credentials", () => {
  for (const url of ["http://127.0.0.1", "https://127.0.0.1", "https://example.com", "https://hakunaymatata.com.evil.example/file", "https://user:pass@cacdn.hakunaymatata.com/file", "https://cacdn.hakunaymatata.com:5000/test"]) assert.throws(() => allowedMediaUrl(url))
  assert.equal(allowedMediaUrl("https://cacdn.hakunaymatata.com/subtitle/test.srt").hostname, "cacdn.hakunaymatata.com")
})
test("provider routing validates unknown provider, slug paths and query inputs", async () => {
  await assert.rejects(runProvider("not-real", "home", new URLSearchParams()), /Unknown provider/)
  await assert.rejects(runProvider("moviebox", "stream", new URLSearchParams({ id: "../private" })), /Invalid title ID/)
  await assert.rejects(runProvider("moviebox", "search", new URLSearchParams()), /Search query/)
  await assert.rejects(runProvider("sinhalasub", "movie", new URLSearchParams({ url: "https://example.com/movies/test" })), /sinhalasub/)
  await assert.rejects(runProvider("sinhalasub", "language", new URLSearchParams({ language: "__proto__" })), /supported language/)
})

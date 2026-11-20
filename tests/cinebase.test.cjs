const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const ts = require("typescript")

const root = path.resolve(__dirname, "..")
const cache = new Map()
function load(file) {
  file = path.resolve(file)
  if (cache.has(file)) return cache.get(file)
  const module = { exports: {} }
  cache.set(file, module.exports)
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText
  const localRequire = id => {
    if (id === "server-only") return {}
    if (id.startsWith("@/")) return load(path.join(root, `${id.slice(2)}.ts`))
    if (id.startsWith(".")) {
      const resolved = path.resolve(path.dirname(file), id)
      return path.extname(resolved) ? require(resolved) : load(`${resolved}.ts`)
    }
    return require(id)
  }
  new Function("require", "module", "exports", code)(localRequire, module, module.exports)
  return module.exports
}

test("CineBase search preserves its detail path and movie URLs become signed app routes", async () => {
  const { cinebaseSearch, cinebaseMovieResources } = load("lib/providers/cinebase.ts")
  const originalFetch = global.fetch
  const originalKey = process.env.CINEBASE_API_KEY
  const calls = []
  process.env.CINEBASE_API_KEY = "test-cinebase-key"
  global.fetch = async input => {
    const url = new URL(String(input))
    calls.push(url)
    if (url.pathname === "/proxy-api/api/search") {
      return Response.json({ data: { results: [{ id: "title-43", detailPath: "movie/title-43", title: "Sample Film", cover: { url: "https://images.example/film.jpg" }, genre: ["Drama"], imdbRatingValue: 8.2 }], hasMore: true, nextPage: 2 } })
    }
    if (url.pathname === "/proxy-api/api/movie") {
      return Response.json({ data: { sources: [{ quality: "720p", url: "https://media.example/film.mp4", downloadUrl: "https://media.example/download.mp4" }] } })
    }
    if (url.pathname === "/proxy-api/api/details") return Response.json({ data: { title: "Sample Film" } })
    if (url.pathname === "/proxy-api/api/subtitles") return Response.json({ results: [{ language: "English", url: "https://media.example/film.srt" }] })
    throw new Error(`Unexpected CineBase request: ${url.pathname}`)
  }
  try {
    const search = await cinebaseSearch("sample film", 1)
    assert.equal(search.results[0].subjectId, "title-43")
    assert.equal(search.results[0].detailPath, "movie/title-43")
    assert.equal(search.hasMore, true)
    assert.equal(calls[0].searchParams.get("apikey"), "test-cinebase-key")

    const resources = await cinebaseMovieResources(search.results[0].detailPath, "Sample Film")
    assert.equal(resources.sources.length, 1)
    assert.match(resources.sources[0].proxyStream, /^\/api\/media\?key=/)
    assert.match(resources.sources[0].proxyDownload, /^\/api\/media\?key=.*&download=1$/)
    assert.match(resources.subtitles[0].url, /^\/api\/subtitle\?key=/)
    assert.ok(!resources.sources[0].proxyDownload.includes("test-cinebase-key"))
    assert.equal(calls.find(url => url.pathname === "/proxy-api/api/movie").searchParams.get("id"), "movie/title-43")
  } finally {
    global.fetch = originalFetch
    if (originalKey === undefined) delete process.env.CINEBASE_API_KEY
    else process.env.CINEBASE_API_KEY = originalKey
  }
})

test("MovieBox catalog merges CineBase titles and signs the provider detail identity", async () => {
  const { movieSearch } = load("lib/providers/moviebox.ts")
  const { unseal } = load("lib/library/tokens.ts")
  const originalFetch = global.fetch
  const originalKey = process.env.CINEBASE_API_KEY
  process.env.CINEBASE_API_KEY = "test-cinebase-key"
  global.fetch = async input => {
    const url = new URL(String(input))
    if (url.hostname === "movie-terms.vercel.app") {
      return Response.json({ results: [{ id: "catalog-title-91", detailPath: "catalog/film-91", title: "CineBase Catalog Film", cover: { url: "https://images.example/catalog.jpg" } }] })
    }
    if (url.hostname === "api.omegatech.app") return Response.json({ results: [] })
    if (url.hostname === "moviebox-api-eight.vercel.app" || url.hostname === "movieboxapi.vercel.app") return Response.json({ results: [] })
    if (url.hostname === "drkamran-apis.onrender.com") return Response.json({ results: [] })
    throw new Error(`Unexpected movie catalog request: ${url.hostname}`)
  }
  try {
    const result = await movieSearch("cinebase-handoff-test-only", 1)
    const item = result.results.find(movie => movie.title === "CineBase Catalog Film")
    assert.ok(item)
    assert.equal(item.detailPath, "catalog/film-91")
    const identity = unseal(item.resourceKey, "movie-resource")
    assert.equal(identity.provider, "cinebase")
    assert.equal(identity.detailPath, "catalog/film-91")
    assert.equal(identity.subjectId, "catalog-title-91")
  } finally {
    global.fetch = originalFetch
    if (originalKey === undefined) delete process.env.CINEBASE_API_KEY
    else process.env.CINEBASE_API_KEY = originalKey
  }
})

test("CineBase retries a TV subject through its season and episode endpoint", async () => {
  const { cinebaseMovieResources } = load("lib/providers/cinebase.ts")
  const originalFetch = global.fetch
  const originalKey = process.env.CINEBASE_API_KEY
  const calls = []
  process.env.CINEBASE_API_KEY = "test-cinebase-key"
  global.fetch = async input => {
    const url = new URL(String(input))
    calls.push(url)
    if (url.pathname === "/proxy-api/api/movie") return Response.json({ error: "This subject is a tv" })
    if (url.pathname === "/proxy-api/api/tv") return Response.json({ data: { sources: [{ url: "https://media.example/episode.mp4", quality: "1080p" }] } })
    if (url.pathname === "/proxy-api/api/details" || url.pathname === "/proxy-api/api/subtitles") return Response.json({ data: [] })
    throw new Error(`Unexpected CineBase request: ${url.pathname}`)
  }
  try {
    const resources = await cinebaseMovieResources("show/12", "Sample Series", 3, 4)
    const tv = calls.find(url => url.pathname === "/proxy-api/api/tv")
    assert.equal(tv.searchParams.get("season"), "3")
    assert.equal(tv.searchParams.get("episode"), "4")
    assert.equal(resources.sources[0].quality, "1080p")
  } finally {
    global.fetch = originalFetch
    if (originalKey === undefined) delete process.env.CINEBASE_API_KEY
    else process.env.CINEBASE_API_KEY = originalKey
  }
})

test("CineBase media forwarding sends range and download requests only to its fixed proxy", async () => {
  const { cinebaseProxyFetch } = load("lib/providers/cinebase.ts")
  const originalFetch = global.fetch
  const originalKey = process.env.CINEBASE_API_KEY
  process.env.CINEBASE_API_KEY = "test-cinebase-key"
  let called
  global.fetch = async (input, options) => {
    called = { url: new URL(String(input)), options }
    return new Response("media", { status: 206, headers: { "Content-Type": "video/mp4", "Content-Range": "bytes 0-4/10" } })
  }
  try {
    const response = await cinebaseProxyFetch("https://media.example/film.mp4", "film/12", true, "film.mp4", "bytes=0-4")
    assert.equal(response.status, 206)
    assert.equal(called.url.origin, "https://movie-terms.vercel.app")
    assert.equal(called.url.pathname, "/proxy-api/dl")
    assert.equal(called.url.searchParams.get("url"), "https://media.example/film.mp4")
    assert.equal(called.url.searchParams.get("dp"), "film/12")
    assert.equal(called.url.searchParams.get("name"), "film.mp4")
    assert.equal(called.options.headers.Range, "bytes=0-4")
  } finally {
    global.fetch = originalFetch
    if (originalKey === undefined) delete process.env.CINEBASE_API_KEY
    else process.env.CINEBASE_API_KEY = originalKey
  }
})

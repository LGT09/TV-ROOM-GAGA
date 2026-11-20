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

test("Omega default passes search identity and polls returned task IDs first", async () => {
  const { movieResourceResponse } = load("lib/providers/moviebox.ts")
  const originalFetch = global.fetch
  const calls = []
  global.fetch = async input => {
    const url = new URL(String(input))
    calls.push(url)
    if (url.hostname === "api.omegatech.app") {
      if (url.searchParams.get("action") === "detail") {
        return Response.json({ data: { subjectId: "5390197429792821032", title: "Queued film", detailPath: "queued-film-hj82k" } })
      }
      if (url.searchParams.get("task_id") === "resolve-task-12") {
        return Response.json({ status: "queued", task_id: "download-task-34" })
      }
      if (url.searchParams.get("task_id") === "download-task-34") {
        return Response.json({
          status: "completed",
          data: { proxyDownload: "https://cacdn.hakunaymatata.com/movie/film-720.mp4", quality: "720p" },
        })
      }
    }
    if (url.hostname === "cacdn.hakunaymatata.com") {
      return new Response(Buffer.from([0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109]), {
        status: 206,
        headers: { "Content-Type": "video/mp4", "Content-Range": "bytes 0-11/1000000" },
      })
    }
    return Response.json({ success: false, error: "No resource on this fallback." })
  }

  try {
    const result = await movieResourceResponse(
      "5390197429792821032",
      "",
      "0",
      "0",
      "resolve-task-12",
      "task_id",
    )
    const urls = calls.map(url => url.href)
    const omega = calls.find(url => url.hostname === "api.omegatech.app" && url.searchParams.get("task_id") === "resolve-task-12")
    const detail = calls.find(url => url.hostname === "api.omegatech.app" && url.searchParams.get("action") === "detail")
    const download = calls.find(url => url.hostname === "api.omegatech.app" && url.searchParams.get("action") === "download")
    assert.ok(omega)
    assert.ok(detail)
    assert.ok(download)
    assert.equal(download.searchParams.get("detailPath"), "queued-film-hj82k")
    assert.equal(omega.searchParams.get("subjectId"), "5390197429792821032")
    assert.equal(omega.searchParams.get("detailPath"), "queued-film-hj82k")
    assert.ok(urls.some(value => value.includes("task_id=download-task-34")), "the returned task ID must be polled")
    assert.equal(result.qualities[0].downloadUrl, "https://cacdn.hakunaymatata.com/movie/film-720.mp4")
    assert.ok(!calls.some(url =>
      url.hostname === "moviebox-api-eight.vercel.app" ||
      url.hostname === "movieboxapi.vercel.app" ||
      (url.hostname === "movieboxapi-3xvk.vercel.app" && url.pathname !== "/api/subtitles")
    ))
  } finally {
    global.fetch = originalFetch
  }
})

test("OmegaTech is the default movie resolver and receives the selected episode", async () => {
  const { movieResourceResponse } = load("lib/providers/moviebox.ts")
  const originalFetch = global.fetch
  const calls = []
  const omegaUrl = "https://stream.omegatech.app/files/alone-s1e2.mp4"
  global.fetch = async (input, options = {}) => {
    const url = new URL(String(input))
    calls.push(url)
    if (url.hostname === "api.omegatech.app") {
      return Response.json({
        qualities: [{ quality: "720p", format: "MP4", streamUrl: omegaUrl, downloadUrl: omegaUrl }],
        subtitles: [{ lan: "en", lanName: "English", url: "https://stream.omegatech.app/files/alone-en.srt" }],
      })
    }
    if (url.hostname === "stream.omegatech.app") {
      return new Response(Buffer.from([0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109]), {
        status: 206,
        headers: { "Content-Type": "video/mp4", "Content-Range": "bytes 0-11/1000000" },
      })
    }
    throw new Error(`A fallback ran before the default provider: ${url.hostname}`)
  }
  try {
    const result = await movieResourceResponse("4865129253278498768", "alone-cSEInMiloN5", "1", "2")
    const request = calls.find(url => url.hostname === "api.omegatech.app")
    assert.equal(request.searchParams.get("action"), "download")
    assert.equal(request.searchParams.get("subjectId"), "4865129253278498768")
    assert.equal(request.searchParams.get("detailPath"), "alone-cSEInMiloN5")
    assert.equal(request.searchParams.get("se"), "1")
    assert.equal(request.searchParams.get("ep"), "2")
    assert.equal(result.qualities[0].downloadUrl, omegaUrl)
    assert.ok(calls.every(url => url.hostname === "api.omegatech.app" || url.hostname === "stream.omegatech.app"))
  } finally {
    global.fetch = originalFetch
  }
})

test("MovieBox API v3 media, stream, and download URLs are normalized and verified", async () => {
  const { movieResourceResponse } = load("lib/providers/moviebox.ts")
  const originalFetch = global.fetch
  const streamUrl = "https://proxy.cinemind.name.ng/api/proxy?url=https%3A%2F%2Fcdn.example%2Ffilm.mp4"
  const downloadUrl = "https://bcdnw.hakunaymatata.com/movie/film-720.mp4"
  const calls = []
  global.fetch = async (input, options = {}) => {
    const url = new URL(String(input))
    calls.push(url)
    if (url.hostname === "movieboxapi-3xvk.vercel.app" && url.pathname === "/api/media") {
      return Response.json({
        status: "success",
        data: {
          stream: { data: { streams: [{ format: "MP4", url: streamUrl, resolutions: "720p", size: "1 GB" }] } },
          downloads: { data: { downloads: [{ format: "MP4", url: downloadUrl, downloadUrl, resolution: 720, size: "1 GB", streamUrl }] } },
          subtitles: { data: { captions: [{ lan: "en", lanName: "English", url: "https://proxy.cinemind.name.ng/subtitles/en.vtt" }] } },
        },
      })
    }
    if (url.hostname === "proxy.cinemind.name.ng" || url.hostname === "bcdnw.hakunaymatata.com") {
      return new Response(Buffer.from([0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109]), {
        status: 206,
        headers: { "Content-Type": "video/mp4", "Content-Range": "bytes 0-11/1000000" },
      })
    }
    return Response.json({ results: [] })
  }
  try {
    const result = await movieResourceResponse("5390197429792821032", "titanic-m7a9yt0abq6", "0", "0")
    const request = calls.find(url => url.hostname === "movieboxapi-3xvk.vercel.app" && url.pathname === "/api/media")
    assert.ok(request)
    assert.equal(request.searchParams.get("subjectId"), "5390197429792821032")
    assert.equal(request.searchParams.get("detailPath"), "titanic-m7a9yt0abq6")
    assert.equal(result.qualities[0].format, "MP4")
    assert.equal(result.qualities[0].streamUrl, streamUrl)
    assert.equal(result.qualities[0].downloadUrl, downloadUrl)
    assert.equal(result.subtitles.length, 1)
    assert.equal(result.subtitles[0].lanName, "English")
  } finally {
    global.fetch = originalFetch
  }
})

test("MovieBox API v3 search returns subject IDs and detail paths for the title page", async () => {
  const { movieSearch } = load("lib/providers/moviebox.ts")
  const originalFetch = global.fetch
  const query = "moviebox-v3-search-fixture"
  let v3Request
  global.fetch = async input => {
    const url = new URL(String(input))
    if (url.hostname === "movieboxapi-3xvk.vercel.app" && url.pathname === "/api/search") {
      v3Request = url
      return Response.json({
        status: "success",
        data: {
          pager: { hasMore: true, nextPage: 2 },
          items: [{ subjectId: "5390197429792821032", detailPath: "titanic-m7a9yt0abq6", title: "Titanic", cover: { url: "https://image.example/titanic.jpg" } }],
        },
      })
    }
    return Response.json({ results: [] })
  }
  try {
    const result = await movieSearch(query, 1)
    const title = result.results.find(item => item.subjectId === "5390197429792821032")
    assert.ok(title)
    assert.equal(title.detailPath, "titanic-m7a9yt0abq6")
    assert.ok(title.resourceKey)
    assert.equal(v3Request.searchParams.get("query"), query)
    assert.equal(v3Request.searchParams.get("subjectType"), "MOVIES")
    assert.equal(v3Request.searchParams.get("page"), "1")
  } finally {
    global.fetch = originalFetch
  }
})

test("MovieBox homepage and popular searches normalize into discovery items", async () => {
  const { movieboxApi3Discovery } = load("lib/providers/moviebox.ts")
  const originalFetch = global.fetch
  global.fetch = async input => {
    const url = new URL(String(input))
    if (url.pathname === "/api/homepage") {
      return Response.json({ data: { operatingList: [{ title: "Trending", banner: { items: [{ title: "Featured Film", subjectId: "1234567890", detailPath: "featured-film", cover: { url: "https://image.example/featured.jpg" } }] } }] } })
    }
    if (url.pathname === "/api/popular-searches") {
      return Response.json({ data: { everyoneSearch: [{ title: "Titanic" }, { title: "Dune" }] } })
    }
    throw new Error(`Unexpected discovery endpoint: ${url.pathname}`)
  }
  try {
    const data = await movieboxApi3Discovery()
    assert.equal(data.featured[0].title, "Featured Film")
    assert.equal(data.popularSearches[0], "Titanic")
    assert.deepEqual(data.popularSearches, ["Titanic", "Dune"])
  } finally {
    global.fetch = originalFetch
  }
})

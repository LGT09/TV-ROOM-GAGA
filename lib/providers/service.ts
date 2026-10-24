import "server-only"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import path from "node:path"
import { providerJson, ProviderError, integer } from "./http"
import { providerById, type ProviderDefinition } from "./registry"
import { normalizeProvider } from "./normalize"
import { movieTaskRequest } from "./movie-tasks"

const execute = promisify(execFile)
const MOVIEBOX = "https://moviebox-api-eight.vercel.app"
const OMEGA = "https://api.omegatech.app"
const META = "https://h5-api.aoneroom.com/wefeed-h5api-bff"
const metadataHeaders = { Origin: "https://moviebox.ph", Referer: "https://moviebox.ph/" }
const cache = new Map<string, { expires: number; data: any }>()
const inFlight = new Map<string, Promise<any>>()

function required(value: string | null, label: string) {
  if (!value?.trim()) throw new ProviderError(`${label} is required for this action.`, 400)
  if (value.length > 2000) throw new ProviderError(`${label} is too long.`, 400)
  return value.trim()
}
function segment(value: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) throw new ProviderError("Invalid title ID or slug.", 400)
  return encodeURIComponent(value)
}

async function moviebox(action: string, params: URLSearchParams) {
  const id = params.get("id") || params.get("subjectId") || ""
  let slug = params.get("path") || params.get("detail_path") || params.get("detailPath") || ""
  const q = params.get("q") || params.get("query") || ""
  const page = Math.max(1, integer(params.get("page")))
  if (["home", "movies", "tv-series"].includes(action)) return providerJson(`${MOVIEBOX}/${action}?page=${page}`)
  if (["search", "suggest"].includes(action)) return providerJson(`${MOVIEBOX}/${action === "suggest" ? "search/suggest" : "search"}?${new URLSearchParams({ q: required(q, "Search query"), page: String(page) })}`)
  if (!id && !slug) throw new ProviderError("Select a title or provide its subject ID / detail path.", 400)
  if (!slug && ["detail", "resources", "audio-tracks", "episodes"].includes(action)) {
    const meta = await providerJson(`${META}/detail?subjectId=${segment(id)}`, 12000, metadataHeaders)
    slug = meta?.data?.subject?.detailPath || meta?.data?.detailPath || ""
    if (!slug && action === "detail") return meta
  }
  if (["detail", "resources", "audio-tracks"].includes(action)) return providerJson(`${MOVIEBOX}/${action}/${segment(required(slug || id, "Detail path"))}`)
  if (action === "episodes") {
    try { return await providerJson(`${MOVIEBOX}/episodes/${segment(required(id, "Subject ID"))}`, 10000) }
    catch {
      return providerJson(`${MOVIEBOX}/resources/${segment(required(slug, "Detail path"))}`)
    }
  }
  if (["stream", "captions"].includes(action)) {
    const query = new URLSearchParams({
      se: String(integer(params.get("season") || params.get("se"), 0, 1000)),
      ep: String(integer(params.get("episode") || params.get("ep"), 0, 10000)),
    })
    if (slug) query.set("detail_path", slug)
    if (params.get("stream_id")) query.set("stream_id", params.get("stream_id")!)
    try {
      return await providerJson(`${MOVIEBOX}/api/stream/${segment(required(id, "Subject ID"))}${action === "captions" ? "/captions" : ""}?${query}`, 22000)
    } catch (original) {
      if (action === "captions") throw original
      // Same subject and episode only: never replace a film with a similarly named title.
      const fallback = new URLSearchParams({ action: "download", subjectId: id, detailPath: slug, se: query.get("se")!, ep: query.get("ep")! })
      try { return await providerJson(`${OMEGA}/api/movie/MovieBox-pro?${fallback}`, 12000) }
      catch { throw original }
    }
  }
  throw new ProviderError("Unsupported MovieBox action.", 400)
}

async function dramabox(action: string, params: URLSearchParams) {
  const query = new URLSearchParams()
  if (action === "search") query.set("q", required(params.get("q") || params.get("query"), "Search query"))
  if (["category", "detail", "stream"].includes(action)) query.set("id", required(params.get("id"), action === "category" ? "Category ID" : "Drama ID"))
  if (action === "stream") {
    const chapter = required(params.get("chapter"), "Chapter ID")
    // Do not request locked chapters or treat paid episodes as free.
    const detail = await providerJson(`https://puruboy-api.vercel.app/api/dramabox/detail?id=${encodeURIComponent(query.get("id")!)}`)
    const ep = detail?.episodes?.find((e: any) => String(e.id) === chapter)
    if (!ep) throw new ProviderError("Chapter not found.", 404)
    if (ep.unlock !== true || ep.locked === true) throw new ProviderError("This episode is locked by its provider. Watch through the official service.", 403)
    query.set("chapter", chapter)
  }
  return providerJson(`https://puruboy-api.vercel.app/api/dramabox/${action}?${query}`)
}

async function sinhala(action: string, params: URLSearchParams) {
  const input = Object.fromEntries(params)
  input.action = action
  input.page = String(Math.max(1, integer(params.get("page"))))
  if (action === "search") input.q = required(params.get("q") || params.get("query"), "Search query")
  if (["movie", "tvshow", "episode", "actor", "director"].includes(action)) {
    const url = new URL(required(params.get("url"), "SinhalaSub URL"))
    if (url.protocol !== "https:" || !["sinhalasub.lk", "www.sinhalasub.lk"].includes(url.hostname) || url.username || url.password || url.port) throw new ProviderError("Use an HTTPS sinhalasub.lk URL.", 400)
    const prefix = { movie: "/movies/", tvshow: "/tvshows/", episode: "/episodes/", actor: "/cast/", director: "/director/" }[action as "movie"]
    if (!url.pathname.startsWith(prefix)) throw new ProviderError(`Expected a ${prefix} URL for this action.`, 400)
  }
  const languages = ["Sinhala", "English", "Tamil", "Hindi", "Kannada", "France", "Japanese", "Telugu", "Malayalam", "Korean", "Other"]
  const genres = ["History", "Thriller", "Comedy", "Horror", "Adventure", "Science_fiction", "Mystery", "Animation", "Sport", "Drama", "Action", "Crime", "Romance", "Fantasy", "Family", "War", "Adult_only", "Short"]
  if (action === "language" && !languages.includes(input.language)) throw new ProviderError(`Choose a supported language: ${languages.join(", ")}`, 400)
  if (action === "genre" && !genres.includes(input.genre)) throw new ProviderError(`Choose a supported genre: ${genres.join(", ")}`, 400)
  if (action === "year" && !/^(19|20)\d{2}$/.test(input.year || "")) throw new ProviderError("Enter a four-digit release year.", 400)
  try {
    const { stdout } = await execute(process.execPath, [path.join(process.cwd(), "lib/providers/sinhala-worker.cjs"), JSON.stringify(input)], { timeout: 20000, maxBuffer: 3_000_000 })
    const data = JSON.parse(stdout.split("TVROOM_RESULT:").pop() || "{}")
    if (data?.status === false) throw new ProviderError(data.message || "SinhalaSub returned no result.")
    return data
  } catch (e) {
    if (e instanceof ProviderError) throw e
    throw new ProviderError("SinhalaSub is unavailable or timed out. Try the Omega SinhalaSub provider.")
  }
}

function nativeAction(provider: ProviderDefinition, action: string) {
  const route = provider.route
  if (provider.actions.includes(action)) return action
  if (action === "home") return provider.defaultAction
  if (action === "detail") {
    if (route === "MovieBox-pro2") return "info"
    if (route === "movieda") return "movie"
    if (route === "Akwam") return "content"
    if (route === "Winbu") return "film"
    if (["naijaprey", "net9ja"].includes(route!)) return "post"
  }
  if (action === "stream") {
    if (route === "MovieBox-pro2") return "sources"
    if (route === "MovieBox-pro") return "download"
    if (["Moviebox_off", "Live-Tv"].includes(route!)) return "play"
    if (provider.actions.includes("resolve")) return "resolve"
  }
  throw new ProviderError("This provider does not support that action.", 400)
}

async function omega(provider: ProviderDefinition, requested: string, params: URLSearchParams) {
  const action = nativeAction(provider, requested)
  const query = new URLSearchParams()
  // Copy only documented fields; callers cannot change the target host/path or send credentials.
  for (const field of provider.params) {
    const value = params.get(field.name)
    if (value && value.length <= 2000) query.set(field.name, value)
  }
  const set = (key: string, value: string | null) => {
    if (value && provider.params.some(p => p.name === key) && !query.has(key)) query.set(key, value)
  }
  const q = params.get("q") || params.get("query")
  for (const key of ["query", "q", "keyword", "phrase"]) set(key, q)
  const taskOnly=["taskId","task_id","taskid","jobId","job_id"].some(key=>params.get(key)&&params.get(key)===params.get("id"))
  set("subjectId", taskOnly?null:params.get("id"))
  set("shortPlayId", params.get("id"))
  set("channel", params.get("id"))
  set("channelId", params.get("id"))
  set("slug", params.get("url") || params.get("path") || params.get("id"))
  set("detailPath", params.get("path"))
  set("se", params.get("season"))
  set("ep", params.get("episode"))
  set("episodeNo", params.get("episode"))
  set("epsid", params.get("chapter"))
  set("postId", params.get("id"))
  for (const field of ["taskId","task_id","taskid","jobId","job_id"]) {
    const task = params.get(field)
    if (task && task.length <= 500) query.set(field,task)
  }
  if (!["cinesubz-search", "Drama-search", "movie"].includes(provider.route!)) query.set("action", action)
  if (provider.route === "Layarcha") query.set("filterAdult", "true")
  if (["search", "all"].includes(action) && !q && !["keyword", "phrase", "query"].some(k => query.has(k))) throw new ProviderError("Enter a search query.", 400)
  const target = `${OMEGA}/api/movie/${provider.route}?${query}`
  return ["download","resolve","play","sources","stream","follow"].includes(action) ? movieTaskRequest(target) : providerJson(target, 6000)
}

export async function runProvider(id: string, requested: string, params: URLSearchParams) {
  const provider = providerById(id)
  if (!provider) throw new ProviderError("Unknown provider.", 400)
  let action = requested || provider.defaultAction
  if (id === "sinhalasub") {
    if (action === "home") action = "recent-movies"
    if (action === "detail") action = params.get("url")?.includes("/tvshows/") ? "tvshow" : params.get("url")?.includes("/episodes/") ? "episode" : "movie"
    if (action === "stream") action = params.get("url")?.includes("/episodes/") ? "episode" : "movie"
  }
  if (!id.startsWith("omega-") && !provider.actions.includes(action)) throw new ProviderError("Unsupported provider action.", 400)
  const key = id + ":" + action + ":" + new URLSearchParams([...params].sort()).toString()
  const cached = cache.get(key)
  if (cached && cached.expires > Date.now()) return cached.data
  if (inFlight.has(key)) return inFlight.get(key)
  const job = (async () => {
    const data = id === "moviebox" ? await moviebox(action, params) : id === "dramabox" ? await dramabox(action, params) : id === "sinhalasub" ? await sinhala(action, params) : await omega(provider, action, params)
    const normalized = normalizeProvider(data, id)
    if (["stream","download","play","sources","resolve"].includes(action) && !normalized.sources.length) {
      const root=data?.data||data?.result||data
      if(root?.url||root?.link)normalized.sources=normalizeProvider({sources:[root.url||root.link]},id).sources
    }
    // Metadata trailers, news clips and other recommendations are not title streams.
    if (["detail", "home", "search", "movies", "tv-series", "resources", "audio-tracks"].includes(action) && id === "moviebox") normalized.sources = []
    const result = { success: true, provider: id, action, ...normalized, data }
    if (cache.size > 120) cache.delete(cache.keys().next().value!)
    cache.set(key, { expires: Date.now() + (["stream", "captions", "download", "play", "sources"].includes(action) ? 15000 : 60000), data: result })
    return result
  })().finally(() => inFlight.delete(key))
  inFlight.set(key, job)
  return job
}

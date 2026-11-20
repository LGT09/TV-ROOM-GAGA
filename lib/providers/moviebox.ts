import "server-only"

import { BROWSER_USER_AGENT, ProviderError, providerJson } from "./http"
import { allowedMediaUrl } from "./media-url"
import { seal } from "@/lib/library/tokens"
import { mergeMovieResourceResponses, movieLocalMediaPath, movieResourcePayload, movieSearchResponses, movieSourceCandidates } from "./moviebox-resources"
import { searchKamranSinhalasub } from "./kamran-movies"
import { movieTaskRequest } from "./movie-tasks"
import { probeMedia } from "./media-probe"
import { cinebaseSearch } from "./cinebase"

const API = "https://api.omegatech.app/api/movie/MovieBox-pro"
const BACKUP = "https://moviebox-api-eight.vercel.app"
const MOVIEBOX_API = "https://movieboxapi.vercel.app/api"
const MOVIEBOX_API_3 = "https://movieboxapi-3xvk.vercel.app/api"
const METADATA = "https://h5-api.aoneroom.com/wefeed-h5api-bff"
const metadataHeaders = { Origin: "https://moviebox.ph", Referer: "https://moviebox.ph/" }
const searchCache = new Map<string, { expires: number; value: unknown }>()
const detailCache = new Map<string, { expires: number; value: any }>()
function safeSource(item: any, title: string, download = false) {
  const values = movieSourceCandidates(item, download ? "download" : "stream")
  const local = values.map(value => movieLocalMediaPath(value, download)).find(Boolean)
  if (local) return local
  const urls: string[] = []
  for (const value of values) {
    try { urls.push(allowedMediaUrl(value).href) } catch {}
  }
  if (!urls.length) return null
  const [primary, ...fallbacks] = [...new Set(urls)]
  const hls = /\.m3u8(?:[?#]|$)/i.test(primary)
  const token = seal("media", { url: primary, fallbacks: fallbacks.slice(0, 2), kind: "video", title, format: hls ? "HLS" : "MP4", downloadMode: download ? "original" : undefined }, 21600)
  return `/api/media?key=${token}${download ? "&download=1" : hls ? "&format=hls" : ""}`
}
function safeCaptions(value: any) {
  const items = Array.isArray(value) ? value : typeof value === "object" && value ? Object.values(value) : []
  return items.flatMap((item: any, index: number) => {
    const source = typeof item === "string" ? item : item?.url || item?.proxySubtitles || item?.subtitleUrl
    if (typeof source !== "string" || !source) return []
    try {
      const url = allowedMediaUrl(source)
      return [{ id: String(item?.id || index), language: String(item?.language || item?.lang || item?.name || `Subtitle ${index + 1}`), label: String(item?.label || item?.language || item?.lang || `Subtitle ${index + 1}`), url: `/api/subtitle?key=${seal("caption", { url: url.href }, 21600)}` }]
    } catch { return [] }
  })
}

export async function movieBoxJson(params: Record<string, string>, timeout = 15000): Promise<any> {
  const url = new URL(API)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": BROWSER_USER_AGENT },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(timeout),
  }).catch((error: any) => {
    throw new ProviderError(error?.name === "TimeoutError" ? "Movie search timed out. Try again." : "Movie service is temporarily unavailable.")
  })
  const text = await response.text()
  if (!response.ok) throw new ProviderError(`Movie service returned HTTP ${response.status}.`)
  if (text.length > 12_000_000) throw new ProviderError("Movie service response is too large.")
  let data: any
  try { data = JSON.parse(text) } catch { throw new ProviderError("Movie service returned an invalid response.") }
  if (data?.success === false || data?.data?.success === false) throw new ProviderError(String(data.error || data.message || "Movie service could not complete the request."))
  return data
}

async function movieBoxDownloadJson(params: Record<string, string>) {
  const url = new URL(API)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  return movieTaskRequest(url.href)
}

function movieboxApi3Rows(raw: any, kind: "streams" | "downloads" | "captions") {
  const root = raw?.data || raw || {}
  const candidates = kind === "streams"
    ? [root?.stream?.data?.streams, root?.stream?.streams, root?.streams, root?.data?.streams]
    : kind === "downloads"
      ? [root?.downloads?.data?.downloads, root?.downloads?.downloads, root?.downloads, root?.data?.downloads]
      : [root?.subtitles?.data?.captions, root?.subtitles?.captions, root?.captions, root?.data?.captions]
  return candidates.find(Array.isArray) || []
}

async function movieboxApi3Subtitles(subjectId: string, detailPath: string, season: string, episode: string) {
  const params = new URLSearchParams({ subjectId, detailPath, season, episode })
  const captions = await providerJson(`${MOVIEBOX_API_3}/subtitles?${params}`, 9000)
  return movieboxApi3Rows(captions, "captions")
}

function movieboxApi3Quality(streams: any[], downloads: any[]) {
  const grouped = new Map<string, any>()
  const qualityKey = (item: any, index: number) =>
    String(item?.resolution || item?.resolutions || item?.quality || item?.format || index).toLowerCase().replace(/p$/, "")
  streams.forEach((item, index) => {
    const key = qualityKey(item, index)
    grouped.set(key, {
      ...(grouped.get(key) || {}),
      quality: String(item?.resolutions || item?.resolution || item?.quality || "Auto"),
      format: String(item?.format || "MP4"),
      size: item?.size || "",
      streamUrl: item?.streamUrl || item?.url || "",
    })
  })
  downloads.forEach((item, index) => {
    const key = qualityKey(item, index)
    grouped.set(key, {
      ...(grouped.get(key) || {}),
      quality: String(item?.resolution || item?.quality || item?.format || "Auto"),
      format: String(item?.format || grouped.get(key)?.format || "MP4"),
      size: item?.size || grouped.get(key)?.size || "",
      downloadUrl: item?.downloadUrl || item?.download_url || item?.url || "",
      streamUrl: item?.streamUrl || item?.stream_url || grouped.get(key)?.streamUrl || "",
    })
  })
  return [...grouped.values()]
}

async function movieboxApi3Resources(subjectId: string, detailPath: string, season: string, episode: string) {
  const params = new URLSearchParams({ subjectId, detailPath, season, episode })
  const mediaUrl = `${MOVIEBOX_API_3}/media?${params}`
  let media: any = {}
  let mediaError: unknown
  try { media = await providerJson(mediaUrl, 14000) } catch (error) { mediaError = error }
  let streams = movieboxApi3Rows(media, "streams")
  const downloads = movieboxApi3Rows(media, "downloads")
  let subtitles = movieboxApi3Rows(media, "captions")

  if (!streams.length) {
    const streamParams = new URLSearchParams({ ...Object.fromEntries(params), quality: "720" })
    try {
      const stream = await providerJson(`${MOVIEBOX_API_3}/stream?${streamParams}`, 12000)
      streams = movieboxApi3Rows({ data: { stream } }, "streams")
      if (!streams.length) streams = movieboxApi3Rows(stream, "streams")
    } catch {}
  }
  if (!subtitles.length) {
    try { subtitles = await movieboxApi3Subtitles(subjectId, detailPath, season, episode) } catch {}
  }
  const qualities = movieboxApi3Quality(streams, downloads)
  if (!qualities.some(item => movieSourceCandidates(item, "stream").length || movieSourceCandidates(item, "download").length)) {
    throw mediaError || new ProviderError("The MovieBox fallback returned no media sources.")
  }
  return { qualities, subtitles }
}

function catalogRows(raw: any) {
  const rows: any[] = []
  const queue = [raw]
  const seen = new Set<any>()
  while (queue.length && rows.length < 40) {
    const value = queue.shift()
    if (!value || typeof value !== "object" || seen.has(value)) continue
    seen.add(value)
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === "object" &&
          (item.title || item.name) &&
          (item.subjectId || item.subject_id || item.id || item.detailPath || item.detail_path || item.slug)) rows.push(item)
        else if (item && typeof item === "object") queue.push(item)
      }
      continue
    }
    for (const key of ["data", "result", "items", "results", "sections", "featured", "banners", "banner", "trending", "movies", "shows", "contents", "popular", "operatingList", "topPickList", "homeList", "subjects", "liveList", "allPlatform"]) {
      if (value[key] && typeof value[key] === "object") queue.push(value[key])
    }
  }
  return rows
}

function popularTerms(raw: any) {
  const queue = [raw]
  const seen = new Set<any>()
  const terms: string[] = []
  while (queue.length && terms.length < 16) {
    const value = queue.shift()
    if (!value || typeof value !== "object" || seen.has(value)) continue
    seen.add(value)
    if (Array.isArray(value)) {
      for (const item of value) {
        const term = typeof item === "string" ? item : item?.query || item?.keyword || item?.searchTerm || item?.term || item?.title
        if (typeof term === "string" && term.trim()) terms.push(term.trim())
        else if (item && typeof item === "object") queue.push(item)
      }
      continue
    }
    for (const key of ["data", "result", "items", "results", "searches", "popularSearches", "popular_searches", "everyoneSearch", "terms"]) {
      if (value[key] && typeof value[key] === "object") queue.push(value[key])
    }
  }
  return [...new Set(terms)].slice(0, 12)
}

export async function movieboxApi3Discovery() {
  const [homepage, popular] = await Promise.allSettled([
    providerJson(`${MOVIEBOX_API_3}/homepage`, 9000),
    providerJson(`${MOVIEBOX_API_3}/popular-searches`, 9000),
  ])
  const featured = homepage.status === "fulfilled" ? catalogRows(homepage.value).map((item: any) => ({
    title: String(item.title || item.name || "Untitled"),
    cover: String(item.cover?.url || item.poster?.url || item.cover || item.poster || item.posterUrl || item.image || ""),
    year: String(item.year || item.releaseDate || item.release_date || "").slice(0, 4),
  })).filter((item: any, index: number, values: any[]) => item.title !== "Untitled" && values.findIndex(other => other.title === item.title) === index).slice(0, 12) : []
  return {
    featured,
    popularSearches: popular.status === "fulfilled" ? popularTerms(popular.value) : [],
  }
}

export async function movieSearch(query: string, page: number) {
  const key = `${query.toLowerCase()}\n${page}`
  const cached = searchCache.get(key)
  if (cached && cached.expires > Date.now()) return cached.value
  const backupUrl = new URL(`${BACKUP}/search`)
  backupUrl.search = new URLSearchParams({ q: query, page: String(page) }).toString()
  const movieboxApiSearch = new URL(`${MOVIEBOX_API}/search`)
  movieboxApiSearch.search = new URLSearchParams({
    query,
    subjectType: "MOVIES",
    page: String(page),
    perPage: "20",
  }).toString()
  const movieboxApi3Search = new URL(`${MOVIEBOX_API_3}/search`)
  movieboxApi3Search.search = new URLSearchParams({
    query,
    subjectType: "MOVIES",
    page: String(page),
    perPage: "20",
  }).toString()
  const settled = await Promise.allSettled([
    movieBoxJson({ action: "search", keyword: query, page: String(page) }, 5500),
    providerJson(backupUrl.href, 5500),
    providerJson(movieboxApiSearch.href, 7000),
    providerJson(movieboxApi3Search.href, 9000),
    searchKamranSinhalasub(query, page),
    cinebaseSearch(query, page),
  ])
  const successful = settled.slice(0, 4).flatMap(result => result.status === "fulfilled" ? [result.value] : [])
  const kamran = settled[4].status === "fulfilled" ? settled[4].value : null
  const cinebase = settled[5].status === "fulfilled" ? settled[5].value : null
  if (settled[5].status === "rejected") {
    const error = settled[5].reason
    const message = error instanceof Error ? error.message.toLowerCase() : ""
    const category = /api.?key|unauthori[sz]ed|forbidden|credential|authentication/.test(message)
      ? "credentials"
      : /timed out/.test(message) ? "timeout"
      : /non-json|oversized/.test(message) ? "invalid-response"
      : /returned http \d+/.test(message) ? "upstream-http"
      : /could not be reached/.test(message) ? "network"
      : "provider-error"
    console.warn("[CineBase] Search provider unavailable", { status: error instanceof ProviderError ? error.status : 502, category })
  } else if (!cinebase?.results?.length) {
    console.info("[CineBase] Search response contained no supported title rows.")
  }
  if (!successful.length && !kamran && !cinebase) {
    const firstError = settled.find(result => result.status === "rejected")
    throw firstError?.status === "rejected" ? firstError.reason : new ProviderError("Movie search is temporarily unavailable.")
  }
  const { payloads, items, payload } = movieSearchResponses(successful)
  const pager = payload?.pager || payload?.pagination || {}
  const totalCount = Number(pager.totalCount || payload?.total) || undefined
  const hasMoreFromAny = payloads.some(value => Boolean(value?.pager?.hasMore ?? value?.pagination?.hasMore ?? value?.hasMore)) || Boolean(kamran?.hasMore)
  const hasMore = hasMoreFromAny || Boolean(pager.hasMore ?? payload?.hasMore ?? (totalCount ? page * 20 < totalCount : false))
  const movieboxResults = items.map((item: any) => {
      const apiSubjectId = String(item.subjectId || item.subject_id || item.subjectID || item.movieId || item.movie_id || "")
      const taskId = String(item.taskId || item.task_id || item.taskid || item.jobId || item.job_id || "")
      const subjectId = apiSubjectId || taskId || String(item.id || "")
      const title = String(item.title || item.name || "Untitled")
      const proxyStream = safeSource(item, title)
      const proxyDownload = safeSource(item, title, true)
      const proxySubtitles = safeCaptions(item.proxySubtitles)
      const movie = {
        subjectId,
        apiSubjectId,
        taskId,
        taskParam: String(item.taskParam || item.task_param || (item.task_id !== undefined ? "task_id" : item.taskid !== undefined ? "taskid" : item.jobId !== undefined ? "jobId" : item.job_id !== undefined ? "job_id" : "taskId")),
        detailPath: String(item.detailPath || item.detail_path || item.slug || ""),
        title,
        cover: item.cover?.url || item.cover || item.poster || item.poster_url || item.thumbnail || "",
        genre: item.genre || item.genres || "",
        imdbRatingValue: item.imdbRatingValue ?? item.rating ?? item.imdbRating ?? "",
        description: item.description || item.overview || "",
        releaseDate: item.releaseDate || item.release_date || item.year || "",
        proxyStream,
        proxyDownload,
        proxySubtitles,
        subjectType: item.subjectType || item.subject_type,
        quality: String(item.quality || item.resolution || "Auto"),
        format: String(item.format || "MP4"),
        size: item.size || "",
      }
      return movie
    }).filter((item: any) =>
      (/^\d{5,32}$/.test(item.subjectId) && (!item.apiSubjectId || /^\d{5,32}$/.test(item.apiSubjectId))) ||
      (!item.apiSubjectId && !!item.taskId && /^[A-Za-z0-9_-]{1,200}$/.test(item.subjectId)))
  const titleKey = (item: any) => {
    const title = String(item.title || item.name || "").toLowerCase()
      .replace(/sinhala subtitles?.*$/i, "")
      .replace(/[^\p{L}\p{N}]+/gu, " ").trim()
    const year = String(item.releaseDate || item.release_date || item.year || title.match(/\b(?:19|20)\d{2}\b/)?.[0] || "").match(/\b(?:19|20)\d{2}\b/)?.[0] || ""
    return `${title.replace(/\b(?:19|20)\d{2}\b/g, "").trim()}:${year}`
  }
  const kamranByTitle = new Map<string, any>()
  for (const item of kamran?.items || []) {
    const key = titleKey(item)
    if (!kamranByTitle.has(key)) kamranByTitle.set(key, item)
  }
  const movieboxWithFallbacks = movieboxResults.map((movie: any) => {
    const fallback = kamranByTitle.get(titleKey(movie))
    const resourceKey = seal("movie-resource", {
      ...movie,
      ...(fallback ? { kamranSourceUrl: fallback.sourceUrl } : {}),
    }, 1800)
    return { ...movie, resourceKey }
  })
  const seenTitles = new Set(movieboxWithFallbacks.map(titleKey))
  const cinebaseResults = (cinebase?.results || []).flatMap((item: any) => {
    const key = titleKey(item)
    if (seenTitles.has(key)) return []
    seenTitles.add(key)
    const resourceKey = seal("movie-resource", { ...item, provider: "cinebase" }, 1800)
    return [{ ...item, resourceKey }]
  })
  const kamranResults = (kamran?.items || []).flatMap((item: any) => {
    const key = titleKey(item)
    if (seenTitles.has(key)) return []
    seenTitles.add(key)
    const { sourceUrl, ...publicMovie } = item
    const movie = { ...publicMovie, detailPath: "" }
    const resourceKey = seal("movie-resource", { ...item, provider: "kamran-sinhalasub", sourceUrl }, 86400)
    return [{ ...movie, resourceKey }]
  })
  const value = {
    success: true,
    results: [...movieboxWithFallbacks, ...cinebaseResults, ...kamranResults],
    page: Number(pager.page || payload?.page) || page,
    nextPage: Number(pager.nextPage || payload?.nextPage || kamran?.nextPage || cinebase?.nextPage) || (hasMore || Boolean(cinebase?.hasMore) ? page + 1 : null),
    hasMore: hasMore || Boolean(cinebase?.hasMore),
    totalCount: totalCount || cinebase?.totalCount,
  }
  searchCache.set(key, { expires: Date.now() + 30000, value })
  if (searchCache.size > 50) searchCache.delete(searchCache.keys().next().value!)
  return value
}

export async function movieDetail(subjectId: string) {
  const cached = detailCache.get(subjectId)
  if (cached && cached.expires > Date.now()) return cached.value
  let subject: any
  try {
    const raw = await movieBoxJson({ action: "detail", subjectId })
    subject = raw?.data?.subject || raw?.subject || raw?.data || raw
  } catch (primaryError) {
    try {
      const details = new URL(`${MOVIEBOX_API_3}/item-details`)
      details.searchParams.set("subjectId", subjectId)
      const raw = await providerJson(details.href, 12000)
      subject = raw?.data?.item || raw?.data?.subject || raw?.data || raw?.subject || raw
    } catch {
      try {
        const meta = await providerJson(`${METADATA}/detail?subjectId=${encodeURIComponent(subjectId)}`, 10000, metadataHeaders)
        const path = meta?.data?.subject?.detailPath || meta?.data?.detailPath || ""
        const raw = await providerJson(`${BACKUP}/detail/${encodeURIComponent(path || subjectId)}`, 12000)
        subject = raw?.data?.subject || raw?.data || raw?.subject || raw
      } catch {
        throw primaryError
      }
    }
  }
  if (!subject?.title && !subject?.subjectId) throw new ProviderError("Movie details were not found.", 404)
  subject = { ...subject, subjectId: String(subject.subjectId || subject.subject_id || subjectId) }
  detailCache.set(subjectId, { expires: Date.now() + 60_000, value: subject })
  if (detailCache.size > 100) detailCache.delete(detailCache.keys().next().value!)
  return subject
}

export async function movieResourceResponse(subjectId: string, detailPath: string, season = "0", episode = "0", taskId = "", taskParam = "taskId") {
  if (!detailPath && subjectId) {
    const detail = await movieDetail(subjectId)
    detailPath = String(detail.detailPath || detail.detail_path || detail.slug || "")
    if (!detailPath) throw new ProviderError("Movie details did not include a resource path.")
  }
  const query = new URLSearchParams({ se: season, ep: episode, detail_path: detailPath })
  const backupPathId = subjectId || taskId
  if (taskId) query.set(taskParam, taskId)
  const backupUrl = `${BACKUP}/api/stream/${encodeURIComponent(backupPathId)}?${query}`
  const movieboxApiStream = new URL(`${MOVIEBOX_API}/stream`)
  const movieboxQuery = new URLSearchParams({
    ...(subjectId ? { subjectId } : {}),
    detailPath,
    season,
    episode,
    quality: "720",
    ...(taskId ? { [taskParam]: taskId } : {}),
  })
  movieboxApiStream.search = movieboxQuery.toString()
  const primaryParams: Record<string, string> = {
    action: "download",
    ...(subjectId ? { subjectId } : {}),
    ...(detailPath ? { detailPath } : {}),
    se: season,
    ep: episode,
    ...(taskId ? { [taskParam]: taskId } : {}),
  }
  const attempts = [
    () => movieBoxDownloadJson(primaryParams),
    () => movieTaskRequest(backupUrl),
    () => movieTaskRequest(movieboxApiStream.href),
    () => movieboxApi3Resources(subjectId, detailPath, season, episode),
  ]
  const verifyCandidates = async (values: string[]) => {
    const checks = values.slice(0, 3).map(async value => {
      const local = movieLocalMediaPath(value)
      if (local) return local
      const url = allowedMediaUrl(value).href
      await probeMedia(url)
      return url
    })
    try { return await Promise.any(checks) } catch { return "" }
  }
  const candidates = attempts.map(attempt => async () => {
    const data = await attempt()
    const normalized = mergeMovieResourceResponses([data], subjectId || taskId)
    const payload = movieResourcePayload(normalized, subjectId || taskId)
    const records = Array.isArray(payload?.qualities) ? payload.qualities
      : Array.isArray(payload?.sources) ? payload.sources
      : Array.isArray(payload?.availableStreams) ? payload.availableStreams
      : Array.isArray(payload?.streams) ? payload.streams : [payload]
    const verified: any[] = []
    for (const record of records.slice(0, 3)) {
      const streamCandidates = movieSourceCandidates(record, "stream").filter(value => {
        try { allowedMediaUrl(value); return true } catch { return Boolean(movieLocalMediaPath(value)) }
      })
      const downloadCandidates = movieSourceCandidates(record, "download").filter(value => {
        try { allowedMediaUrl(value); return true } catch { return Boolean(movieLocalMediaPath(value)) }
      })
      let streamUrl = ""
      let downloadUrl = ""
      for (const candidate of [...new Set(streamCandidates)].slice(0, 3)) {
        streamUrl = await verifyCandidates([candidate])
        if (streamUrl) break
      }
      for (const candidate of [...new Set(downloadCandidates)].slice(0, 3)) {
        downloadUrl = await verifyCandidates([candidate])
        if (downloadUrl) break
      }
      if (streamUrl || downloadUrl) verified.push({
        quality: record?.quality || record?.resolution || record?.resolutions || "Auto",
        format: String(record?.format || (/\.m3u8(?:[?#]|$)/i.test(streamUrl || downloadUrl) ? "HLS" : /\.mpd(?:[?#]|$)/i.test(streamUrl || downloadUrl) ? "DASH" : "MP4")),
        size: record?.size || "",
        ...(streamUrl ? { streamUrl } : {}),
        ...(downloadUrl ? { downloadUrl } : {}),
      })
    }
    if (!verified.length) throw new ProviderError("This movie source returned no accessible movie file.")
    return { qualities: verified, subtitles: payload?.subtitles || payload?.proxySubtitles || [] }
  })
  let winner: any
  try {
    // OmegaTech is the configured default. Only race the alternate services
    // after its download action fails or returns no accessible media.
    winner = await candidates[0]()
  } catch (primaryError) {
    try {
      winner = await Promise.any(candidates.slice(1).map(attempt => attempt()))
    } catch {
      throw primaryError
    }
  }
  try {
    if (Array.isArray(winner.subtitles) && winner.subtitles.length) return winner
    let timer: ReturnType<typeof setTimeout> | undefined
    const captions = await Promise.race([
      movieboxApi3Subtitles(subjectId, detailPath, season, episode).catch(() => []),
      new Promise<any[]>(resolve => { timer = setTimeout(() => resolve([]), 1400) }),
    ]).finally(() => clearTimeout(timer))
    return { ...winner, ...(captions.length ? { subtitles: captions } : {}) }
  } catch (error) {
    if (error instanceof ProviderError) throw error
    throw new ProviderError("No movie download or playback source was returned by the available services.")
  }
}

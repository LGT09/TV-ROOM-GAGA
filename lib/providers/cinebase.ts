import "server-only"

import { seal } from "@/lib/library/tokens"
import { ProviderError } from "./http"
import { mergeMovieResourceResponses, movieSourceCandidates } from "./moviebox-resources"

const BASE = "https://movie-terms.vercel.app"

function apiKey() {
  const value = process.env.CINEBASE_API_KEY?.trim()
  if (!value) throw new ProviderError("CineBase is not configured. Add CINEBASE_API_KEY in workspace Secrets.", 503)
  return value
}

function arrayFrom(data: any): any[] {
  const queue = [data]
  const seen = new Set<any>()
  while (queue.length) {
    const value = queue.shift()
    if (!value || typeof value !== "object" || seen.has(value)) continue
    seen.add(value)
    if (Array.isArray(value)) return value
    for (const key of ["results", "items", "list", "data", "subjects", "trending", "movies", "shows"]) {
      if (Array.isArray(value[key])) return value[key]
      if (value[key] && typeof value[key] === "object") queue.push(value[key])
    }
  }
  return []
}

async function cinebaseJson(path: string, params: Record<string, string>, timeout = 12000) {
  // CineBase documents /proxy-api as the Vercel-safe API base; its /api
  // endpoints must be requested through that prefix to avoid HTTP 405s.
  const url = new URL(`/proxy-api${path.startsWith("/") ? path : `/${path}`}`, BASE)
  for (const [key, value] of Object.entries({ ...params, apikey: apiKey() })) url.searchParams.set(key, value)
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "TVRoomGaga/1.0" },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(timeout),
  }).catch((error: any) => {
    throw new ProviderError(error?.name === "TimeoutError" ? "CineBase timed out." : "CineBase could not be reached.")
  })
  const text = await response.text()
  if (text.length > 12_000_000) throw new ProviderError("CineBase returned an oversized response.")
  let data: any
  try { data = JSON.parse(text) } catch { throw new ProviderError("CineBase returned a non-JSON response.") }
  if (!response.ok) {
    const message = String(data?.error?.message || data?.error || data?.message || "")
    if (/this subject is a tv/i.test(message)) throw new ProviderError("This subject is a tv")
    throw new ProviderError(`CineBase returned HTTP ${response.status}.`, response.status)
  }
  if (data?.success === false || data?.error) {
    throw new ProviderError(String(data.error?.message || data.error || data.message || "CineBase could not complete the request."))
  }
  return data
}

function mediaUrl(value: unknown) {
  if (typeof value !== "string") return ""
  try {
    const url = new URL(value)
    if (url.protocol !== "https:" || url.username || url.password || !url.hostname ||
        /^(localhost|.*\.local)$/i.test(url.hostname) ||
        /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(url.hostname) ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(url.hostname)) return ""
    return url.href
  } catch { return "" }
}

function cinebaseMediaPath(source: string, detailPath: string, title: string, download: boolean) {
  const url = mediaUrl(source)
  if (!url) return ""
  const token = seal("media", {
    url,
    kind: "video",
    format: /\.m3u8(?:[?#]|$)/i.test(url) ? "HLS" : "MP4",
    title,
    cinebase: true,
    detailPath,
    downloadMode: download ? "original" : undefined,
  }, 21600)
  return `/api/media?key=${token}${download ? "&download=1" : /\.m3u8(?:[?#]|$)/i.test(url) ? "&format=hls" : ""}`
}

export async function cinebaseSearch(query: string, page: number) {
  const raw = await cinebaseJson("/api/search", { q: query, limit: "20", page: String(page) }, 10000)
  const payload = raw?.data && !Array.isArray(raw.data) ? raw.data : raw
  const results = arrayFrom(raw).flatMap((item: any) => {
    const detailPath = String(item?.detailPath || item?.detail_path || item?.slug || item?.id || item?.subjectId || item?.subject_id || "").trim()
    const title = String(item?.title || item?.name || item?.subjectName || "").trim()
    if (!title || !detailPath || detailPath.length > 500) return []
    const subjectId = String(item?.subjectId || item?.subject_id || item?.id || detailPath).trim()
    if (!/^[A-Za-z0-9_-]{1,200}$/.test(subjectId)) return []
    return [{
      subjectId,
      apiSubjectId: String(item?.subjectId || item?.subject_id || item?.id || subjectId),
      detailPath,
      title,
      cover: String(item?.cover?.url || item?.cover || item?.poster || item?.posterUrl || item?.poster_url || item?.image || ""),
      genre: item?.genre || item?.genres || item?.category || "",
      imdbRatingValue: item?.imdbRatingValue ?? item?.imdbRating ?? item?.rating ?? "",
      description: String(item?.description || item?.overview || item?.synopsis || ""),
      releaseDate: String(item?.releaseDate || item?.release_date || item?.year || ""),
      subjectType: item?.subjectType || item?.type || "",
      provider: "cinebase",
      proxyStream: "",
      proxyDownload: "",
    }]
  })
  const hasMore = Boolean(payload?.hasMore ?? payload?.pagination?.hasMore ?? payload?.nextPage)
  return { results, hasMore, nextPage: Number(payload?.nextPage) || (hasMore ? page + 1 : null), totalCount: Number(payload?.totalCount || payload?.total) || undefined }
}

export async function cinebaseProxyFetch(source: string, detailPath: string, download: boolean, filename: string, range?: string | null) {
  const url = mediaUrl(source)
  if (!url) throw new ProviderError("CineBase returned an invalid media URL.", 400)
  const params = new URLSearchParams({ url, dp: detailPath, apikey: apiKey() })
  if (download) params.set("name", filename)
  const endpoint = new URL(`/proxy-api/${download ? "dl" : "stream"}?${params}`, BASE)
  const response = await fetch(endpoint, {
    headers: { Accept: "*/*", "User-Agent": "TVRoomGaga/1.0", ...(range ? { Range: range } : {}) },
    cache: "no-store",
    redirect: "follow",
  }).catch(() => { throw new ProviderError("CineBase media proxy could not be reached.") })
  const type = response.headers.get("content-type") || ""
  if (!response.ok || /text\/html|application\/json/i.test(type)) {
    await response.body?.cancel()
    throw new ProviderError(`CineBase media proxy returned HTTP ${response.status || 502}.`)
  }
  return response
}

export async function cinebaseMovieResources(detailPath: string, title: string, season = 1, episode = 1) {
  const id = detailPath.trim()
  if (!id || id.length > 500) throw new ProviderError("CineBase title path is missing.", 400)
  let media: any
  let isTv = false
  try {
    media = await cinebaseJson("/api/movie", { id }, 18000)
    if (/this subject is a tv/i.test(String(media?.error || media?.message || ""))) throw new ProviderError("This subject is a tv")
  } catch (error) {
    if (!/this subject is a tv/i.test(error instanceof Error ? error.message : "")) throw error
    isTv = true
    media = await cinebaseJson("/api/tv", { id, season: String(season), episode: String(episode) }, 18000)
  }

  const normalized = mergeMovieResourceResponses([media], id)
  const records = Array.isArray(normalized?.qualities) ? normalized.qualities : []
  const candidates = records.length ? records : [normalized]
  const sources = candidates.flatMap((record: any, index: number) => {
    const streamUrl = movieSourceCandidates(record, "stream").map(mediaUrl).find(Boolean) || ""
    const downloadUrl = movieSourceCandidates(record, "download").map(mediaUrl).find(Boolean) || streamUrl
    if (!streamUrl && !downloadUrl) return []
    const quality = String(record?.quality || record?.resolution || record?.label || "Auto")
    return [{
      quality,
      format: String(record?.format || (/\.m3u8(?:[?#]|$)/i.test(streamUrl || downloadUrl) ? "HLS" : "MP4")).toUpperCase(),
      size: record?.size || "",
      proxyStream: streamUrl ? cinebaseMediaPath(streamUrl, id, title, false) : "",
      proxyDownload: downloadUrl ? cinebaseMediaPath(downloadUrl, id, title, true) : "",
      id: String(index),
    }]
  })
  const [details, captions] = await Promise.allSettled([
    cinebaseJson("/api/details", { id }, 10000),
    cinebaseJson("/api/subtitles", { id, ...(isTv ? { season: String(season), episode: String(episode) } : {}) }, 10000),
  ])
  const subtitles = captions.status === "fulfilled" ? arrayFrom(captions.value).flatMap((item: any, index: number) => {
    const url = mediaUrl(String(item?.url || item?.file || item?.src || ""))
    return url ? [{
      id: String(item?.id || index),
      language: String(item?.language || item?.lang || item?.name || "Subtitles"),
      label: String(item?.label || item?.language || item?.lang || "Subtitles"),
      url: `/api/subtitle?key=${seal("caption", { url, cinebase: true, detailPath: id }, 21600)}`,
    }] : []
  }) : []
  const detail = details.status === "fulfilled" ? details.value?.data || details.value?.result || details.value : {}
  if (!sources.length) throw new ProviderError("CineBase did not return a playable or downloadable file.")
  return { sources, subtitles, detail }
}

import "server-only"

import { BROWSER_USER_AGENT, ProviderError, providerJson } from "./http"
import { allowedMediaUrl } from "./media-url"
import { seal } from "@/lib/library/tokens"
import { movieLocalMediaPath, movieResourcePayload, movieSourceCandidates } from "./moviebox-resources"

const API = "https://api.omegatech.app/api/movie/MovieBox-pro"
const BACKUP = "https://moviebox-api-eight.vercel.app"
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

export async function movieSearch(query: string, page: number) {
  const key = `${query.toLowerCase()}\n${page}`
  const cached = searchCache.get(key)
  if (cached && cached.expires > Date.now()) return cached.value
  let raw: any
  let primaryError: unknown
  try { raw = await movieBoxJson({ action: "search", keyword: query, page: String(page) }) }
  catch (error) { primaryError = error }
  let payload = raw?.data?.data || raw?.data || raw
  let items = Array.isArray(payload?.results) ? payload.results : Array.isArray(payload?.items) ? payload.items : []
  if (!items.length) {
    try {
      const url = new URL(`${BACKUP}/search`)
      url.search = new URLSearchParams({ q: query, page: String(page) }).toString()
      raw = await providerJson(url.href, 12000)
      payload = raw?.data?.data || raw?.data || raw
      items = Array.isArray(payload?.results) ? payload.results : Array.isArray(payload?.items) ? payload.items : []
    } catch {
      if (primaryError) throw primaryError
    }
  }
  const pager = payload?.pager || payload?.pagination || {}
  const totalCount = Number(pager.totalCount || payload?.total) || undefined
  const hasMore = Boolean(pager.hasMore ?? payload?.hasMore ?? (totalCount ? page * 20 < totalCount : false))
  const value = {
    success: true,
    results: items.map((item: any) => {
      const subjectId = String(item.subjectId || item.subject_id || item.id || "")
      const title = String(item.title || item.name || "Untitled")
      const proxyStream = safeSource(item, title)
      const proxyDownload = safeSource(item, title, true)
      const proxySubtitles = safeCaptions(item.proxySubtitles)
      const movie = {
        subjectId,
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
      const resourceKey = proxyStream || proxyDownload
        ? seal("movie-resource", movie, 1800)
        : ""
      return { ...movie, resourceKey }
    }).filter((item: any) => /^\d{5,32}$/.test(item.subjectId)),
    page: Number(pager.page || payload?.page) || page,
    nextPage: Number(pager.nextPage || payload?.nextPage) || (hasMore ? page + 1 : null),
    hasMore,
    totalCount,
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
      const meta = await providerJson(`${METADATA}/detail?subjectId=${encodeURIComponent(subjectId)}`, 10000, metadataHeaders)
      const path = meta?.data?.subject?.detailPath || meta?.data?.detailPath || ""
      const raw = await providerJson(`${BACKUP}/detail/${encodeURIComponent(path || subjectId)}`, 12000)
      subject = raw?.data?.subject || raw?.data || raw?.subject || raw
    } catch {
      throw primaryError
    }
  }
  if (!subject?.title && !subject?.subjectId) throw new ProviderError("Movie details were not found.", 404)
  subject = { ...subject, subjectId: String(subject.subjectId || subject.subject_id || subjectId) }
  detailCache.set(subjectId, { expires: Date.now() + 60_000, value: subject })
  if (detailCache.size > 100) detailCache.delete(detailCache.keys().next().value!)
  return subject
}

export async function movieResourceResponse(subjectId: string, detailPath: string, season = "0", episode = "0") {
  let primary: any
  try { primary = await movieBoxJson({ action: "download", subjectId, detailPath, se: season, ep: episode }, 18000) }
  catch (error) {
    try {
      const query = new URLSearchParams({ se: season, ep: episode, detail_path: detailPath })
      return await providerJson(`${BACKUP}/api/stream/${encodeURIComponent(subjectId)}?${query}`, 12000)
    } catch { throw error }
  }
  const payload = movieResourcePayload(primary, subjectId)
  const sources = Array.isArray(payload?.qualities) ? payload.qualities
    : Array.isArray(payload?.sources) ? payload.sources
    : Array.isArray(payload?.availableStreams) ? payload.availableStreams : []
  if (sources.some((item: any) => movieSourceCandidates(item, "stream").length || movieSourceCandidates(item, "download").length) ||
      movieSourceCandidates(payload, "stream").length || movieSourceCandidates(payload, "download").length) return primary
  try {
    const query = new URLSearchParams({ se: season, ep: episode, detail_path: detailPath })
    return await providerJson(`${BACKUP}/api/stream/${encodeURIComponent(subjectId)}?${query}`, 12000)
  } catch { return primary }
}

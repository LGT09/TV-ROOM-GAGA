import "server-only"

import { BROWSER_USER_AGENT, ProviderError } from "./http"
import { allowedMediaUrl } from "./media-url"
import { seal } from "@/lib/library/tokens"

const API = "https://api.omegatech.app/api/movie/MovieBox-pro"
const searchCache = new Map<string, { expires: number; value: unknown }>()
function safeSource(value: unknown, title: string, download = false) {
  if (typeof value !== "string" || !value) return null
  if (/^\/api\/media(?:\?|$)/.test(value)) return value
  try {
    const url = allowedMediaUrl(value)
    const hls = /\.m3u8(?:[?#]|$)/i.test(url.href)
    const token = seal("media", { url: url.href, kind: "video", title, format: hls ? "HLS" : "MP4", downloadMode: download ? "original" : undefined }, 21600)
    return `/api/media?key=${token}${download ? "&download=1" : hls ? "&format=hls" : ""}`
  } catch { return null }
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
  const raw = await movieBoxJson({ action: "search", keyword: query, page: String(page) })
  const payload = raw?.data?.data || raw?.data || raw
  const items = Array.isArray(payload?.results) ? payload.results : Array.isArray(payload?.items) ? payload.items : []
  const pager = payload?.pager || payload?.pagination || {}
  const value = {
    success: true,
    results: items.map((item: any) => ({
      subjectId: String(item.subjectId || item.id || ""),
      detailPath: String(item.detailPath || ""),
      title: String(item.title || "Untitled"),
      cover: item.cover?.url || item.cover || item.thumbnail || "",
      genre: item.genre || item.genres || "",
      imdbRatingValue: item.imdbRatingValue ?? item.rating ?? "",
      description: item.description || "",
      releaseDate: item.releaseDate || "",
      proxyStream: safeSource(item.proxyStream, String(item.title || "Movie")),
      proxyDownload: safeSource(item.proxyDownload, String(item.title || "Movie"), true),
      proxySubtitles: safeCaptions(item.proxySubtitles),
      subjectType: item.subjectType,
    })).filter((item: any) => /^\d{5,32}$/.test(item.subjectId)),
    page: Number(pager.page) || page,
    nextPage: Number(pager.nextPage) || (pager.hasMore ? page + 1 : null),
    hasMore: Boolean(pager.hasMore),
    totalCount: Number(pager.totalCount) || undefined,
  }
  searchCache.set(key, { expires: Date.now() + 30000, value })
  if (searchCache.size > 50) searchCache.delete(searchCache.keys().next().value!)
  return value
}

export async function movieDetail(subjectId: string) {
  const raw = await movieBoxJson({ action: "detail", subjectId })
  return raw?.data?.subject || raw?.subject || raw?.data || raw
}

export async function movieResourceResponse(subjectId: string, detailPath: string, season = "0", episode = "0") {
  return movieBoxJson({ action: "download", subjectId, detailPath, se: season, ep: episode }, 22000)
}

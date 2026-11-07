import { NextResponse } from "next/server"
import { movieBoxJson, movieDetail, movieResourceResponse, movieSearch } from "@/lib/providers/moviebox"
import { ProviderError } from "@/lib/providers/http"
import { allowedMediaUrl } from "@/lib/providers/media-url"
import { seal, unseal } from "@/lib/library/tokens"
import { movieLocalMediaPath, movieResourcePayload, movieSourceCandidates } from "@/lib/providers/moviebox-resources"
import { kamranMovieDownloads, safeKamranDownloadPage } from "@/lib/providers/kamran-movies"

export const dynamic = "force-dynamic"
export const maxDuration = 30

function mediaPath(input: unknown, kind: "video" | "subtitle", title: string, download = false, fallbackInputs: unknown[] = []): string {
  if (typeof input !== "string" || !input) return ""
  if (kind === "subtitle" && /^\/api\/subtitle(?:\?|$)/.test(input)) return input
  if (kind === "video") {
    const local = movieLocalMediaPath(input, download)
    if (local) return local
  }
  const url = allowedMediaUrl(input)
  if (kind === "subtitle") return `/api/subtitle?key=${seal("caption", { url: url.href }, 21600)}`
  const fallbacks = [...new Set(fallbackInputs.flatMap(value => {
    if (typeof value !== "string" || !value || value === input || /^\/api\/media(?:\?|$)/.test(value)) return []
    try { return [allowedMediaUrl(value).href] } catch { return [] }
  }))].filter(value => value !== url.href).slice(0, 2)
  const hls = /\.m3u8(?:[?#]|$)/i.test(url.href)
  const key = seal("media", { url: url.href, ...(fallbacks.length ? { fallbacks } : {}), kind: "video", title, format: hls ? "HLS" : "MP4", downloadMode: download ? "original" : undefined }, 21600)
  return `/api/media?key=${key}${download ? "&download=1" : hls ? "&format=hls" : ""}`
}

function subtitlesOf(values: any, title: string) {
  const valuesArray = Array.isArray(values) ? values : typeof values === "object" && values ? Object.values(values) : []
  return valuesArray.flatMap((entry: any, index: number) => {
    const url = typeof entry === "string" ? entry : entry?.url || entry?.subtitleUrl || entry?.proxySubtitles
    if (typeof url !== "string" || !url) return []
    try {
      return [{ id: String(entry?.id || index), language: String(entry?.language || entry?.lang || entry?.name || `Subtitle ${index + 1}`), label: String(entry?.label || entry?.language || entry?.lang || `Subtitle ${index + 1}`), url: mediaPath(url, "subtitle", title) }]
    } catch { return [] }
  })
}

function resourceSources(data: any, subject: any) {
  data = movieResourcePayload(data, String(subject?.subjectId || ""))
  const title = String(subject?.title || "Movie")
  const qualities = Array.isArray(data?.qualities) ? data.qualities
    : Array.isArray(data?.sources) ? data.sources
    : Array.isArray(data?.availableStreams) ? data.availableStreams
    : Array.isArray(data?.streams) ? data.streams : []
  const options = qualities.length ? qualities : (data?.proxyStream || data?.proxyDownload || data?.streamUrl || data?.downloadUrl ||
    data?.bestQualityUrl || data?.best_quality_url || data?.hls || data?.dash || subject?.proxyStream || subject?.proxyDownload ? [{
    quality: data?.quality || subject?.quality || "Auto", format: data?.format || subject?.format || "MP4",
    proxyStream: data?.proxyStream || subject?.proxyStream,
    proxyDownload: data?.proxyDownload || subject?.proxyDownload,
    streamUrl: data?.streamUrl || subject?.streamUrl,
    downloadUrl: data?.downloadUrl || subject?.downloadUrl,
    bestQualityUrl: data?.bestQualityUrl || data?.best_quality_url || data?.hls || data?.dash,
  }] : [])
  const bestUrl = typeof data?.bestQualityUrl === "string" ? data.bestQualityUrl
    : typeof data?.best_quality_url === "string" ? data.best_quality_url : ""
  if (bestUrl && !options.some((item: any) => movieSourceCandidates(item, "stream").includes(bestUrl))) {
    options.push({ quality: data?.bestQuality || "Best (Auto)", format: "MP4", streamUrl: bestUrl, downloadUrl: bestUrl })
  }
  const sources = options.flatMap((item: any) => {
    const resolve = (kind: "stream" | "download") => {
      const candidates = movieSourceCandidates(item, kind)
      const accepted: string[] = []
      for (const value of candidates) {
        const local = movieLocalMediaPath(value, kind === "download")
        if (local) return local
        try { accepted.push(allowedMediaUrl(value).href) } catch {}
      }
      const urls = [...new Set(accepted)]
      return urls.length ? mediaPath(urls[0], "video", title, kind === "download", urls.slice(1)) : ""
    }
    const proxyStream = resolve("stream")
    const proxyDownload = resolve("download")
    return proxyStream || proxyDownload ? [{
      quality: String(item?.quality || item?.resolution || item?.resolutions || "Auto"),
      format: String(item?.format || "MP4").toUpperCase(),
      size: item?.size || "",
      proxyStream,
      proxyDownload,
    }] : []
  })
  const uniqueSources = sources.filter((source: any, index: number) =>
    sources.findIndex((other: any) => other.proxyStream === source.proxyStream && other.proxyDownload === source.proxyDownload && other.quality === source.quality) === index)
  return {
    sources: uniqueSources,
    proxyStream: uniqueSources[0]?.proxyStream || "",
    proxyDownload: uniqueSources[0]?.proxyDownload || "",
    proxySubtitles: subtitlesOf(data?.proxySubtitles || data?.subtitles || subject?.proxySubtitles || [], title),
    message: uniqueSources.length ? "" : "No playable movie file is available for this title right now.",
  }
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const action = params.get("action") || "search"
  try {
    if (action === "search") {
      const query = (params.get("query") || params.get("keyword") || "").trim().slice(0, 120)
      if (!query) return NextResponse.json({ success: true, results: [], page: 1, hasMore: false, nextPage: null })
      const page = Math.max(1, Math.min(1000, Number(params.get("page")) || 1))
      return NextResponse.json(await movieSearch(query, page), { headers: { "Cache-Control": "private, max-age=20, stale-while-revalidate=30" } })
    }
    if (action === "download-page") {
      const token = params.get("pageKey") || ""
      const page = unseal<{ url: string }>(token, "kamran-download-page")
      const url = safeKamranDownloadPage(page?.url)
      if (!url) throw new ProviderError("This download page is not supported.", 400)
      return NextResponse.redirect(new URL(url), { status: 302, headers: { "Cache-Control": "no-store" } })
    }
    const subjectId = params.get("subjectId") || ""
    if (!/^\d{5,32}$/.test(subjectId)) throw new ProviderError("Invalid movie title ID.", 400)
    if (action === "detail") {
      const resourceToken = params.get("resourceKey") || ""
      if (resourceToken && resourceToken.length <= 12000) {
        try {
          const resource = unseal<any>(resourceToken, "movie-resource")
          if (String(resource.subjectId) !== subjectId) throw new ProviderError("Movie source does not match this title.", 400)
          if (resource.provider === "kamran-sinhalasub") {
            const pages = await kamranMovieDownloads(String(resource.sourceUrl || ""))
            const downloadPages = pages.map(page => ({
              quality: page.quality,
              size: page.size,
              url: `/api/moviebox?action=download-page&pageKey=${encodeURIComponent(seal("kamran-download-page", { url: page.url }, 900))}`,
            }))
            const subject = {
              subjectId,
              title: String(resource.title || "Movie"),
              cover: String(resource.cover || ""),
              genre: String(resource.genre || ""),
              description: String(resource.description || ""),
              releaseDate: String(resource.releaseDate || ""),
              imdbRatingValue: resource.imdbRatingValue || "",
              detailPath: String(resource.detailPath || ""),
            }
            return NextResponse.json({
              success: true,
              subject,
              sources: [],
              downloadPages,
              proxySubtitles: [],
              message: downloadPages.length ? "" : "No download pages are available for this title.",
            }, { headers: { "Cache-Control": "private, no-store" } })
          }
          const proxyStream = movieLocalMediaPath(String(resource.proxyStream || ""))
          const proxyDownload = movieLocalMediaPath(String(resource.proxyDownload || ""), true)
          if (proxyStream || proxyDownload) {
            const sources = [{
              quality: String(resource.quality || "Auto"),
              format: String(resource.format || "MP4").toUpperCase(),
              size: resource.size || "",
              proxyStream,
              proxyDownload,
            }]
            const proxySubtitles = Array.isArray(resource.proxySubtitles)
              ? resource.proxySubtitles.filter((item: any) => typeof item?.url === "string" && /^\/api\/subtitle\?key=/.test(item.url))
              : []
            const subject = {
              subjectId,
              title: String(resource.title || "Movie"),
              cover: String(resource.cover || ""),
              genre: String(resource.genre || ""),
              description: String(resource.description || ""),
              releaseDate: String(resource.releaseDate || ""),
              imdbRatingValue: resource.imdbRatingValue || "",
              detailPath: String(resource.detailPath || ""),
            }
            return NextResponse.json({ success: true, subject, sources, proxyStream, proxyDownload, proxySubtitles, message: "" }, { headers: { "Cache-Control": "private, no-store" } })
          }
        } catch (error) {
          if (error instanceof ProviderError) throw error
        }
      }
      const suppliedPath = (params.get("detailPath") || "").slice(0, 250)
      if (suppliedPath && (suppliedPath.includes("..") || suppliedPath.includes("://") || suppliedPath.includes("\\") || suppliedPath.startsWith("/"))) {
        throw new ProviderError("Invalid movie detail path.", 400)
      }
      const subject = suppliedPath
        ? { subjectId, title: params.get("title") || "Movie", detailPath: suppliedPath }
        : await movieDetail(subjectId)
      if (String(subject?.subjectId || subjectId) !== subjectId) throw new ProviderError("Movie details did not match this title.")
      const detailPath = suppliedPath || String(subject.detailPath || "")
      if (!detailPath) throw new ProviderError("Movie details did not include a resource path.")
      const download = await movieResourceResponse(subjectId, detailPath, "0", "0")
      return NextResponse.json({
        success: true,
        subject: {
          subjectId,
          title: String(subject.title || "Movie"),
          cover: subject.cover?.url || subject.cover || "",
          genre: subject.genre || "",
          description: subject.description || "",
          releaseDate: subject.releaseDate || "",
          imdbRatingValue: subject.imdbRatingValue || "",
          detailPath,
          subjectType: subject.subjectType,
        },
        ...resourceSources(download, subject),
      }, { headers: { "Cache-Control": "private, no-store" } })
    }
    if (action === "resource") {
      const detailPath = (params.get("detailPath") || "").slice(0, 250)
      if (!/^[A-Za-z0-9_-]{1,250}$/.test(detailPath)) throw new ProviderError("A valid title detail path is required.", 400)
      const subject = await movieDetail(subjectId)
      const download = await movieResourceResponse(subjectId, detailPath, "0", "0")
      return NextResponse.json({ success: true, ...resourceSources(download, subject) }, { headers: { "Cache-Control": "private, no-store" } })
    }
    throw new ProviderError("Unknown movie action.", 400)
  } catch (error) {
    const status = error instanceof ProviderError ? error.status : 502
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Movie request failed.", results: [], sources: [], proxySubtitles: [] }, { status })
  }
}

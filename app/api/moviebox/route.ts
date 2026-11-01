import { NextResponse } from "next/server"
import { movieBoxJson, movieDetail, movieResourceResponse, movieSearch } from "@/lib/providers/moviebox"
import { ProviderError } from "@/lib/providers/http"
import { allowedMediaUrl } from "@/lib/providers/media-url"
import { seal } from "@/lib/library/tokens"

export const dynamic = "force-dynamic"
export const maxDuration = 30

function mediaPath(input: unknown, kind: "video" | "subtitle", title: string, download = false): string {
  if (typeof input !== "string" || !input) return ""
  if ((kind === "subtitle" && /^\/api\/subtitle(?:\?|$)/.test(input)) || (kind === "video" && /^\/api\/media(?:\?|$)/.test(input))) return input
  const url = allowedMediaUrl(input)
  if (kind === "subtitle") return `/api/subtitle?key=${seal("caption", { url: url.href }, 21600)}`
  const hls = /\.m3u8(?:[?#]|$)/i.test(url.href)
  const key = seal("media", { url: url.href, kind: "video", title, format: hls ? "HLS" : "MP4", downloadMode: download ? "original" : undefined }, 21600)
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
  const title = String(subject?.title || "Movie")
  const qualities = Array.isArray(data?.qualities) ? data.qualities : Array.isArray(data?.sources) ? data.sources : []
  const options = qualities.length ? qualities : (data?.proxyStream || data?.proxyDownload || subject?.proxyStream || subject?.proxyDownload ? [{
    quality: data?.quality || subject?.quality || "Auto", format: data?.format || subject?.format || "MP4",
    streamUrl: data?.proxyStream || subject?.proxyStream, downloadUrl: data?.proxyDownload || subject?.proxyDownload,
  }] : [])
  const sources = options.flatMap((item: any) => {
    const resolve = (values: unknown[], download = false) => {
      for (const value of values) {
        try {
          const url = mediaPath(value, "video", title, download)
          if (url) return url
        } catch {}
      }
      return ""
    }
    // Prefer a validated original CDN URL over companion gateways that may reject
    // browser playback. Keep provider-supplied proxy URLs when they are already local.
    const proxyStream = resolve([item?.proxyStream, item?.directUrl, item?.streamUrl, item?.url])
    const proxyDownload = resolve([item?.proxyDownload, item?.directDownloadUrl, item?.directUrl, item?.downloadUrl, item?.url], true)
    return proxyStream || proxyDownload ? [{
      quality: String(item?.quality || item?.resolution || "Auto"),
      format: String(item?.format || "MP4").toUpperCase(),
      size: item?.size || "",
      proxyStream,
      proxyDownload,
    }] : []
  })
  return {
    sources,
    proxyStream: sources[0]?.proxyStream || "",
    proxyDownload: sources[0]?.proxyDownload || "",
    proxySubtitles: subtitlesOf(data?.proxySubtitles || data?.subtitles || subject?.proxySubtitles || [], title),
    message: sources.length ? "" : "No playable movie file is available for this title right now.",
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
    const subjectId = params.get("subjectId") || ""
    if (!/^\d{5,32}$/.test(subjectId)) throw new ProviderError("Invalid movie title ID.", 400)
    if (action === "detail") {
      const subject = await movieDetail(subjectId)
      if (String(subject?.subjectId || subjectId) !== subjectId) throw new ProviderError("Movie details did not match this title.")
      const download = await movieResourceResponse(subjectId, String(subject.detailPath || ""), "0", "0")
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
          detailPath: String(subject.detailPath || ""),
          subjectType: subject.subjectType,
        },
        ...resourceSources(download, subject),
      }, { headers: { "Cache-Control": "private, no-store" } })
    }
    if (action === "resource") {
      const detailPath = (params.get("detailPath") || "").slice(0, 250)
      if (!detailPath || detailPath.includes("..") || detailPath.includes("://")) throw new ProviderError("A valid title detail path is required.", 400)
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

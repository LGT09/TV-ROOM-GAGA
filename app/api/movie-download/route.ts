import { NextResponse } from "next/server"
import { libraryDetail, libraryList, libraryStream } from "@/lib/library/service"
import { ProviderError } from "@/lib/providers/http"

export const dynamic = "force-dynamic"
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams
  try {
    if (["search", "suggest"].includes(p.get("action") || "search")) {
      const data = await libraryList(new URLSearchParams({ q: p.get("query") || "", limit: "12" }))
      const results = data.items.map((item: any) => ({ ...item, id: item.key, source: "TV Room", quality: "Choose quality", size: "", downloadUrl: `/api/movie-download?action=download&key=${encodeURIComponent(item.key)}` }))
      return NextResponse.json({ success: true, results, suggestions: results })
    }
    if (p.get("url")) {
      const url = new URL(p.get("url")!, "https://tvroom.invalid")
      if (url.origin !== "https://tvroom.invalid" || url.pathname !== "/api/movie-download") throw new ProviderError("Select a title from the library.", 400)
      p.set("key", url.searchParams.get("key") || "")
    }
    if (p.get("action") === "detail") return NextResponse.json(await libraryDetail(p.get("key") || ""))
    const detail = await libraryDetail(p.get("key") || "")
    if (detail.seasons.length && (!p.get("season") || !p.get("episode"))) throw new ProviderError("Choose a season and episode in Movies & series before downloading.", 409)
    const data = await libraryStream(detail.item.key, p)
    const best = [...data.sources].filter(s => s.downloadUrl).sort((a, b) => (parseInt(b.quality) || 0) - (parseInt(a.quality) || 0))[0]
    if (!best) throw new ProviderError("No downloadable file is available for this selection.", 502)
    return NextResponse.json({ success: true, source: "TV Room", title: detail.item.title, filename: `${detail.item.title}.mp4`, downloadUrl: best.downloadUrl, quality: best.quality, downloadLinks: data.sources.filter(s => s.downloadUrl).map(s => ({ url: s.downloadUrl, quality: s.quality })) })
  } catch (e) {
    return NextResponse.json({ success: false, results: [], error: e instanceof ProviderError ? e.message : "Download unavailable. Please use Movies & series." }, { status: e instanceof ProviderError ? e.status : 502 })
  }
}
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const url = new URL(request.url)
    for (const [k, v] of Object.entries(body)) if (typeof v === "string" || typeof v === "number") url.searchParams.set(k, String(v))
    return GET(new Request(url))
  } catch { return NextResponse.json({ success: false, error: "Invalid request." }, { status: 400 }) }
}

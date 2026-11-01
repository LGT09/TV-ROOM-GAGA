import { NextResponse } from "next/server"
import { sportJson, safeMatch } from "@/lib/providers/sport"
import { ProviderError } from "@/lib/providers/http"
import { allowedMediaUrl } from "@/lib/providers/media-url"
import { seal } from "@/lib/library/tokens"

export const dynamic = "force-dynamic"
export const maxDuration = 30

function mediaProxy(input: unknown, title: string) {
  if (typeof input !== "string" || !input) return ""
  try {
    const url = allowedMediaUrl(input)
    if (!url.hostname.endsWith(".aisports.mobi") && url.hostname !== "aisports.mobi") return ""
    return `/api/media?key=${seal("media", { url: url.href, kind: "video", format: "HLS", title }, 900)}&format=hls`
  } catch { return "" }
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const action = params.get("action") || "aggregate"
  try {
    const query = Object.fromEntries(params.entries())
    const raw = await sportJson(query)
    const data = raw?.data || raw
    if (action === "match-detail") {
      const match = data?.match || {}
      const streams = Array.isArray(data?.streams) ? data.streams : []
      const playable = streams.find((item: any) => String(item.type || "").toLowerCase() === "hls" && item.url)
      const proxyStream = mediaProxy(playable?.url || data?.match?.playPath, `${match.home || "Home"} vs ${match.away || "Away"}`)
      const safe = safeMatch(match)
      safe.proxyStream = ""
      return NextResponse.json({ success: true, match: safe, proxyStream, streams: proxyStream ? [{ quality: playable?.quality || "Live", type: "HLS", url: proxyStream }] : [], message: proxyStream ? "" : "No live stream is currently available for this match." }, { headers: { "Cache-Control": "private, no-store" } })
    }
    const matches = Array.isArray(data?.matches) ? data.matches : []
    const safe = matches.map((match: any) => {
      const value = safeMatch(match)
      const name = `${match?.home?.name || "Home"} vs ${match?.away?.name || "Away"}`
      return { ...value, proxyStream: mediaProxy(value.proxyStream, name) }
    })
    return NextResponse.json({ success: true, ...data, matches: safe, leagues: data?.leagues || [], news: data?.news || [], note: action === "trend" || action === "feeds" ? "This API maps trend to aggregate and feeds to live because those two action names are not supported upstream." : undefined }, { headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=30" } })
  } catch (error) {
    const status = error instanceof ProviderError ? error.status : 502
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Sport service unavailable.", matches: [], leagues: [], news: [] }, { status })
  }
}

import { NextResponse } from "next/server"
import { providerJson, ProviderError, webUrl } from "@/lib/providers/http"
import { resolveYoutube } from "@/lib/music/youtube"

const BASE = "https://knightbotapi.stream/api"
const platforms = ["youtube-audio", "youtube-video", "facebook", "instagram", "tiktok"]
const hosts: Record<string, string[]> = {
  "youtube-audio": ["youtube.com", "youtu.be"], "youtube-video": ["youtube.com", "youtu.be"],
  facebook: ["facebook.com", "fb.watch"], instagram: ["instagram.com"], tiktok: ["tiktok.com"],
}

function normalize(data: any, platform: string) {
  const info = data?.result || data?.data || data?.info || data
  const links: { label: string; url: string; quality: string }[] = []
  const seen = new Set<string>()
  const add = (value: any, label: string, quality = "") => {
    const url = webUrl(value)
    if (url && !seen.has(url)) { seen.add(url); links.push({ label, url, quality }) }
  }
  const walk = (v: any, depth = 0, label = "Download") => {
    if (!v || depth > 7) return
    if (typeof v === "string") { if (/\.(mp4|mp3|m4a|webm)(?:[?#]|$)/i.test(v)) add(v, label); return }
    if (Array.isArray(v)) { v.forEach((m, i) => walk(m, depth + 1, `Media ${i + 1}`)); return }
    if (typeof v !== "object") return
    const quality = String(v.quality || v.resolution || "")
    for (const key of ["download_url", "downloadUrl", "dl_url", "dl", "url", "link", "video", "nowatermark", "no_watermark", "watermark", "hd", "sd", "hd_url", "sd_url", "audio", "music", "mp3", "mp4", "play"]) {
      if (typeof v[key] === "string") add(v[key], v.type || v.label || (quality ? `Download ${quality}` : key.replaceAll("_", " ")), quality)
    }
    for (const key of ["data", "result", "results", "media", "medias", "links", "downloads", "formats", "video", "audio"]) if (typeof v[key] === "object") walk(v[key], depth + 1, label)
  }
  walk(data)
  if (!links.length) throw new ProviderError("The provider returned no downloadable media. Try a different public link.")
  return { success: true, platform, title: String(info.title || data.title || info.caption || "Media download"),
    thumbnail: webUrl(info.thumbnail || info.thumb || info.cover || data.thumbnail), duration: info.duration || null, links }
}

export const dynamic = "force-dynamic"
export const maxDuration = 60
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams
  const platform = p.get("platform") || ""
  try {
    if (!platforms.includes(platform)) throw new ProviderError("Choose YouTube audio/video, Facebook, Instagram or TikTok.", 400)
    const input = (p.get("query") || p.get("url") || "").trim()
    if (!input || input.length > 2000) throw new ProviderError("Enter a public media URL or YouTube search query.", 400)
    const isQuery = Boolean(p.get("query"))
    if (!isQuery) {
      const url = webUrl(input)
      if (!url) throw new ProviderError("Enter a valid HTTP or HTTPS media URL.", 400)
      const hostname = new URL(url).hostname
      if (!hosts[platform].some(h => hostname === h || hostname.endsWith(`.${h}`))) throw new ProviderError("The URL does not match the selected platform.", 400)
    } else if (!platform.startsWith("youtube-")) throw new ProviderError("Search queries are supported for YouTube only.", 400)
    const quality = p.get("quality") || "720p"
    if (!["360p", "480p", "720p", "1080p"].includes(quality)) throw new ProviderError("Unsupported video quality.", 400)
    if(platform.startsWith("youtube-")) {
      const result=await resolveYoutube(input,platform==="youtube-audio"?"audio":"video","",quality)
      return NextResponse.json({...result,platform,links:[{label:`Download full ${platform==="youtube-audio"?"audio":"video"}`,url:result.downloadUrl,quality:result.format}]},{headers:{"Cache-Control":"no-store"}})
    }
    const query = new URLSearchParams({ apikey: "knight" })
    let endpoint: string
    if (isQuery) {
      endpoint = platform === "youtube-audio" ? "ytmp3" : "ytmp4"
      query.set("query", input)
    } else {
      query.set("url", input)
      endpoint = platform === "youtube-video" ? "download/ytmp4" : platform === "youtube-audio" ? "download" : `download/${platform}`
      if (platform === "youtube-video") query.set("format", quality)
      if (platform === "youtube-audio") query.set("type", "mp3")
    }
    const data = await providerJson(`${BASE}/${endpoint}?${query}`, 25000)
    return NextResponse.json(normalize(data, platform), { headers: { "Cache-Control": "no-store" } })
  } catch (e) {
    return NextResponse.json({ success: false, links: [], error: e instanceof Error ? e.message : "Download provider unavailable." }, { status: e instanceof ProviderError ? e.status : 502 })
  }
}

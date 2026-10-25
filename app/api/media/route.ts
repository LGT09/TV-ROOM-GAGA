import { NextResponse } from "next/server"
export const maxDuration=60
import { allowedMediaUrl, mediaFetch } from "@/lib/providers/media-url"
import { ProviderError } from "@/lib/providers/http"
import { seal, unseal } from "@/lib/library/tokens"

type MediaToken = { url: string; title?: string; kind: string; format?: string; fallbacks?: string[]; branded?:boolean }
export const dynamic = "force-dynamic"
export async function GET(request: Request) {
  try {
    const p = new URL(request.url).searchParams
    const token = unseal<MediaToken>(p.get("key") || "", "media")
    const range = request.headers.get("range")
    if (range && !/^bytes=\d+-\d*$/.test(range)) throw new ProviderError("Invalid byte range.", 416)
    let response:Response|undefined
    let lastError:unknown
    for(const url of [token.url,...(Array.isArray(token.fallbacks)?token.fallbacks.slice(0,2):[])]) {
      try {
        const candidate=await mediaFetch(url,range?{Range:range}:{},8000)
        if(/text\/html|application\/json/i.test(candidate.headers.get("content-type")||"")){
          await candidate.body?.cancel()
          throw new ProviderError("The media file is unavailable.")
        }
        response=candidate
        break
      }catch(error){lastError=error}
    }
    if(!response)throw lastError||new ProviderError("The media file is unavailable.")
    const type = response.headers.get("content-type") || (token.kind === "image" ? "image/jpeg" : token.kind==="audio"?"audio/mpeg":"video/mp4")
    if (/text\/html|application\/json/i.test(type)) { await response.body?.cancel(); throw new ProviderError("The media file is unavailable.") }
    const hls = token.format === "HLS" || /mpegurl/i.test(type) || /\.m3u8(?:[?#]|$)/i.test(token.url)
    if (hls) {
      if (p.get("download") === "1") throw new ProviderError("This is an adaptive stream, not a downloadable movie file.", 400)
      const text = await response.text()
      if (text.length > 1_000_000 || !text.trimStart().startsWith("#EXTM3U")) throw new ProviderError("Invalid stream manifest.")
      const child = (relative: string) => {
        const url = new URL(relative, response.url||token.url).href
        allowedMediaUrl(url)
        const format = /\.m3u8(?:[?#]|$)/i.test(url) ? "HLS" : "segment"
        return `/api/media?key=${seal("media", { url, kind: "video", format }, 21600)}${format === "HLS" ? "&format=hls" : ""}`
      }
      const manifest = text.split(/\r?\n/).map(line => {
        if (!line.trim()) return line
        if (!line.startsWith("#")) return child(line.trim())
        return line.replace(/URI="([^"]+)"/g, (_all, url) => `URI="${child(url)}"`)
      }).join("\n")
      return new Response(manifest, { headers: { "Content-Type": "application/vnd.apple.mpegurl", "Cache-Control": "private, no-store" } })
    }
    const headers = new Headers({ "Content-Type": type, "Cache-Control": token.kind==="image"?"private, max-age=3600":"private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" })
    headers.set("X-TVRoom-Media-Kind",token.kind)
    if(token.branded)headers.set("X-TVRoom-Watermark","permanent")
    for (const name of ["Content-Range", "Accept-Ranges"]) {
      const value = response.headers.get(name)
      if (value) headers.set(name, value)
    }
    if (p.get("download") === "1") {
      const extension = token.kind==="audio" ? (["M4A","AAC","WEBM","OGG"].includes(token.format||"")?token.format!.toLowerCase():"mp3") : /\.webm(?:[?#]|$)/i.test(token.url) ? "webm" : "mp4"
      const title = (token.title || "TV Room media").replace(/[^\w. -]/g, "_").slice(0, 110)
      headers.set("Content-Disposition", `attachment; filename="${title}.${extension}"`)
    }
    return new Response(response.body, { status: response.status, headers })
  } catch (e) {
    return NextResponse.json({ error: e instanceof ProviderError ? e.message : "The media file could not be loaded. Try another source." }, { status: e instanceof ProviderError ? e.status : 502 })
  }
}
export async function HEAD(request:Request) {
  const headers=new Headers(request.headers)
  headers.set("range","bytes=0-0")
  const response=await GET(new Request(request.url,{headers}))
  await response.body?.cancel()
  return new Response(null,{status:response.status,headers:response.headers})
}

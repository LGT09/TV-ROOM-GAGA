import { NextResponse } from "next/server"
import { mediaFetch } from "@/lib/providers/media-url"
import { ProviderError } from "@/lib/providers/http"
import { unseal } from "@/lib/library/tokens"

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams
    const url = params.get("key") ? unseal<{url:string}>(params.get("key")!, "caption").url : params.get("url") || ""
    const response = await mediaFetch(url)
    const reader = response.body?.getReader()
    if (!reader) throw new Error("Subtitle body missing.")
    let bytes = 0
    const chunks: Uint8Array[] = []
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      bytes += value.length
      if (bytes > 2_000_000) { await reader.cancel(); throw new Error("Subtitle exceeds the size limit.") }
      chunks.push(value)
    }
    let text = Buffer.concat(chunks).toString("utf8").replace(/^\uFEFF/, "")
    if (!text.trimStart().startsWith("WEBVTT")) {
      if (!/\d{2}:\d{2}:\d{2}[,.]\d{3}\s*-->/.test(text)) throw new Error("Unsupported subtitle format.")
      text = `WEBVTT\n\n${text.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2")}`
    }
    return new Response(text, { headers: { "Content-Type": "text/vtt; charset=utf-8", "Cache-Control": "private, max-age=30", "X-Content-Type-Options": "nosniff" } })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Subtitles unavailable." }, { status: e instanceof ProviderError ? e.status : 502 })
  }
}

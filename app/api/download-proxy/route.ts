import { NextResponse } from "next/server"
import { mediaFetch } from "@/lib/providers/media-url"
import { ProviderError } from "@/lib/providers/http"

export async function GET(request: Request) {
  try {
    const p = new URL(request.url).searchParams
    const response = await mediaFetch(p.get("url") || "")
    const type = response.headers.get("content-type") || "application/octet-stream"
    if (/text\/html/i.test(type)) throw new ProviderError("The source is a web page, not a downloadable file.")
    const filename = (p.get("filename") || "download").replace(/[^\w. -]/g, "_").slice(0, 150)
    return new Response(response.body, { headers: { "Content-Type": type, "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Download unavailable." }, { status: e instanceof ProviderError ? e.status : 502 })
  }
}

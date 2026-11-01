import { NextResponse } from "next/server"
import { seal } from "@/lib/library/tokens"

export const dynamic = "force-dynamic"
export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin")
    const host = request.headers.get("host") || new URL(request.url).host
    if (!origin || new URL(origin).host !== host) return NextResponse.json({ error: "Share link request must come from this site." }, { status: 403 })
    const body = await request.json()
    if (JSON.stringify(body).length > 4000) return NextResponse.json({ error: "Request is too large." }, { status: 413 })
    const source = new URL(String(body.url || ""))
    const hostname = source.hostname.toLowerCase()
    if (source.protocol !== "https:" || source.username || source.password || source.port || !/(^|\.)tiktok\.com$/.test(hostname)) {
      return NextResponse.json({ error: "Enter a public HTTPS TikTok link." }, { status: 400 })
    }
    const taskid = seal("tiktok-share", { url: source.href }, 7 * 24 * 60 * 60)
    return NextResponse.json({ success: true, taskid, url: `/media/tiktok/${taskid}` }, { headers: { "Cache-Control": "private, no-store" } })
  } catch {
    return NextResponse.json({ error: "Could not prepare this TikTok share link." }, { status: 400 })
  }
}

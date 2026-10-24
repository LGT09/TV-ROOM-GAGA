import { NextResponse } from "next/server"
import { GET as resolveMedia } from "../social-download/route"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (!/^[a-zA-Z0-9_-]{11}$/.test(body.videoId || "")) return NextResponse.json({ success: false, error: "Valid YouTube video ID required." }, { status: 400 })
    const url = new URL(request.url)
    url.search = new URLSearchParams({ platform: body.format === "mp3" ? "youtube-audio" : "youtube-video", url: `https://www.youtube.com/watch?v=${body.videoId}`, quality: body.format === "mp3" ? "720p" : body.quality || "720p" }).toString()
    return resolveMedia(new Request(url))
  } catch { return NextResponse.json({ success: false, error: "Invalid download request." }, { status: 400 }) }
}

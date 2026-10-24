import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const videoId = searchParams.get("videoId")
    const quality = searchParams.get("quality") || "720p"

    if (!videoId) {
      return NextResponse.json({ error: "Video ID is required" }, { status: 400 })
    }

    console.log("[v0] YouTube stream request:", { videoId, quality })

    // In production, this would use ytdl-core to get the actual stream URL
    // For now, we'll return the YouTube embed URL
    const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&quality=${quality}`

    return NextResponse.json({
      success: true,
      videoId,
      streamUrl: embedUrl,
      embedUrl,
      quality,
    })
  } catch (error) {
    console.error("[v0] YouTube stream error:", error)
    return NextResponse.json({ error: "Failed to get stream URL" }, { status: 500 })
  }
}

import { NextResponse } from "next/server"

// Nayan Video Downloader API endpoints (primary)
const NAYAN_API = {
  search: "https://nayan-video-downloader.vercel.app/ytsearch",
  download: "https://nayan-video-downloader.vercel.app/ytdown",
  youtube: "https://nayan-video-downloader.vercel.app/youtube",
  alldown: "https://nayan-video-downloader.vercel.app/alldown",
}

// Trending search queries for YouTube
const TRENDING_QUERIES = [
  "trending music videos 2026",
  "new music videos",
  "top music videos this week",
  "viral videos 2026",
  "hot music releases",
  "billboard top songs",
  "new songs today",
  "popular music",
]

// Safe fetch helper
async function safeFetch(url: string, timeout = 20000): Promise<any> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)
  
  try {
    const response = await fetch(url, {
      headers: { 
        "Accept": "application/json",
        "User-Agent": "TVRoomGaga/2.0"
      },
      signal: controller.signal,
    }).catch(() => null)
    
    clearTimeout(timeoutId)
    
    if (!response) return { success: false, error: "Network error" }
    
    const text = await response.text().catch(() => "")
    if (!text || text.startsWith("<")) return { success: false, error: "Invalid response" }
    
    try {
      return JSON.parse(text)
    } catch {
      return { success: false, error: "JSON parse error" }
    }
  } catch {
    clearTimeout(timeoutId)
    return { success: false, error: "Fetch error" }
  }
}

// Transform video results to unified format
function transformVideos(data: any): any[] {
  const videos = data.result || data.results || data.data || data.videos || data.items || []
  if (!Array.isArray(videos)) return []
  
  return videos.map((v: any) => ({
    id: v.videoId || v.id || v.video_id,
    title: typeof v.title === "string" ? v.title : (v.title?.text || v.name || "Untitled"),
    thumbnail: v.thumbnail || v.thumbnails?.[0]?.url || v.thumbnailUrl || v.thumb,
    duration: v.duration || v.length || v.lengthSeconds || "N/A",
    author: typeof v.channel === "string" ? v.channel : (v.channel?.name || v.author || v.uploader || "Unknown"),
    views: formatViews(v.views || v.viewCount || v.view_count),
    url: v.url || v.link || `https://youtube.com/watch?v=${v.videoId || v.id}`,
    publishedAt: v.uploadDate || v.publishedAt || v.uploaded || v.publish_date,
  }))
}

// Format view count
function formatViews(views: any): string {
  if (!views) return "N/A"
  const viewStr = String(views)
  const num = parseInt(viewStr.replace(/[^0-9]/g, ""))
  if (isNaN(num)) return viewStr
  if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B views`
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M views`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K views`
  return `${num} views`
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get("action")
  const query = searchParams.get("query")
  const url = searchParams.get("url")
  const videoId = searchParams.get("videoId")
  const format = searchParams.get("format") || "mp4"

  // SEARCH - Search YouTube videos
  if (action === "search" && query) {
    // Try with query= param first, then q= param
    let data = await safeFetch(`${NAYAN_API.search}?query=${encodeURIComponent(query)}`)
    let items = transformVideos(data)
    
    if (items.length === 0) {
      data = await safeFetch(`${NAYAN_API.search}?q=${encodeURIComponent(query)}`)
      items = transformVideos(data)
    }
    
    return NextResponse.json({
      success: items.length > 0,
      items,
      query,
    })
  }

  // TRENDING - Get trending videos
  if (action === "trending") {
    const randomQuery = TRENDING_QUERIES[Math.floor(Math.random() * TRENDING_QUERIES.length)]
    let data = await safeFetch(`${NAYAN_API.search}?query=${encodeURIComponent(randomQuery)}`)
    let items = transformVideos(data)
    
    if (items.length === 0) {
      data = await safeFetch(`${NAYAN_API.search}?q=${encodeURIComponent(randomQuery)}`)
      items = transformVideos(data)
    }
    
    return NextResponse.json({
      success: items.length > 0,
      items: items.slice(0, 20),
      query: randomQuery,
    })
  }

  // DOWNLOAD - Get download link for a YouTube video
  if (action === "download" && (url || videoId)) {
    const videoUrl = url || `https://youtube.com/watch?v=${videoId}`
    
    // Use ytdown endpoint for download
    const downloadData = await safeFetch(`${NAYAN_API.download}?url=${encodeURIComponent(videoUrl)}`)
    
    // Extract download info
    const result = downloadData.result || downloadData.data || downloadData
    
    // Get the actual download URL based on format
    let downloadUrl: string | null = null
    let fileSize: string | null = null
    let quality: string | null = null
    
    if (format === "mp3" || format === "audio") {
      // Get audio/mp3 download
      downloadUrl = result.audio?.url || result.mp3?.url || result.audio_url || result.mp3_url ||
                    result.medias?.find((m: any) => m.extension === "mp3")?.url
      fileSize = result.audio?.size || result.mp3?.size || result.audio_size
      quality = "320kbps"
    } else {
      // Get video/mp4 download - prefer 720p or highest available
      const medias = result.medias || result.formats || []
      const video720 = medias.find((m: any) => m.quality?.includes("720") || m.resolution?.includes("720"))
      const videoAny = medias.find((m: any) => m.extension === "mp4" || m.type?.includes("video"))
      
      downloadUrl = video720?.url || videoAny?.url || result.video?.url || result.mp4?.url || 
                    result.video_url || result.download_url || result.url
      fileSize = video720?.size || videoAny?.size || result.video?.size || result.size
      quality = video720?.quality || videoAny?.quality || result.quality || "720p"
    }
    
    if (downloadUrl) {
      return NextResponse.json({
        success: true,
        downloadUrl,
        title: result.title || result.name || "YouTube Video",
        thumbnail: result.thumbnail || result.thumb,
        format,
        quality,
        size: fileSize,
        duration: result.duration,
      })
    }
    
    // Fallback to alldown endpoint
    const alldownData = await safeFetch(`${NAYAN_API.alldown}?url=${encodeURIComponent(videoUrl)}`)
    const allResult = alldownData.result || alldownData.data || alldownData
    
    downloadUrl = allResult.download_url || allResult.url || allResult.link ||
                  allResult.medias?.[0]?.url || allResult.video?.url
    
    if (downloadUrl) {
      return NextResponse.json({
        success: true,
        downloadUrl,
        title: allResult.title || "YouTube Video",
        format,
        quality: allResult.quality || "HD",
        size: allResult.size || allResult.filesize,
      })
    }
    
    return NextResponse.json({
      success: false,
      error: "Could not get download link. Please try again."
    })
  }

  // VIDEO-DETAILS - Get video info
  if (action === "video-details" && (videoId || url)) {
    const videoUrl = url || `https://youtube.com/watch?v=${videoId}`
    const data = await safeFetch(`${NAYAN_API.youtube}?url=${encodeURIComponent(videoUrl)}`)
    const result = data.result || data.data || data
    
    if (result.title) {
      return NextResponse.json({
        success: true,
        id: result.videoId || videoId,
        title: result.title,
        thumbnail: result.thumbnail || result.thumb,
        duration: result.duration,
        author: result.channel || result.author,
        views: result.views,
        description: result.description,
      })
    }
    
    return NextResponse.json({
      success: false,
      error: "Video not found"
    })
  }

  return NextResponse.json({
    error: "Invalid action. Use: search, download, trending, video-details",
    usage: {
      search: "?action=search&query=music",
      download: "?action=download&url=<youtube_url>&format=mp3|mp4",
      trending: "?action=trending",
      videoDetails: "?action=video-details&videoId=<id>",
    }
  }, { status: 400 })
}

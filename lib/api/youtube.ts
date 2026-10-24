// YouTube download functionality using ytdl-core approach
// Note: In production, you'd use a backend service for this

export interface YouTubeVideo {
  id: string
  title: string
  thumbnail: string
  duration: string
  author: string
  views: string
}

export interface DownloadFormat {
  quality: string
  format: string
  size: string
  url: string
}

// Extract video ID from YouTube URL
export function extractVideoId(url: string): string | null {
  const patterns = [/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/, /^([a-zA-Z0-9_-]{11})$/]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }

  return null
}

// Get video info using YouTube oEmbed API (no API key required)
export async function getVideoInfo(videoId: string): Promise<YouTubeVideo | null> {
  try {
    const response = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
    )

    if (!response.ok) {
      throw new Error("Video not found")
    }

    const data = await response.json()

    return {
      id: videoId,
      title: data.title,
      thumbnail: data.thumbnail_url,
      duration: "N/A", // oEmbed doesn't provide duration
      author: data.author_name,
      views: "N/A",
    }
  } catch (error) {
    console.error("[v0] Error fetching video info:", error)
    return null
  }
}

// Get available download formats
export async function getDownloadFormats(videoId: string): Promise<DownloadFormat[]> {
  // In a real implementation, this would call a backend API
  // that uses ytdl-core or similar library
  return [
    {
      quality: "1080p",
      format: "MP4",
      size: "~150MB",
      url: `https://www.youtube.com/watch?v=${videoId}`,
    },
    {
      quality: "720p",
      format: "MP4",
      size: "~80MB",
      url: `https://www.youtube.com/watch?v=${videoId}`,
    },
    {
      quality: "480p",
      format: "MP4",
      size: "~40MB",
      url: `https://www.youtube.com/watch?v=${videoId}`,
    },
    {
      quality: "Audio Only",
      format: "MP3",
      size: "~5MB",
      url: `https://www.youtube.com/watch?v=${videoId}`,
    },
  ]
}

// Download video (in production, this would trigger a backend download)
export async function downloadVideo(videoId: string, format: DownloadFormat): Promise<boolean> {
  try {
    console.log("[v0] Downloading video:", videoId, "Format:", format.quality)

    // In production, you would:
    // 1. Send request to your backend API
    // 2. Backend uses ytdl-core or similar to download
    // 3. Return download URL or stream to client

    // For now, we'll simulate the download
    await new Promise((resolve) => setTimeout(resolve, 2000))

    return true
  } catch (error) {
    console.error("[v0] Error downloading video:", error)
    return false
  }
}

export async function isYouTubeShort(videoId: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/youtube?action=video-details&videoId=${videoId}`)
    const data = await response.json()

    if (data.duration) {
      // Parse ISO 8601 duration (PT1M30S format)
      const match = data.duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
      if (match) {
        const hours = Number.parseInt(match[1] || "0")
        const minutes = Number.parseInt(match[2] || "0")
        const seconds = Number.parseInt(match[3] || "0")
        const totalSeconds = hours * 3600 + minutes * 60 + seconds

        // YouTube Shorts are 60 seconds or less
        return totalSeconds <= 60
      }
    }

    return false
  } catch (error) {
    console.error("[v0] Error checking if video is Short:", error)
    return false
  }
}

export async function searchYouTube(query: string, maxResults = 20): Promise<YouTubeVideo[]> {
  try {
    const response = await fetch(
      `/api/youtube?action=search&query=${encodeURIComponent(query)}&maxResults=${maxResults}`,
    )

    const data = await response.json()

    if (!data.items) return []

    // Filter out Shorts by checking duration
    const filteredVideos: YouTubeVideo[] = []

    for (const video of data.items) {
      const isShort = await isYouTubeShort(video.id)
      if (!isShort) {
        filteredVideos.push(video)
      }
    }

    return filteredVideos
  } catch (error) {
    console.error("[v0] Error searching YouTube:", error)
    return []
  }
}

export async function getTrendingYouTubeVideos(): Promise<YouTubeVideo[]> {
  try {
    const response = await fetch("/api/youtube?action=trending")
    const data = await response.json()

    if (!data.items) return []

    // Filter out Shorts
    const filteredVideos: YouTubeVideo[] = []

    for (const video of data.items) {
      const isShort = await isYouTubeShort(video.id)
      if (!isShort) {
        filteredVideos.push(video)
      }
    }

    return filteredVideos.slice(0, 10)
  } catch (error) {
    console.error("[v0] Error fetching trending videos:", error)
    return []
  }
}

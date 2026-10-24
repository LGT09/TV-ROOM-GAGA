export interface ContentItem {
  id: string | number
  title: string
  artist?: string
  year?: string
  duration?: string
  type: "music" | "movie" | "series" | "anime" | "channel"
  imageUrl: string
  description?: string
  rating?: number
  genres?: string[]
  cast?: Array<{ id?: string | number; name: string; character?: string; profile_path?: string | null }>
  previewUrl?: string // For music preview (iTunes 30-second preview)
  audioUrl?: string // For full music playback
  videoUrl?: string // For video content (YouTube trailer, etc.)
  trailerKey?: string // YouTube trailer key
  streamUrl?: string // For live channel streaming
  downloadUrl?: string // Direct download URL
  // Additional fields for different content types
  releaseDate?: string
  episodes?: number | string
  seasons?: number
}

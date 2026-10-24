// Music API interfaces and helper functions

export interface Track {
  trackId: number
  trackName: string
  artistName: string
  collectionName: string
  artworkUrl100: string
  artworkUrl60: string
  previewUrl: string
  trackTimeMillis: number
  releaseDate: string
  primaryGenreName: string
  country: string
}

export interface Album {
  collectionId: number
  collectionName: string
  artistName: string
  artworkUrl100: string
  releaseDate: string
  trackCount: number
  primaryGenreName: string
}

// Safe JSON parse helper
async function safeJsonParse(response: Response): Promise<any> {
  try {
    const text = await response.text()
    if (!text || text.startsWith("<") || text.startsWith("Internal")) {
      return { results: [] }
    }
    return JSON.parse(text)
  } catch {
    return { results: [] }
  }
}

export async function searchMusic(query: string, limit = 20): Promise<Track[]> {
  try {
    const response = await fetch(`/api/music?action=search&query=${encodeURIComponent(query)}&limit=${limit}`)
    if (!response.ok) return []
    const data = await safeJsonParse(response)
    return data.results || []
  } catch (error) {
    console.error("[v0] Error searching music:", error)
    return []
  }
}

export async function getTrendingMusic(): Promise<Track[]> {
  try {
    const response = await fetch("/api/music?action=trending&limit=20")
    if (!response.ok) return []
    const data = await safeJsonParse(response)
    return data.results || []
  } catch (error) {
    console.error("[v0] Error fetching trending music:", error)
    return []
  }
}

export async function searchAlbums(query: string, limit = 20): Promise<Album[]> {
  try {
    const response = await fetch(`/api/music?action=albums&query=${encodeURIComponent(query)}&limit=${limit}`)
    if (!response.ok) return []
    const data = await safeJsonParse(response)
    return data.results || []
  } catch (error) {
    console.error("[v0] Error searching albums:", error)
    return []
  }
}

export async function getArtistTopTracks(artistName: string): Promise<Track[]> {
  return searchMusic(artistName, 10)
}

export function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

export function getHighResArtwork(url: string): string {
  // Convert 100x100 artwork to 600x600
  return url.replace("100x100", "600x600")
}

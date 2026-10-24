// K-Drama API using TMDb
const TMDB_BASE_URL = "https://api.themoviedb.org/3"
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500"

export interface KDrama {
  id: number
  name: string
  overview: string
  poster_path: string
  backdrop_path: string
  first_air_date: string
  vote_average: number
  number_of_seasons?: number
  number_of_episodes?: number
  episode_run_time?: number[]
  genres?: { id: number; name: string }[]
  origin_country: string[]
}

export async function getTrendingKDramas(): Promise<KDrama[]> {
  try {
    const response = await fetch("/api/tmdb?action=trending-kdrama")
    const data = await response.json()
    return data.results || []
  } catch (error) {
    console.error("[v0] Error fetching K-dramas:", error)
    return []
  }
}

export async function getPopularKDramas(): Promise<KDrama[]> {
  try {
    const response = await fetch("/api/tmdb?action=popular-kdrama")
    const data = await response.json()
    return data.results || []
  } catch (error) {
    console.error("[v0] Error fetching popular K-dramas:", error)
    return []
  }
}

export async function getKDramaDetails(id: number): Promise<KDrama | null> {
  try {
    const response = await fetch(`/api/tmdb?action=kdrama-details&id=${id}`)
    const data = await response.json()
    return data
  } catch (error) {
    console.error("[v0] Error fetching K-drama details:", error)
    return null
  }
}

export function getKDramaImageUrl(path: string | null): string {
  if (!path) return "/placeholder.svg?height=400&width=300"
  return `${TMDB_IMAGE_BASE}${path}`
}

export function formatKDramaEpisodes(kdrama: KDrama): string {
  if (kdrama.number_of_seasons && kdrama.number_of_episodes) {
    return `${kdrama.number_of_seasons} Season${kdrama.number_of_seasons > 1 ? 's' : ''} • ${kdrama.number_of_episodes} Episodes`
  }
  return "Ongoing"
}

export function formatKDramaRuntime(runtime?: number[]): string {
  if (!runtime || runtime.length === 0) return "N/A"
  return `${runtime[0]} min/episode`
}

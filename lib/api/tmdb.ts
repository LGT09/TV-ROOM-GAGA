// TMDb API for movies and TV series
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500"
const TMDB_BACKDROP_BASE = "https://image.tmdb.org/t/p/original"

export interface Movie {
  id: number
  title: string
  overview: string
  poster_path: string
  backdrop_path: string
  release_date: string
  vote_average: number
  runtime?: number
  genres?: { id: number; name: string }[]
  cast?: Cast[]
  videos?: { results: Video[] }
}

export interface TVSeries {
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
  cast?: Cast[]
  seasons?: Season[]
  videos?: { results: Video[] }
}

export interface Season {
  id: number
  name: string
  overview: string
  poster_path: string | null
  season_number: number
  episode_count: number
  air_date: string
}

export interface Episode {
  id: number
  name: string
  overview: string
  still_path: string | null
  episode_number: number
  season_number: number
  air_date: string
  runtime: number
  vote_average: number
}

export interface Cast {
  id: number
  name: string
  character: string
  profile_path: string | null
  order: number
}

export interface Video {
  id: string
  key: string
  name: string
  site: string
  type: string
}

export async function getTrendingMovies(): Promise<Movie[]> {
  try {
    const response = await fetch("/api/tmdb?action=trending-movies")
    const data = await response.json()
    return data.results || []
  } catch (error) {
    console.error("[v0] Error fetching trending movies:", error)
    return []
  }
}

export async function getPopularMovies(): Promise<Movie[]> {
  try {
    const response = await fetch("/api/tmdb?action=popular-movies")
    const data = await response.json()
    return data.results || []
  } catch (error) {
    console.error("[v0] Error fetching popular movies:", error)
    return []
  }
}

export async function getMovieDetails(movieId: number): Promise<Movie | null> {
  try {
    const response = await fetch(`/api/tmdb?action=movie-details&id=${movieId}`)
    const movie = await response.json()

    if (movie.error) {
      console.error("[v0] Movie details error:", movie.error)
      return null
    }

    return {
      ...movie,
      cast: movie.credits?.cast?.slice(0, 10) || [],
    }
  } catch (error) {
    console.error("[v0] Error fetching movie details:", error)
    return null
  }
}

export async function getMovieTrailer(movieId: number): Promise<string | null> {
  try {
    const response = await fetch(`/api/tmdb?action=movie-videos&id=${movieId}`)
    const data = await response.json()

    const trailer = data.results?.find((video: any) => video.type === "Trailer" && video.site === "YouTube")
    return trailer?.key || null
  } catch (error) {
    console.error("[v0] Error fetching movie trailer:", error)
    return null
  }
}

export async function getMovieGenres(): Promise<{ id: number; name: string }[]> {
  try {
    const response = await fetch("/api/tmdb?action=movie-genres")
    const data = await response.json()
    return data.genres || []
  } catch (error) {
    console.error("[v0] Error fetching movie genres:", error)
    return []
  }
}

export async function getMoviesByGenre(genreId: number): Promise<Movie[]> {
  try {
    const response = await fetch(`/api/tmdb?action=movies-by-genre&genreId=${genreId}`)
    const data = await response.json()
    return data.results || []
  } catch (error) {
    console.error("[v0] Error fetching movies by genre:", error)
    return []
  }
}

export async function getTrendingTVSeries(): Promise<TVSeries[]> {
  try {
    const response = await fetch("/api/tmdb?action=trending-tv")
    const data = await response.json()
    return data.results || []
  } catch (error) {
    console.error("[v0] Error fetching trending TV series:", error)
    return []
  }
}

export async function getPopularTVSeries(): Promise<TVSeries[]> {
  try {
    const response = await fetch("/api/tmdb?action=popular-tv")
    const data = await response.json()
    return data.results || []
  } catch (error) {
    console.error("[v0] Error fetching popular TV series:", error)
    return []
  }
}

export async function getTVSeriesDetails(seriesId: number): Promise<TVSeries | null> {
  try {
    const response = await fetch(`/api/tmdb?action=tv-details&id=${seriesId}`)
    const series = await response.json()

    if (series.error) {
      console.error("[v0] TV series details error:", series.error)
      return null
    }

    console.log("[v0] TV Series Full Details:", {
      name: series.name,
      seasons: series.number_of_seasons,
      episodes: series.number_of_episodes,
      seasonsList: series.seasons?.length,
      episodeRuntime: series.episode_run_time,
    })

    return {
      ...series,
      cast: series.credits?.cast?.slice(0, 10) || [],
      seasons: series.seasons || [],
    }
  } catch (error) {
    console.error("[v0] Error fetching TV series details:", error)
    return null
  }
}

export async function getSeasonDetails(
  seriesId: number,
  seasonNumber: number,
): Promise<{ episodes: Episode[] } | null> {
  try {
    const response = await fetch(`/api/tmdb?action=tv-season-details&id=${seriesId}&season=${seasonNumber}`)
    const data = await response.json()

    if (data.error) {
      console.error("[v0] Season details error:", data.error)
      return null
    }

    return data
  } catch (error) {
    console.error("[v0] Error fetching season details:", error)
    return null
  }
}

// Alias for compatibility
export const getTVSeasonDetails = getSeasonDetails

export async function getTVSeriesTrailer(seriesId: number): Promise<string | null> {
  try {
    const response = await fetch(`/api/tmdb?action=tv-videos&id=${seriesId}`)
    const data = await response.json()

    const trailer = data.results?.find((video: any) => video.type === "Trailer" && video.site === "YouTube")
    return trailer?.key || null
  } catch (error) {
    console.error("[v0] Error fetching TV series trailer:", error)
    return null
  }
}

export async function searchMoviesAndTV(query: string): Promise<{ movies: Movie[]; tv: TVSeries[] }> {
  try {
    const [moviesResponse, tvResponse] = await Promise.all([
      fetch(`/api/tmdb?action=search-movies&query=${encodeURIComponent(query)}`),
      fetch(`/api/tmdb?action=search-tv&query=${encodeURIComponent(query)}`),
    ])

    const moviesData = await moviesResponse.json()
    const tvData = await tvResponse.json()

    return {
      movies: moviesData.results || [],
      tv: tvData.results || [],
    }
  } catch (error) {
    console.error("[v0] Error searching movies and TV:", error)
    return { movies: [], tv: [] }
  }
}

export function getImageUrl(path: string | null): string {
  if (!path) return "/abstract-movie-poster.png"
  return `${TMDB_IMAGE_BASE}${path}`
}

export function getBackdropUrl(path: string | null): string {
  if (!path) return "/movie-backdrop.png"
  return `${TMDB_BACKDROP_BASE}${path}`
}

export function formatRuntime(minutes?: number): string {
  if (!minutes) return "N/A"
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
}

export function calculateFileSize(runtimeMinutes: number, quality: string): string {
  const bitrates: Record<string, number> = {
    "4K": 25, // 25 Mbps
    "2160p": 25,
    "1080p": 8, // 8 Mbps
    "720p": 5, // 5 Mbps
    "480p": 2.5, // 2.5 Mbps
    "360p": 1, // 1 Mbps
  }

  const bitrate = bitrates[quality] || 5
  const runtimeSeconds = runtimeMinutes * 60
  const fileSizeMB = (bitrate * runtimeSeconds) / 8
  const fileSizeGB = fileSizeMB / 1024

  if (fileSizeGB >= 1) {
    return `${fileSizeGB.toFixed(2)} GB`
  }
  return `${Math.round(fileSizeMB)} MB`
}

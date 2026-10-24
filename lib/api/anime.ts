// AniList API for anime data
const ANILIST_API_URL = "https://graphql.anilist.co"

export interface Anime {
  id: number
  title: {
    romaji: string
    english: string | null
    native: string
  }
  coverImage: {
    large: string
    medium: string
  }
  bannerImage: string | null
  description: string
  episodes: number | null
  duration: number | null
  status: string
  season: string | null
  seasonYear: number | null
  averageScore: number | null
  genres: string[]
  studios: {
    nodes: Array<{ name: string }>
  }
}

const TRENDING_ANIME_QUERY = `
query {
  Page(page: 1, perPage: 20) {
    media(type: ANIME, sort: TRENDING_DESC) {
      id
      title {
        romaji
        english
        native
      }
      coverImage {
        large
        medium
      }
      bannerImage
      description
      episodes
      duration
      status
      season
      seasonYear
      averageScore
      genres
      studios {
        nodes {
          name
        }
      }
    }
  }
}
`

const POPULAR_ANIME_QUERY = `
query {
  Page(page: 1, perPage: 20) {
    media(type: ANIME, sort: POPULARITY_DESC) {
      id
      title {
        romaji
        english
        native
      }
      coverImage {
        large
        medium
      }
      bannerImage
      description
      episodes
      duration
      status
      season
      seasonYear
      averageScore
      genres
      studios {
        nodes {
          name
        }
      }
    }
  }
}
`

const SEARCH_ANIME_QUERY = `
query ($search: String) {
  Page(page: 1, perPage: 20) {
    media(type: ANIME, search: $search) {
      id
      title {
        romaji
        english
        native
      }
      coverImage {
        large
        medium
      }
      bannerImage
      description
      episodes
      duration
      status
      season
      seasonYear
      averageScore
      genres
      studios {
        nodes {
          name
        }
      }
    }
  }
}
`

async function fetchAniList(action: string, query?: string) {
  try {
    let url = `/api/anime?action=${action}`
    if (query) {
      url += `&query=${encodeURIComponent(query)}`
    }

    const response = await fetch(url)
    const data = await response.json()
    return data.data?.Page?.media || []
  } catch (error) {
    console.error("[v0] Error fetching from AniList:", error)
    return []
  }
}

export async function getTrendingAnime(): Promise<Anime[]> {
  return fetchAniList("trending")
}

export async function getPopularAnime(): Promise<Anime[]> {
  return fetchAniList("popular")
}

export async function searchAnime(query: string): Promise<Anime[]> {
  return fetchAniList("search", query)
}

export function getAnimeTitle(anime: Anime): string {
  return anime.title.english || anime.title.romaji || anime.title.native
}

export function formatAnimeEpisodes(episodes: number | null): string {
  if (!episodes) return "Ongoing"
  return `${episodes} Episodes`
}

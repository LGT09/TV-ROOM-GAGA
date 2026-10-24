import { NextResponse } from "next/server"

const ANILIST_API_URL = "https://graphql.anilist.co"

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get("action")
  const query = searchParams.get("query")

  try {
    let graphqlQuery: string
    let variables: Record<string, unknown> = {}

    switch (action) {
      case "trending":
        graphqlQuery = TRENDING_ANIME_QUERY
        break
      case "popular":
        graphqlQuery = POPULAR_ANIME_QUERY
        break
      case "search":
        if (!query) return NextResponse.json({ error: "Query required" }, { status: 400 })
        graphqlQuery = SEARCH_ANIME_QUERY
        variables = { search: query }
        break
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    const response = await fetch(ANILIST_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        query: graphqlQuery,
        variables,
      }),
    })

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("[v0] Anime API error:", error)
    return NextResponse.json({ error: "Failed to fetch anime data" }, { status: 500 })
  }
}

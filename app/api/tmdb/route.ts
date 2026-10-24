import { NextResponse } from "next/server"

const TMDB_API_KEY = process.env.TMDB_API_KEY
const TMDB_BASE_URL = "https://api.themoviedb.org/3"

// Fallback data when TMDB API is unavailable
const FALLBACK_MOVIES = {
  results: [
    { id: 1, title: "The Avengers", overview: "Earth's mightiest heroes unite", poster_path: null, backdrop_path: null, release_date: "2012-05-04", vote_average: 8.0, genre_ids: [28, 12, 878] },
    { id: 2, title: "Inception", overview: "A thief who steals secrets through dreams", poster_path: null, backdrop_path: null, release_date: "2010-07-16", vote_average: 8.8, genre_ids: [28, 878, 53] },
    { id: 3, title: "The Dark Knight", overview: "Batman faces the Joker", poster_path: null, backdrop_path: null, release_date: "2008-07-18", vote_average: 9.0, genre_ids: [28, 80, 18] },
    { id: 4, title: "Interstellar", overview: "A team travels through a wormhole", poster_path: null, backdrop_path: null, release_date: "2014-11-07", vote_average: 8.6, genre_ids: [12, 18, 878] },
    { id: 5, title: "Parasite", overview: "A poor family schemes to infiltrate a wealthy household", poster_path: null, backdrop_path: null, release_date: "2019-05-30", vote_average: 8.5, genre_ids: [35, 53, 18] },
    { id: 6, title: "Spider-Man: No Way Home", overview: "Spider-Man seeks help from Doctor Strange", poster_path: null, backdrop_path: null, release_date: "2021-12-17", vote_average: 8.2, genre_ids: [28, 12, 878] },
  ]
}

const FALLBACK_TV = {
  results: [
    { id: 101, name: "Breaking Bad", overview: "A chemistry teacher turns to crime", poster_path: null, backdrop_path: null, first_air_date: "2008-01-20", vote_average: 9.5, origin_country: ["US"] },
    { id: 102, name: "Squid Game", overview: "Desperate contestants play deadly games", poster_path: null, backdrop_path: null, first_air_date: "2021-09-17", vote_average: 7.8, origin_country: ["KR"] },
    { id: 103, name: "Crash Landing on You", overview: "A South Korean heiress lands in North Korea", poster_path: null, backdrop_path: null, first_air_date: "2019-12-14", vote_average: 8.7, origin_country: ["KR"] },
    { id: 104, name: "Goblin", overview: "An immortal goblin seeks his bride", poster_path: null, backdrop_path: null, first_air_date: "2016-12-02", vote_average: 8.6, origin_country: ["KR"] },
    { id: 105, name: "Itaewon Class", overview: "An ex-con opens a bar to get revenge", poster_path: null, backdrop_path: null, first_air_date: "2020-01-31", vote_average: 8.2, origin_country: ["KR"] },
    { id: 106, name: "All of Us Are Dead", overview: "Students fight to survive a zombie outbreak", poster_path: null, backdrop_path: null, first_air_date: "2022-01-28", vote_average: 8.0, origin_country: ["KR"] },
  ]
}

const FALLBACK_KDRAMA = {
  results: FALLBACK_TV.results.filter(tv => tv.origin_country.includes("KR"))
}

const FALLBACK_ANIME = {
  results: [
    { id: 201, title: "Spirited Away", name: "Spirited Away", overview: "A girl enters a world of spirits", poster_path: null, backdrop_path: null, release_date: "2001-07-20", first_air_date: "2001-07-20", vote_average: 8.5, origin_country: ["JP"] },
    { id: 202, title: "Your Name", name: "Your Name", overview: "Two teenagers share a connection across time", poster_path: null, backdrop_path: null, release_date: "2016-08-26", first_air_date: "2016-08-26", vote_average: 8.4, origin_country: ["JP"] },
    { id: 203, title: "Attack on Titan", name: "Attack on Titan", overview: "Humanity fights giant humanoids", poster_path: null, backdrop_path: null, release_date: "2013-04-07", first_air_date: "2013-04-07", vote_average: 9.0, origin_country: ["JP"] },
    { id: 204, title: "Demon Slayer", name: "Demon Slayer", overview: "A boy becomes a demon slayer", poster_path: null, backdrop_path: null, release_date: "2019-04-06", first_air_date: "2019-04-06", vote_average: 8.6, origin_country: ["JP"] },
  ]
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get("action")
  const id = searchParams.get("id")
  const query = searchParams.get("query")
  const genreId = searchParams.get("genreId")

  // Return fallback data if no API key
  if (!TMDB_API_KEY || TMDB_API_KEY === "YOUR_TMDB_API_KEY") {
    return NextResponse.json({ results: [], error: "TMDb metadata requires a configured TMDB_API_KEY. Use the live provider catalogues in Discover instead.", discoveryUrl: "/discover" }, { status: 503 })
  }

  try {
    let url: string

    switch (action) {
      case "trending-movies":
        url = `${TMDB_BASE_URL}/trending/movie/week?api_key=${TMDB_API_KEY}`
        break
      case "popular-movies":
        url = `${TMDB_BASE_URL}/movie/popular?api_key=${TMDB_API_KEY}`
        break
      case "movie-details":
        if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 })
        url = `${TMDB_BASE_URL}/movie/${id}?api_key=${TMDB_API_KEY}&append_to_response=credits,videos`
        break
      case "movie-credits":
        if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 })
        url = `${TMDB_BASE_URL}/movie/${id}/credits?api_key=${TMDB_API_KEY}`
        break
      case "movie-videos":
        if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 })
        url = `${TMDB_BASE_URL}/movie/${id}/videos?api_key=${TMDB_API_KEY}`
        break
      case "trending-tv":
        url = `${TMDB_BASE_URL}/trending/tv/week?api_key=${TMDB_API_KEY}`
        break
      case "popular-tv":
        url = `${TMDB_BASE_URL}/tv/popular?api_key=${TMDB_API_KEY}`
        break
      case "tv-details":
        if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 })
        url = `${TMDB_BASE_URL}/tv/${id}?api_key=${TMDB_API_KEY}&append_to_response=credits,videos,seasons`
        break
      case "tv-credits":
        if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 })
        url = `${TMDB_BASE_URL}/tv/${id}/credits?api_key=${TMDB_API_KEY}`
        break
      case "tv-videos":
        if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 })
        url = `${TMDB_BASE_URL}/tv/${id}/videos?api_key=${TMDB_API_KEY}`
        break
      case "tv-season-details":
        const seasonNumber = searchParams.get("season")
        if (!id || !seasonNumber) return NextResponse.json({ error: "ID and season required" }, { status: 400 })
        url = `${TMDB_BASE_URL}/tv/${id}/season/${seasonNumber}?api_key=${TMDB_API_KEY}`
        break
      case "tv-episode-details":
        const epSeasonNum = searchParams.get("season")
        const episodeNum = searchParams.get("episode")
        if (!id || !epSeasonNum || !episodeNum)
          return NextResponse.json({ error: "ID, season, and episode required" }, { status: 400 })
        url = `${TMDB_BASE_URL}/tv/${id}/season/${epSeasonNum}/episode/${episodeNum}?api_key=${TMDB_API_KEY}`
        break
      case "search-movies":
        if (!query) return NextResponse.json({ error: "Query required" }, { status: 400 })
        url = `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`
        break
      case "search-tv":
        if (!query) return NextResponse.json({ error: "Query required" }, { status: 400 })
        url = `${TMDB_BASE_URL}/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`
        break
      case "movie-genres":
        url = `${TMDB_BASE_URL}/genre/movie/list?api_key=${TMDB_API_KEY}`
        break
      case "movies-by-genre":
        if (!genreId) return NextResponse.json({ error: "Genre ID required" }, { status: 400 })
        url = `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=${genreId}&sort_by=popularity.desc`
        break
      case "trending-kdrama":
        url = `${TMDB_BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_origin_country=KR&sort_by=popularity.desc`
        break
      case "popular-kdrama":
        url = `${TMDB_BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_origin_country=KR&sort_by=vote_average.desc&vote_count.gte=100`
        break
      case "kdrama-details":
        if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 })
        url = `${TMDB_BASE_URL}/tv/${id}?api_key=${TMDB_API_KEY}&append_to_response=credits,videos,seasons`
        break
      case "kids-movies":
        url = `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=16,10751&sort_by=popularity.desc&certification_country=US&certification.lte=G`
        break
      case "horror-movies":
        url = `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=27&sort_by=popularity.desc`
        break
      case "comedy-movies":
        url = `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=35&sort_by=popularity.desc`
        break
      case "action-movies":
        url = `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=28&sort_by=popularity.desc`
        break
      case "romance-movies":
        url = `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=10749&sort_by=popularity.desc`
        break
      case "anime-movies":
        url = `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=16&with_origin_country=JP&sort_by=popularity.desc`
        break
      case "anime-series":
        url = `${TMDB_BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_genres=16&with_origin_country=JP&sort_by=popularity.desc`
        break
      case "bet-movies":
        // BET-style movies: African American focused drama, comedy, thriller
        url = `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=18,35&with_original_language=en&sort_by=popularity.desc&with_keywords=180547|270646|9882`
        break
      case "bet-movies-fallback":
        // Broader search for urban/drama films
        url = `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=18&with_original_language=en&sort_by=popularity.desc&vote_count.gte=50`
        break
      case "naija-movies":
        // Nigerian Nollywood movies
        url = `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_origin_country=NG&sort_by=popularity.desc`
        break
      case "naija-movies-fallback":
        // Broader African cinema
        url = `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_origin_country=NG|GH|ZA&sort_by=popularity.desc`
        break
      case "latest-movies":
        // Latest movies currently in theaters or recently released
        url = `${TMDB_BASE_URL}/movie/now_playing?api_key=${TMDB_API_KEY}&region=US`
        break
      case "upcoming-movies":
        url = `${TMDB_BASE_URL}/movie/upcoming?api_key=${TMDB_API_KEY}&region=US`
        break
      case "top-rated-movies":
        url = `${TMDB_BASE_URL}/movie/top_rated?api_key=${TMDB_API_KEY}`
        break
      case "latest-tv":
        url = `${TMDB_BASE_URL}/tv/on_the_air?api_key=${TMDB_API_KEY}`
        break
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)

    const response = await fetch(url, { signal: controller.signal }).catch(() => null)
    clearTimeout(timeoutId)

    if (!response || !response.ok) {
      return NextResponse.json({ results: [], error: "TMDb is unavailable. Please use Discover to select another provider." }, { status: 502 })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("[v0] TMDb API error:", error)
    return NextResponse.json({ results: [], error: "TMDb request failed. Please use Discover to select another provider." }, { status: 502 })
  }
}

// Helper function to return appropriate fallback data
function getFallbackData(action: string | null) {
  switch (action) {
    case "trending-movies":
    case "popular-movies":
    case "kids-movies":
    case "horror-movies":
    case "comedy-movies":
    case "action-movies":
    case "romance-movies":
    case "movies-by-genre":
      return NextResponse.json(FALLBACK_MOVIES)
    case "trending-tv":
    case "popular-tv":
      return NextResponse.json(FALLBACK_TV)
    case "trending-kdrama":
    case "popular-kdrama":
      return NextResponse.json(FALLBACK_KDRAMA)
    case "anime-movies":
    case "anime-series":
      return NextResponse.json(FALLBACK_ANIME)
    case "bet-movies":
    case "bet-movies-fallback":
      return NextResponse.json({ results: [
        { id: 301, title: "The Color Purple", overview: "A story of resilience and sisterhood", poster_path: null, backdrop_path: null, release_date: "2023-12-25", vote_average: 7.5, genre_ids: [18, 10402] },
        { id: 302, title: "The Equalizer 3", overview: "Robert McCall finds peace in Southern Italy", poster_path: null, backdrop_path: null, release_date: "2023-09-01", vote_average: 6.9, genre_ids: [28, 53] },
        { id: 303, title: "Creed III", overview: "Adonis Creed faces a childhood friend", poster_path: null, backdrop_path: null, release_date: "2023-03-03", vote_average: 7.2, genre_ids: [18, 28] },
        { id: 304, title: "A Journal for Jordan", overview: "A soldier's love story", poster_path: null, backdrop_path: null, release_date: "2021-12-25", vote_average: 6.8, genre_ids: [18, 10749] },
        { id: 305, title: "The Woman King", overview: "The story of the Agojie warriors", poster_path: null, backdrop_path: null, release_date: "2022-09-16", vote_average: 7.4, genre_ids: [28, 18, 36] },
      ]})
    case "naija-movies":
    case "naija-movies-fallback":
      return NextResponse.json({ results: [
        { id: 401, title: "The Black Book", overview: "A deacon takes on a criminal enterprise", poster_path: null, backdrop_path: null, release_date: "2023-09-22", vote_average: 6.5, genre_ids: [28, 53] },
        { id: 402, title: "Gangs of Lagos", overview: "Friends in Lagos navigate gang life", poster_path: null, backdrop_path: null, release_date: "2023-04-07", vote_average: 5.8, genre_ids: [28, 80] },
        { id: 403, title: "Brotherhood", overview: "Brothers on opposite sides of the law", poster_path: null, backdrop_path: null, release_date: "2022-09-23", vote_average: 5.5, genre_ids: [28, 80, 18] },
        { id: 404, title: "King of Thieves", overview: "An epic tale set in the Yoruba kingdom", poster_path: null, backdrop_path: null, release_date: "2022-04-08", vote_average: 5.2, genre_ids: [28, 18] },
        { id: 405, title: "A Tribe Called Judah", overview: "A mother fights to protect her family", poster_path: null, backdrop_path: null, release_date: "2023-12-15", vote_average: 6.0, genre_ids: [35, 18] },
      ]})
    case "latest-movies":
    case "upcoming-movies":
    case "top-rated-movies":
      return NextResponse.json(FALLBACK_MOVIES)
    case "latest-tv":
      return NextResponse.json(FALLBACK_TV)
    case "movie-genres":
      return NextResponse.json({ genres: [
        { id: 28, name: "Action" },
        { id: 35, name: "Comedy" },
        { id: 18, name: "Drama" },
        { id: 27, name: "Horror" },
        { id: 10749, name: "Romance" },
        { id: 878, name: "Science Fiction" },
        { id: 16, name: "Animation" },
      ]})
    default:
      return NextResponse.json({ results: [] })
  }
}

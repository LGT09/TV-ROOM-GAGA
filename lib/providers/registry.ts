export interface ProviderParam {
  name: string
  description: string
  required?: boolean
  values?: string[]
}
export interface ProviderDefinition {
  id: string
  name: string
  kind: string
  actions: string[]
  defaultAction: string
  description: string
  params: ProviderParam[]
  route?: string
}

function omega(route: string, name: string, actions: string, fields: string, defaultAction?: string, description?: string): ProviderDefinition {
  return {
    id: `omega-${route}`, route: route === "MoviesTv" ? "MovieTV" : route,
    name, kind: "OmegaTech", actions: actions.split(" "), defaultAction: defaultAction || actions.split(" ")[0],
    description: description || `${name} via OmegaTech. Availability and catalogue depend on the upstream provider.`,
    params: fields.split(" ").filter(Boolean).map(name => ({ name, description: name.replace(/([a-z])([A-Z])/g, "$1 $2") })),
  }
}

export const providers: ProviderDefinition[] = [
  { id: "moviebox", name: "MovieBox", kind: "Movies & series", defaultAction: "home",
    description: "MovieBox REST catalogue, title details, episode streams, captions and alternate audio editions.",
    actions: ["home", "search", "movies", "tv-series", "detail", "episodes", "stream", "captions", "resources", "audio-tracks", "suggest"],
    params: [{ name: "q", description: "Search title" }, { name: "id", description: "Subject ID (keep as text)" }, { name: "path", description: "Title slug / detail path" }, { name: "season", description: "Season, 0 for films" }, { name: "episode", description: "Episode, 0 for films" }, { name: "page", description: "Page" }] },
  { id: "dramabox", name: "DramaBox", kind: "Short dramas", defaultAction: "home",
    description: "Public short-drama catalogue and unlocked episodes from the corrected PuruBoy API host.",
    actions: ["home", "search", "category", "detail", "stream"],
    params: [{ name: "q", description: "Search drama" }, { name: "id", description: "Book ID, or category ID for category" }, { name: "chapter", description: "Unlocked chapter ID" }] },
  { id: "sinhalasub", name: "SinhalaSub · npm", kind: "Movies & series", defaultAction: "recent-movies",
    description: "Server-side @sl-code-lords/movie-api integration. Search, browse and resolve films, shows and episodes.",
    actions: ["search", "recent-movies", "recent-tvshows", "language", "genre", "year", "actor", "director", "movie", "tvshow", "episode"],
    params: [{ name: "q", description: "Title" }, { name: "url", description: "sinhalasub.lk title, episode, cast or director URL" }, { name: "language", description: "English, Sinhala, Tamil, Hindi, Korean…" }, { name: "genre", description: "Action, Drama, Comedy, Science_fiction…" }, { name: "year", description: "Release year" }, { name: "page", description: "Page" }] },
  omega("cineplex", "Cineplex", "nowPlaying search cities upcoming detail full", "query cityId id"),
  omega("CineSubz", "CineSubz scraper", "search detail player follow all", "query slug postId videoUrl"),
  omega("Free-drama", "Free Drama", "home search detail stream", "query id epsid"),
  omega("Iptv", "IPTV directory", "channels streams search channel categories countries logos guides feeds languages regions subdivisions cities timezones blocklist search-country search-category", "query channelId country category"),
  omega("cinesubz-search", "CineSubz Search", "search", "query"),
  omega("MovieBox-pro", "MovieBox Pro", "home search trending detail download suggest recommend filter ranking staff staffrel platform country video", "keyword subjectId detailPath se ep page perPage id staffId platform tabId subjectType genre sort year region language url"),
  omega("MovieBox-pro2", "MovieBox Core v2", "homepage trending info sources", "subjectId season episode page perPage"),
  omega("movieda", "Moviesda", "home search list movie resolve info", "q query year page slug url"),
  omega("naijaprey", "NaijaPrey", "home search movies series categories tags tag post resolve sdm info", "q query page per_page slug id url sdm"),
  omega("netshort", "NetShort", "home search episodes stream", "keyword page pageSize slug shortPlayId episodeNo"),
  omega("Drama-search", "PineDrama Search", "search", "query"),
  omega("sinhalasub", "SinhalaSub · Omega", "home search detail listing genres", "query url path page"),
  omega("TMDB", "TMDb · Omega", "trending search detail", "query type id page season episode"),
  omega("veloflix", "Veloflix", "home search trending category detail", "query type page country genre sort year id"),
  omega("Winbu", "Winbu", "home search series film stream category genre genres", "query slug category genre page"),
  omega("Vidio-Tv", "Vidio TV", "list search", "query"),
  omega("Live-Tv", "International Live TV", "list play filter regions languages categories", "channel region language category quality"),
  omega("Movieku", "Movieku", "latest search detail", "query url page detail"),
  omega("MoviesTv", "MoviesTV", "trending search detail season discover", "query id type season episode timeWindow page genreId year sortBy", "trending", "MoviesTV. OmegaTech currently documents this endpoint as MovieTV (formerly supplied as MoviesTv)."),
  omega("net9ja", "Net9ja", "home search movies series categories tags tag post resolve sdm info", "q query page per_page slug id url sdm"),
  omega("Moviebox_off", "MovieBox Official", "home trending detail play", "subjectId page se ep"),
  omega("movie", "Movie Search & Download", "search detail", "query url"),
  omega("lk21-2", "LK21", "home browse genres countries years search detail stream", "path page type query url"),
  omega("Layarcha", "LayarKaca21", "home search detail genre year best", "query slug genreSlug year country page filterAdult"),
  omega("Idn-Times", "IDN Times", "news search live_categories streams stream_detail article", "query slug category"),
  omega("Clipcafe", "ClipCafe Quotes", "search", "phrase lang from size"),
  omega("cinesubz", "CineSubz catalogue", "latest search detail resolve", "query type page url"),
  omega("Akwam", "Akwam", "search content episode resolve", "query url episode download"),
]

export const providerById = (id: string) => providers.find(p => p.id === id)

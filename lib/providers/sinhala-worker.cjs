// Isolate the legacy scraper so its network requests can be terminated on timeout.
const axios = require("axios")
axios.defaults.timeout = 12000
axios.defaults.maxRedirects = 3
const { SinhalaSub } = require("@sl-code-lords/movie-api")
const input = JSON.parse(process.argv[2])
const actions = {
  search: () => SinhalaSub.get_list.by_search(input.q),
  "recent-movies": () => SinhalaSub.get_list.by_recent_movies(input.page),
  "recent-tvshows": () => SinhalaSub.get_list.by_recent_tvshows(input.page),
  language: () => SinhalaSub.get_list.by_language[input.language](input.page),
  genre: () => SinhalaSub.get_list.by_genre[input.genre](input.page),
  year: () => SinhalaSub.get_list.by_year(input.year, input.page),
  actor: () => SinhalaSub.get_list.by_actor(input.url, input.page),
  director: () => SinhalaSub.get_list.by_director(input.url, input.page),
  movie: () => SinhalaSub.movie(input.url),
  tvshow: () => SinhalaSub.tvshow(input.url),
  episode: () => SinhalaSub.episode(input.url),
}
Promise.resolve().then(() => actions[input.action]()).then(data => {
  process.stdout.write("\nTVROOM_RESULT:" + JSON.stringify(data))
}).catch(() => {
  process.stdout.write("\nTVROOM_RESULT:" + JSON.stringify({ status: false, message: "SinhalaSub could not resolve this request. The upstream site may have changed or be offline." }))
  process.exitCode = 1
})

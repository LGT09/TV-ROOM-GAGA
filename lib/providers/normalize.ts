import { webUrl } from "./http"

export interface MediaItem {
  id: string; title: string; poster: string; description: string; year: string
  type: string; detailPath: string; url: string; provider: string; rating?: number; genres?: string[]
  taskId?: string; taskParam?: string; mediaUrl?: string
}
export interface MediaSource { url: string; quality: string; label: string; download?: string; format?: string }

const str = (v: any) => typeof v === "string" || typeof v === "number" ? String(v) : ""
const direct = (v: unknown) => typeof v === "string" && /\.(mp4|m3u8|mpd|webm|m4v|mp3|m4a)(?:[?#]|$)/i.test(v)
const containers = ["data", "result", "results", "items", "sections", "featured", "banners", "banner", "trending", "movies", "series", "list", "lists", "subjects", "subject", "book", "detail", "raw", "contents", "recommendations", "home", "cards", "rows", "content", "latest", "popular", "channels", "categories", "dramas", "searchResult", "searchResults", "posts"]

export function normalizeProvider(data: any, provider: string) {
  const items: MediaItem[] = []
  const seenItems = new Set<string>()
  function itemWalk(value: any, depth = 0, section = "") {
    if (!value || typeof value !== "object" || depth > 9 || items.length >= 300) return
    if (Array.isArray(value)) { value.forEach(v => itemWalk(v, depth + 1, section)); return }
    section = str(value.section || value.sectionName) || section
    const title = str(value.title || value.name || value.bookName || value.subjectName || value.movieName)
    const taskParam = ["taskId","task_id","taskid","jobId","job_id"].find(key=>value[key]!==undefined)
    const taskId = taskParam ? str(value[taskParam]) : str(value.task?.taskId || value.task?.task_id)
    const id = str(value.subject_id || value.subjectId || value.bookId || value.id || value.slug || taskId || value.link || value.url)
    const rawGenres = value.genres || value.genre || value.categories || []
    const isAnime = /japan/i.test(str(value.countryName)) && /animation|anime/i.test(str(rawGenres))
    const genres: string[] = [...new Set<string>([...(Array.isArray(rawGenres) ? rawGenres.map((g: any) => str(g.name || g)) : str(rawGenres).split(",")), section, ...(isAnime ? ["Anime"] : [])].filter(Boolean))]
    const mediaType = provider === "dramabox" || value.subjectType === 2 || value.subject_type === 2 ? isAnime ? "anime" : "series" : str(value.type || value.media_type) || (/anime/i.test(section) ? "anime" : /series|shows|drama|short tv/i.test(section) ? "series" : "movie")
    const existing = items.find(item => item.id === id)
    if (existing) {
      existing.genres = [...new Set([...(existing.genres || []), ...genres])]
      if (mediaType === "series" || mediaType === "anime") existing.type = mediaType
    }
    if (title && id && !seenItems.has(id)) {
      seenItems.add(id)
    const poster = value.poster_url || value.posterUrl || value.poster || value.cover || value.coverUrl || value.thumbnail || value.image || value.imageUrl || value.poster_path || value.cover?.url || value.image?.url || value.images?.[0]
      items.push({
        id, title, provider, taskId: taskId || undefined, taskParam: taskParam || (taskId ? "taskId" : undefined),
        mediaUrl: webUrl(value.downloadUrl || value.download_url || value.streamUrl || value.videoUrl || (direct(value.url) ? value.url : "")),
        poster: typeof poster === "string" && poster.startsWith("/") ? `https://image.tmdb.org/t/p/w500${poster}` : webUrl(typeof poster === "object" ? poster?.url : poster),
        description: str(value.description || value.overview || value.synopsis || value.desc),
        year: str(value.year || value.releaseDate || value.release_date).slice(0, 4),
        type: mediaType, genres,
        detailPath: str(value.detailPath || value.detail_path || value.slug),
        url: webUrl(value.url || value.link), rating: Number(value.rating || value.vote_average || value.imdbRating || value.imdbRatingValue) || undefined,
      })
    }
    containers.forEach(key => itemWalk(value[key], depth + 1, section))
  }
  itemWalk(data)

  const sources: MediaSource[] = []
  const subtitles: { url: string; language: string; label: string; proxyUrl: string }[] = []
  const seenSources = new Set<string>()
  function addSource(value: any, label = "Original", explicit = false) {
    if (typeof value === "string") value = { url: value }
    if (!value || typeof value !== "object" || value.locked === true || value.unlock === false) return
    const url = webUrl(value.originalStreamUrl || value.streamUrl || value.stream_url || value.videoUrl || value.video_url || value.downloadUrl || value.download_url || value.direct || value.file || value.src || value.url || value.link)
    // Never treat a title page or embedded HTML server as a playable file.
    if (!url || (!explicit && !direct(url)) || seenSources.has(url)) return
    if (/\.(srt|vtt)(?:[?#]|$)/i.test(url)) return
    seenSources.add(url)
    sources.push({ url, quality: str(value.quality || value.resolution || value.label) || label, label: str(value.label || value.quality || value.resolution) || label,
      download: webUrl(value.downloadUrl || value.download || url), format: /\.m3u8(?:[?#]|$)/i.test(url) ? "HLS" : /\.mpd(?:[?#]|$)/i.test(url) ? "DASH" : str(value.format) || "MP4" })
  }
  function sourceWalk(value: any, depth = 0, context = "") {
    if (!value || depth > 10 || sources.length > 100) return
    if (Array.isArray(value)) { value.forEach(v => sourceWalk(v, depth + 1, context)); return }
    if (typeof value !== "object") {
      if (/^(sources|qualities|videos|streams|dl_links|downloadLinks|downloads)$/.test(context)) addSource(value, context, true)
      return
    }
    if (/subtitle|caption/i.test(context)) {
      const url = webUrl(value.url || value.file || value.src || value.subtitle_url)
      if (url && !subtitles.some(s => s.url === url)) subtitles.push({ url, language: str(value.languageCode || value.language_code || value.lang || value.lan || value.language) || "und", label: str(value.name || value.label || value.lanName || value.language) || "Subtitles", proxyUrl: `/api/subtitle?url=${encodeURIComponent(url)}` })
      return
    }
    if (!["items", "featured", "episodes", "chapters"].includes(context)) addSource(value, "Original", /^(sources|qualities|videos|streams|dl_links|downloadLinks|downloads)$/.test(context))
    for (const [key, child] of Object.entries(value)) {
      if(value.originalStreamUrl&&key==="streamUrl")continue
      if (/^(bestQualityUrl|streamUrl|stream_url|videoUrl|video_url|downloadUrl|download_url|direct_url|playUrl|play_url|m3u8|mp4|hd|sd|hd_url|sd_url|nowatermark|no_watermark|audio)$/i.test(key) && typeof child === "string") addSource({ url: child, quality: value.quality || key }, key, true)
      else if (child && typeof child === "object" && !["cast", "performers", "audio_tracks", "trailer", "recommendations", "items", "featured", "episodes", "chapters", "cover", "image", "images", "media"].includes(key)) sourceWalk(child, depth + 1, key)
    }
  }
  sourceWalk(data)

  const root = data?.data || data?.result || data
  const details = root?.subject || root?.book || root
  const rawEpisodes = root?.episodes || root?.chapters || details?.episodes || root?.links || []
  const episodes = Array.isArray(rawEpisodes) ? rawEpisodes.flat(2).filter(e => e && typeof e === "object").map((e: any, i: number) => ({
    id: str(e.id || e.chapterId || e.episodeId || e.link || e.url || i + 1),
    title: str(e.title || e.name || e.episode) || `Episode ${i + 1}`,
    season: Number(e.season || e.se || str(e.episode).split(" - ")[0]) || 1,
    episode: Number(e.episode_number || e.ep || (typeof e.index === "number" ? e.index + 1 : i + 1)),
    url: webUrl(e.link || e.url), locked: e.unlock === false || e.locked === true,
    unlock: e.unlock === true || (provider !== "dramabox" && e.locked !== true),
  })) : []
  const rawSeasons = data?.parsed_resources?.seasons || root?.resources?.seasons || root?.seasons || root?.resource?.seasons || details?.seasons || []
  const seasons = Array.isArray(rawSeasons) ? rawSeasons.map((s: any) => ({ ...s, episode_count: s.episode_count || s.max_episodes || s.maxEp || s.episodes })) : []
  const rawTracks = data?.audio_tracks || root?.audio_tracks || root?.audioTracks || root?.dubs || []
  const audioTracks = Array.isArray(rawTracks) ? rawTracks.map((t: any) => ({
    id: str(t.subject_id || t.subjectId || t.id), title: str(t.name || t.language || t.label),
    detailPath: str(t.slug || t.detailPath), provider,
  })).filter(t => t.id) : []
  return { items, sources, subtitles, episodes, seasons, audioTracks }
}

import "server-only"
import { runProvider } from "../providers/service"
import { providers } from "../providers/registry"
import { providerJson, ProviderError, integer } from "../providers/http"
import { allowedMediaUrl, mediaFetch } from "../providers/media-url"
import type { MediaItem, MediaSource } from "../providers/normalize"
import { normalizeProvider } from "../providers/normalize"
import { categories, inCategory, sameTitle } from "./categories"
import { seal, unseal } from "./tokens"
import { preferPrimary } from "../providers/fallback"

type Result = { items: MediaItem[]; sources: MediaSource[]; subtitles: {url:string;language:string;label:string}[]; episodes: any[]; seasons: any[]; audioTracks: any[] }
type Locator = MediaItem
const cache = new Map<string, { expires: number; value: any }>()
const pending = new Map<string, Promise<any>>()
const unavailable = new Map<string, number>()
const searches = [...new Set(["omega-MovieBox-pro", "moviebox", "omega-Free-drama",
  ...providers.filter(p => p.actions.includes("search") && p.actions.some(a => ["stream", "resolve", "download", "play", "sources", "movie", "episode"].includes(a))).map(p => p.id)])]
const browses = ["omega-MovieBox-pro", "moviebox", "omega-Moviebox_off", "omega-veloflix", "omega-Winbu", "dramabox"]

async function cached<T>(key: string, ttl: number, work: () => Promise<T>): Promise<T> {
  const hit = cache.get(key)
  if (hit && hit.expires > Date.now()) return hit.value
  if (pending.has(key)) return pending.get(key)!
  const job = work().then(value => {
    if (cache.size > 100) cache.delete(cache.keys().next().value!)
    cache.set(key, { value, expires: Date.now() + ttl })
    return value
  }).catch(error=>{
    // Catalogue metadata can survive a short provider outage; never serve stale media URLs.
    if(key.startsWith("list:")&&hit&&hit.expires+1800000>Date.now())return hit.value
    throw error
  }).finally(() => pending.delete(key))
  pending.set(key, job)
  return job
}
async function attempt(id: string, action: string, p: URLSearchParams): Promise<Result> {
  const healthKey = `${id}:${action}`
  if ((unavailable.get(healthKey) || 0) > Date.now()) throw new Error("Temporarily unavailable")
  let timer: ReturnType<typeof setTimeout>
  try {
    return await Promise.race([
      runProvider(id, action, p),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Timed out")), action==="stream" ? 15000 : 4500) }),
    ])
  } catch (e) { if(!(e instanceof ProviderError&&e.status===425))unavailable.set(healthKey, Date.now() + 30000); throw e }
  finally { clearTimeout(timer!) }
}
/** Hedged batches: the first useful response wins; empty/error responses trigger the next batch. */
async function firstUseful(ids: string[], action: string, p: URLSearchParams, accept: (r: Result) => boolean): Promise<Result> {
  const deadline=Date.now()+10000
  const useful=async(id:string)=>{
    const data=await attempt(id,action,p)
    if(!accept(data))throw new Error("No matching results")
    return data
  }
  const alternatives=async()=>{
    for(let i=1;i<ids.length&&Date.now()<deadline;i+=3){
      try{return await Promise.any(ids.slice(i,i+3).map(useful))}catch{}
    }
    throw new Error("No matching connections")
  }
  let timer:ReturnType<typeof setTimeout>|undefined
  try {
    return await Promise.race([
      preferPrimary([()=>useful(ids[0])],[alternatives],700),
      new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error("Catalogue deadline")),12000)}),
    ])
  }catch{throw new ProviderError("The library is temporarily unavailable after trying alternate connections. Please retry shortly.",502)}
  finally{clearTimeout(timer)}
}
function imageUrl(url: string) {
  if (!url) return ""
  try { allowedMediaUrl(url); return `/api/media?key=${seal("media", { url, kind: "image" }, 86400)}` } catch { return "" }
}
export function publicItem(item: Locator) {
  return { key: seal("item", item), title: item.title, poster: imageUrl(item.poster), description: item.description,
    year: item.year, type: item.type, rating: item.rating, genres: item.genres || [] }
}
const input = (item: Locator) => new URLSearchParams({ id: item.id, path: item.detailPath || "", url: item.url || "", ...(item.taskId?{[item.taskParam||"taskId"]:item.taskId}:{}) })

async function genreMetadata(category: string): Promise<MediaItem[]> {
  // Editorial title searches, not fabricated catalogue entries. Only real returned
  // records matching these family/franchise titles enter these collections.
  const collections: Record<string, string[]> = {
    kids: ["Toy Story", "Finding Nemo", "Kung Fu Panda"],
    "sci-fi": ["Star Wars", "Interstellar", "Dune"],
    cartoons: ["Tom and Jerry", "SpongeBob SquarePants", "Pokemon"],
  }
  const titles = collections[category] || []
  const results = await Promise.allSettled(titles.map(q => firstUseful(searches.slice(0, 3), "search", new URLSearchParams({ q, page: "1" }), r => r.items.length > 0)))
  const found = new Map<string, MediaItem>()
  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    if (result.status !== "fulfilled") continue
    for (const item of result.value.items) {
      if (!item.title.toLowerCase().includes(titles[i].toLowerCase())) continue
      const label = category === "kids" ? "Kids & family" : category === "sci-fi" ? "Science fiction" : "Cartoons"
      found.set(`${item.provider}:${item.id}`, { ...item, genres: [...(item.genres || []), label] })
    }
  }
  return [...found.values()]
}

export async function libraryList(p: URLSearchParams) {
  const category = categories.some(c => c.id === p.get("category")) ? p.get("category")! : "all"
  const type = ["movie", "series", "anime"].includes(p.get("type") || "") ? p.get("type")! : "all"
  const q = (p.get("q") || "").trim().slice(0, 150)
  const page = Math.max(1, integer(p.get("page"), 1, 100))
  const limit = [12, 24, 36].includes(Number(p.get("limit"))) ? Number(p.get("limit")) : 12
  const data = await cached(`list:${q}:${category}:${type}`, 120000, async () => {
    let items: MediaItem[] = []
    const result = await firstUseful(q ? searches : browses, q ? "search" : "home", new URLSearchParams({ q, page: "1" }), r => r.items.length > 0)
    items = result.items
    if (q && (category !== "all" || type !== "all")) {
      const home = await firstUseful(browses.slice(0, 3), "home", new URLSearchParams(), r => r.items.length > 0).catch(() => null)
      const index = new Map(home?.items.map(item => [`${item.provider}:${item.id}`, item]) || [])
      items = items.map(item => ({ ...item, ...(index.get(`${item.provider}:${item.id}`) || {}) }))
      items = await Promise.all(items.slice(0, 36).map(async item => {
        if (index.has(`${item.provider}:${item.id}`)) return item
        try {
          const details = await attempt(item.provider, "detail", input(item))
          return { ...item, ...(details.items.find(m => m.id === item.id) || {}) }
        } catch { return item }
      }))
    }
    if (!q && ["kids", "sci-fi", "cartoons"].includes(category) && !items.some(item => inCategory(item, category) && !item.genres?.some(g => /adult|erotic|porn/i.test(g)))) {
      items = await genreMetadata(category).catch(() => [])
    }
    if (!q && ["horror","comedy","action","sci-fi","romance","cartoons"].includes(category)) {
      // Upstream collection headings can be wrong; prefer actual title genres.
      items = await Promise.all(items.filter(item=>inCategory(item,category)).slice(0,60).map(async item=>{
        try {
          const details=await attempt(item.provider,"detail",input(item))
          const verified=details.items.find(m=>m.id===item.id)
          return verified?.genres?.length ? {...item,...verified} : item
        } catch { return item }
      }))
    }
    return items.filter(item => !item.genres?.some(g => /adult|erotic|porn/i.test(g)) &&
      inCategory(item, category) &&
      (type === "all" || item.type === type || type === "series" && /tv|show|series/i.test(item.type) || type === "anime" && item.genres?.some(g => /anime/i.test(g))))
  })
  const start = (page - 1) * limit
  return { success: true, items: data.slice(start, start + limit).map(publicItem), categories, page, limit,
    hasNext: start + limit < data.length, total: data.length,
    message: data.length ? undefined : "No titles match these filters. Try another category or search." }
}

async function findAlternative(item: Locator, skip: Set<string> = new Set(), deadline = Date.now() + 14000): Promise<Locator[]> {
  const candidates: Locator[] = []
  const ids = searches.filter(id => !skip.has(id))
  // Search only compatible sources, and only exact normalized title/year matches may resolve.
  for (let i = 0; i < ids.length && candidates.length < 3 && Date.now() < deadline; i += 3) {
    const batch = await Promise.allSettled(ids.slice(i, i + 3).map(id => attempt(id, "search", new URLSearchParams({ q: item.title, page: "1" }))))
    for (const result of batch) if (result.status === "fulfilled") candidates.push(...result.value.items.filter(candidate => sameTitle(item, candidate)))
    if (candidates.length) break
  }
  return candidates
}
async function routedItem(item: Locator): Promise<Locator> {
  if (item.provider !== "metadata") return item
  const match = await findAlternative(item)
  if (!match.length) throw new ProviderError("Details or episodes for this title are not available on the current connections.", 404)
  return { ...item, ...match[0], year:item.year||match[0].year,type:item.type, poster: match[0].poster || item.poster, description: match[0].description || item.description, genres: [...new Set([...(item.genres || []), ...(match[0].genres || [])])] }
}
function preferredByName(item:Locator):Promise<Locator>{
  return cached(`preferred:${[item.provider,item.id,item.year,item.type,item.taskId].join(":")}`,300000,()=>lookupPreferred(item))
}
async function lookupPreferred(item:Locator):Promise<Locator>{
  if(item.provider==="dramabox")return item
  try {
    const result=await attempt("omega-MovieBox-pro","search",new URLSearchParams({q:item.title,page:"1"}))
    const candidates=result.items.filter(candidate=>sameTitle(item,candidate)&&!(item.type==="movie"&&/series|anime|tvshow/i.test(candidate.type)))
    for(const candidate of candidates){
      const sameSubject=candidate.id===item.id&&/^(moviebox|omega-Movie[Bb]ox)/.test(item.provider)
      if(item.year&&!candidate.year&&!sameSubject){
        const detail=await attempt(candidate.provider,"detail",input(candidate))
        const verified=detail.items.find(m=>m.id===candidate.id)
        if(!verified?.year||verified.year!==item.year||!sameTitle(item,verified))continue
      }
      if(item.type!=="movie"&&candidate.type==="movie"){
        const detail=await attempt(candidate.provider,"detail",input(candidate))
        if(!detail.seasons.length&&!detail.episodes.length)continue
      }
      return {...item,...candidate,title:item.title,year:item.year||candidate.year,type:item.type,genres:[...new Set([...(item.genres||[]),...(candidate.genres||[])])]}
    }
  }catch{}
  return item
}
export async function libraryDetail(token: string) {
  const original = unseal<Locator>(token, "item")
  return cached(`detail:${JSON.stringify(original)}`,120000,()=>loadDetail(original))
}
async function loadDetail(original:Locator) {
  const item = await preferredByName(await routedItem(original))
  const p = input(item)
  const [detail,resources] = await Promise.all([
    attempt(item.provider,"detail",p).catch(()=>null),
    (item.provider === "moviebox" || /^omega-Movie[Bb]ox/.test(item.provider)) && item.id!==item.taskId
      ? attempt("moviebox","resources",p).catch(()=>null):Promise.resolve(null),
  ])
  const next = { ...item, ...(detail?.items.find(m => m.id === item.id) || {}), genres: [...new Set([...(item.genres || []), ...(detail?.items[0]?.genres || [])])] }
  const seasons = (resources?.seasons?.length ? resources.seasons : detail?.seasons || []).map((s: any, i: number) => ({
    season: Number(s.season ?? s.seasonNumber ?? s.number ?? i + 1), episode_count: Number(s.episode_count || 0),
  })).filter((s: any) => s.season > 0)
  let episodes = detail?.episodes?.length ? detail.episodes : resources?.episodes || []
  if (!episodes.length && /moviebox/i.test(item.provider)) {
    // Enumerate only real resource counts; these connections resolve by season/number.
    episodes = seasons.flatMap(s => Array.from({ length: Math.min(1000,s.episode_count) }, (_, index) => ({
      id: `${s.season}-${index+1}`, title: `Episode ${index+1}`, season:s.season, episode:index+1, locked:false,
    })))
  }
  if (episodes.length && !seasons.length) {
    for (const season of [...new Set(episodes.map((e: any) => e.season || 1))]) seasons.push({ season, episode_count: episodes.filter((e: any) => (e.season || 1) === season).length })
  }
  if (seasons.length) next.type = /anime/i.test(original.type) ? "anime" : "series"
  const tracks = resources?.audioTracks?.length ? resources.audioTracks : detail?.audioTracks || []
  return { success: true, item: publicItem(next), seasons, episodes: episodes.map((e: any) => ({ id: e.id, title: e.title, season: e.season, episode: e.episode, locked: e.locked })),
    audioTracks: tracks.map((track: any) => ({ key: seal("item", { ...next, id: track.id, detailPath: track.detailPath || next.detailPath, title: next.title }), title: track.title })),
    message: !detail ? "Some title information is temporarily unavailable. You can still try playback." : undefined }
}

function mediaLink(url: string, title: string, format: string, fallbacks: string[] = []) {
  allowedMediaUrl(url)
  fallbacks.forEach(allowedMediaUrl)
  return `/api/media?key=${seal("media", { url, title, kind: "video", format, downloadMode:"original", ...(fallbacks.length?{fallbacks}:{}) }, 21600)}${format === "HLS" ? "&format=hls" : format==="DASH"?"&format=dash":""}`
}
async function usable(source: MediaSource) {
  try {
    const url = allowedMediaUrl(source.url)
    const response = await mediaFetch(url.href,{Range:"bytes=0-0"},4000)
    const ok = response.ok && /^(video\/|audio\/(?:x-)?mpegurl|application\/(octet-stream|vnd\.apple\.mpegurl|x-mpegurl|dash\+xml))/i.test(response.headers.get("content-type") || "")
    await response.body?.cancel()
    return ok
  } catch { return false }
}
async function resolve(item: Locator, p: URLSearchParams): Promise<Result> {
  const parameters = input(item)
  for (const k of ["season", "episode", "chapter"]) if (p.has(k)) parameters.set(k, p.get(k)!)
  if(item.mediaUrl){
    const source={url:item.mediaUrl,quality:"Auto",label:"Auto",format:/\.m3u8(?:[?#]|$)/i.test(item.mediaUrl)?"HLS":"MP4"}
    if(await usable(source))return {items:[],sources:[source],subtitles:[],episodes:[],seasons:[],audioTracks:[]}
  }
  const data = await attempt(item.provider, "stream", parameters)
  if (!data.sources.length) throw new Error("No sources")
  const verified = await Promise.all(data.sources.slice(0, 6).map(async source => await usable(source) ? source : null))
  const sources = verified.filter((s): s is MediaSource => Boolean(s))
  if (!sources.length) throw new Error("Media unavailable")
  return { ...data, sources }
}
export async function libraryStream(token: string, p: URLSearchParams) {
  const original=unseal<Locator>(token,"item")
  const params=new URLSearchParams(p)
  return cached(`stream:${JSON.stringify(original)}:${["season","episode","chapter","retry","downloadOnly"].map(k=>params.get(k)||"").join(":")}`,60000,()=>loadStream(original,params))
}
function isDownloadable(source:MediaSource) {
  return !["HLS","DASH"].includes((source.format||"").toUpperCase())&&!/\.(m3u8|mpd)(?:[?#]|$)/i.test(source.url)
}
async function loadStream(original:Locator,p:URLSearchParams) {
  const deadline = Date.now() + 20000
  const routed=await routedItem(original)
  // Still start the preferred name lookup first, but do not block every alternate
  // resolver behind an unresponsive search connection.
  let preferredTimer:ReturnType<typeof setTimeout>|undefined
  const item=await Promise.race([preferredByName(routed),new Promise<Locator>(done=>{preferredTimer=setTimeout(()=>done(routed),1200)})]).finally(()=>clearTimeout(preferredTimer))
  if (p.get("chapter")?.length && item.provider === "dramabox") {
    // The provider adapter validates public/unlocked chapters; do not search around a lock.
    const detail = await attempt(item.provider, "detail", input(item))
    const chapter = detail.episodes.find((e: any) => e.id === p.get("chapter"))
    if (!chapter || chapter.locked || !chapter.unlock) throw new ProviderError("This episode is not available for public playback or download.", 403)
  }
  const movie = item.type === "movie"
  if (movie) { p.set("season", "0"); p.set("episode", "0") }
  else { p.set("season", String(Math.max(1, integer(p.get("season"))))); p.set("episode", String(Math.max(1, integer(p.get("episode"))))) }
  let data: Result | undefined
  let streamOnly:Result|undefined
  const sharedId = /^(moviebox|omega-Movie[Bb]ox)/.test(item.provider) && item.id!==item.taskId
  const sameId = sharedId ? [...new Set(["omega-MovieBox-pro",item.provider,"moviebox","omega-MovieBox-pro2","omega-Moviebox_off"])] : [item.provider]
  if (Number(p.get("retry")) > 0) sameId.push(sameId.shift()!)
  let preparing:ProviderError|undefined
  const requireFile=(result:Result)=>{
    if(result.sources.some(isDownloadable))return result
    streamOnly ||= result
    throw new Error("No downloadable file")
  }
  const fromProvider=async(provider:string)=>{
    try{return requireFile(await resolve({...item,provider},p))}
    catch(e){if(e instanceof ProviderError&&e.status===425)preparing=e;throw e}
  }
  const sameSubject=()=>sameId.length===1?fromProvider(sameId[0]):
    preferPrimary([()=>fromProvider(sameId[0])],sameId.slice(1).map(id=>()=>fromProvider(id)),700)
  const alternatives=async():Promise<Result>=>{
    if (sameId.includes("moviebox") && Date.now() < deadline) {
      try {
        const query = new URLSearchParams({ subjectId: item.id, detailPath: item.detailPath, se: p.get("season")!, ep: p.get("episode")! })
        const alternative = normalizeProvider(await providerJson(`https://stream.omegatech.app/info?${query}`, 4000), "stream")
        const checks = await Promise.all(alternative.sources.slice(0,6).map(async source => await usable(source) ? source : null))
        const sources = checks.filter((source): source is MediaSource => Boolean(source))
        if (sources.length)return requireFile({ ...alternative, sources })
      } catch { /* Fixed, same-subject resolver failed; try verified title matches next. */ }
    }
    for (const candidate of await findAlternative(item, new Set(sameId), deadline - 5000)) {
      if (Date.now() > deadline) break
      try {
        const metadata = await attempt(candidate.provider, "detail", input(candidate))
        const match = metadata.items.find(m => m.id === candidate.id) || metadata.items[0]
        if (!match || !sameTitle(item, match)) continue
        if (item.type !== "movie" && match.type === "movie" && !metadata.seasons.some((s: any) => Number(s.season) > 0)) continue
        if(item.type==="movie"&&/series|anime|tvshow/i.test(match.type))continue
        return requireFile(await resolve({ ...candidate, ...match }, p))
      } catch { /* Only verified same-title/year/media-type alternatives are accepted. */ }
    }
    throw new Error("No downloadable alternatives")
  }
  let sourceTimer:ReturnType<typeof setTimeout>|undefined
  try {
    data=await Promise.race([
      item.provider==="dramabox"?sameSubject():preferPrimary([sameSubject],[alternatives],1200),
      new Promise<never>((_,reject)=>{sourceTimer=setTimeout(()=>reject(new Error("Source deadline")),Math.max(1,deadline-Date.now()))})
    ])
  }catch{
    if(p.get("downloadOnly")!=="1"&&streamOnly)data=streamOnly
    else if(preparing)throw preparing
  }finally{clearTimeout(sourceTimer)}
  if (!data) throw new ProviderError("No playable or downloadable file is available after trying alternate connections. Please retry later.", 502)
  let subtitles = data.subtitles
  if (!subtitles.length && item.provider === "moviebox" && !item.mediaUrl) {
    const captions = await attempt("moviebox", "captions", new URLSearchParams({ ...Object.fromEntries(input(item)), ...Object.fromEntries(p) })).catch(() => null)
    subtitles = captions?.subtitles || []
  }
  const safeSources = [...data.sources].sort((a,b)=>Number(a.format==="DASH")-Number(b.format==="DASH")).flatMap((source: MediaSource) => {
    try {
      const title = movie ? item.title : `${item.title} S${p.get("season")!.padStart(2,"0")}E${p.get("episode")!.padStart(2,"0")}`
      const url = mediaLink(source.url, title, source.format || "MP4")
      const isFile = isDownloadable(source)
       const downloadUrl = isFile ? `${mediaLink(source.download || source.url, title, source.format || "MP4", source.download&&source.download!==source.url?[source.url]:[])}&download=1` : undefined
      const resolution=String(source.quality||source.label).match(/\b(\d{3,4})p?\b/)
      const quality=resolution ? `${resolution[1]}p` : "Auto"
      return [{ url, downloadUrl, quality, label:quality, format: source.format }]
    } catch { return [] }
  })
  return { success: true, sources: safeSources, subtitles: subtitles.flatMap(caption => {
    try { allowedMediaUrl(caption.url); return [{ url: `/api/subtitle?key=${seal("caption", { url: caption.url }, 1800)}`, language: caption.language, label: caption.label }] } catch { return [] }
  }) }
}

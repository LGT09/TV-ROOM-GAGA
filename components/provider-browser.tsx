"use client"

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { AlertCircle, ArrowLeft, ArrowRight, Film, Headphones, Play, Search, Download, RotateCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MediaPlayback } from "@/components/media-playback"
import { CheckedDownload } from "@/components/checked-download"
import { readApiJson } from "@/lib/client-json"
import { cachedCatalogue, rememberCatalogue } from "@/lib/client-catalogue"

type LibraryItem = { key: string; title: string; poster: string; description: string; year: string | number; type: string; rating?: number; genres?: string[] }
type Season = { season: number; episode_count: number }
type Episode = { id: string; title: string; season: number; episode: number; locked: boolean }
type AudioTrack = { key: string; title: string }
type Source = { url: string; downloadUrl?: string; quality: string; label: string; format: string }
type Subtitle = { url: string; language: string; label: string }
type Listing = { items: LibraryItem[]; page: number; limit: number; hasNext: boolean; categories: { id: string; label: string }[]; message?: string }
type Detail = { item: LibraryItem; seasons: Season[]; episodes: Episode[]; audioTracks: AudioTrack[]; message?: string }
type Stream = { sources: Source[]; subtitles: Subtitle[]; message?: string }
const listCache = new Map<string, Listing>()
const detailCache=new Map<string,Promise<Detail>>()
function titleDetails(item:LibraryItem):Promise<Detail>{
  if(detailCache.has(item.key))return detailCache.get(item.key)!
  const job=fetch(`/api/library?action=detail&key=${encodeURIComponent(item.key)}`,{signal:AbortSignal.timeout(15000),cache:"no-store"}).then(async response=>{
    const data=await readApiJson(response)
    if(!response.ok||data.success===false)throw new Error(data.error||"Title details are unavailable.")
    return {item:data.item||item,seasons:data.seasons||[],episodes:data.episodes||[],audioTracks:data.audioTracks||[],message:data.message} as Detail
  }).catch(error=>{detailCache.delete(item.key);throw error})
  if(detailCache.size>=40)detailCache.delete(detailCache.keys().next().value!)
  detailCache.set(item.key,job)
  return job
}
const categoriesFallback = [
  { id: "all", label: "Everything" }, { id: "horror", label: "Horror" }, { id: "kids", label: "Kids" },
  { id: "comedy", label: "Comedy" }, { id: "african", label: "African" }, { id: "black-bet", label: "Black BET" },
  { id: "action", label: "Action" }, { id: "sci-fi", label: "Sci-fi" }, { id: "cartoons", label: "Cartoons" },
  { id: "romance", label: "Romance" }, { id: "anime", label: "Anime" },
]
const typeLabel = (value: string) => value === "series" ? "Series" : value === "anime" ? "Anime" : "Film"

export function ProviderBrowser(props: { compact?: boolean; initialQuery?: string }) {
  return <Suspense fallback={<div role="status" className="skeleton h-40 rounded-2xl" aria-label="Loading library" />}><MovieLibrary {...props}/></Suspense>
}
function MovieLibrary({ compact = false, initialQuery = "" }: { compact?: boolean; initialQuery?: string }) {
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(initialQuery || searchParams.get("q") || "")
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery || searchParams.get("q") || "")
  const [category, setCategory] = useState(searchParams.get("category") || searchParams.get("genre") || "all")
  const [type, setType] = useState(searchParams.get("type") || "all")
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(12)
  const [listing, setListing] = useState<Listing | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [selected, setSelected] = useState<LibraryItem | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [season, setSeason] = useState(1)
  const [episode, setEpisode] = useState(1)
  const [stream, setStream] = useState<Stream | null>(null)
  const [streamLoading, setStreamLoading] = useState(false)
  const [streamError, setStreamError] = useState("")
  const [streamPreparing,setStreamPreparing]=useState(false)
  const [retry, setRetry] = useState(0)
  const [activeKey, setActiveKey] = useState("")
  const controllerRef = useRef<AbortController | null>(null)
  const detailController = useRef<AbortController | null>(null)
  const streamController = useRef<AbortController | null>(null)
  const isSeries = /series|anime|tv/i.test(selected?.type || "")
  const activeEpisode = useMemo(() => detail?.episodes.find(item => item.season === season && item.episode === episode), [detail, season, episode])
  const episodesForSeason = useMemo(() => detail?.episodes.filter(item => item.season === season) || [], [detail, season])

  const loadList = useCallback(async (targetPage = page, targetLimit = limit) => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    const params = new URLSearchParams({ action: "list", q: submittedQuery.trim(), category, type, page: String(targetPage), limit: String(targetLimit) })
    const cacheKey = params.toString()
    const cached = listCache.get(cacheKey)||cachedCatalogue<Listing>(cacheKey)
    if (cached) setListing(cached)
    if(!navigator.onLine){
      setLoading(false)
      setError(cached?"You’re offline. Showing recent catalogue results; playback and downloads need a connection.":"You’re offline. Reconnect to load the catalogue.")
      return
    }
    setLoading(true)
    setError("")
    const timeout = window.setTimeout(() => controller.abort(), 20000)
    try {
      const response = await fetch(`/api/library?${params}`, { signal: controller.signal, cache: "no-store" })
      const data = await readApiJson(response)
      if(controller.signal.aborted||controllerRef.current!==controller)return
      if (!response.ok || data.success === false) throw new Error(data.error || data.message || "The library could not be loaded.")
      const next: Listing = { items: data.items || [], page: data.page || targetPage, limit: data.limit || targetLimit, hasNext: Boolean(data.hasNext), categories: data.categories || categoriesFallback, message: data.message }
      listCache.set(cacheKey, next)
      if(listCache.size>12)listCache.delete(listCache.keys().next().value!)
      rememberCatalogue(cacheKey,next)
      setListing(next)
    } catch (cause) {
      if (controllerRef.current === controller) {
        if (controller.signal.aborted) setError("This is taking longer than expected. Check your connection and try again.")
        else setError((cause instanceof Error ? cause.message : "The library could not be loaded.")+(cached?" Showing recent catalogue results.":""))
      }
    } finally {
      window.clearTimeout(timeout)
      if (controllerRef.current === controller) setLoading(false)
    }
  }, [category, limit, page, submittedQuery, type])

  useEffect(() => { void loadList(page, limit); return () => controllerRef.current?.abort() }, [loadList, page, limit])
  useEffect(()=>{
    const retry=()=>{void loadList(page,limit)}
    window.addEventListener("online",retry)
    return()=>window.removeEventListener("online",retry)
  },[loadList,page,limit])
  useEffect(() => () => { detailController.current?.abort(); streamController.current?.abort() }, [])

  const openItem = async (item: LibraryItem) => {
    if(!navigator.onLine){setError("Reconnect to open this title. Streaming and downloads require a connection.");return}
    detailController.current?.abort()
    streamController.current?.abort()
    const controller = new AbortController()
    detailController.current = controller
    const timeout = window.setTimeout(() => controller.abort(), 20000)
    setSelected(item)
    setActiveKey(item.key)
    setDetail(null)
    setStream(null)
    setStreamError("")
    setDetailLoading(true)
    setSeason(1)
    setEpisode(1)
    try {
      const resolved=await titleDetails(item)
      if(controller.signal.aborted)return
      setDetail(resolved)
      setSelected(resolved.item)
      setActiveKey(resolved.item.key)
      if (resolved.seasons.length) setSeason(resolved.seasons[0].season)
      if (resolved.episodes.length) setEpisode(resolved.episodes[0].episode)
    } catch (cause) {
      if (detailController.current === controller) setStreamError(controller.signal.aborted ? "Title details took too long. Retry this title." : cause instanceof Error ? cause.message : "Title details are unavailable.")
    } finally { window.clearTimeout(timeout); if (detailController.current === controller) setDetailLoading(false) }
  }

  useEffect(()=>{if(selected&&detail&&!detailLoading&&!isSeries)void playItem()},[selected?.key,detailLoading])
  const playItem = async (audioKey?: string, nextRetry = 0, requestedEpisode?: Episode) => {
    if (!selected) return
    if(!navigator.onLine){setStreamError("You’re offline. Reconnect to prepare playback and downloads.");return}
    streamController.current?.abort()
    const controller = new AbortController()
    streamController.current = controller
    const timeout = window.setTimeout(() => controller.abort(), 24000)
    setStreamLoading(true)
    setStreamError("")
    setRetry(nextRetry)
    const key = audioKey || activeKey || selected.key
    const params = new URLSearchParams({ action: "stream", key, season: isSeries ? String(requestedEpisode?.season || season) : "0", episode: isSeries ? String(requestedEpisode?.episode || episode) : "0", retry: String(nextRetry) })
    const chapter = requestedEpisode || activeEpisode
    if (chapter?.id) params.set("chapter", chapter.id)
    try {
      const response = await fetch(`/api/library?${params}`, { cache: "no-store", signal: controller.signal })
      setStreamPreparing(response.status===425)
      const data = await readApiJson(response)
      if(controller.signal.aborted||streamController.current!==controller)return
      if (!response.ok || data.success === false) throw new Error(data.error || data.message || "No playable source was returned.")
      const result: Stream = { sources: data.sources || [], subtitles: data.subtitles || [], message: data.message }
      setStream(result)
      if (!result.sources.length) setStreamError(result.message || "No playable source is available for this selection.")
    } catch (cause) {
      if (streamController.current === controller) {
        setStream(null)
        setStreamError(controller.signal.aborted ? "The alternate connections took too long. Please retry." : cause instanceof Error ? cause.message : "Playback could not be prepared.")
      }
    } finally { window.clearTimeout(timeout); if (streamController.current === controller) setStreamLoading(false) }
  }
  const goBack = () => { detailController.current?.abort(); detailController.current=null; streamController.current?.abort(); streamController.current=null; setSelected(null); setDetail(null); setStream(null); setStreamError(""); setActiveKey("");setStreamLoading(false);setDetailLoading(false) }
  const shownItems = listing?.items || []

  return <section className="space-y-4 min-w-0">
    {!selected ? <>
      <div className="liquid-surface rounded-2xl p-3 sm:p-4 space-y-3">
        <form className="flex gap-2 min-w-0" onSubmit={event => { event.preventDefault(); if(query.trim()===submittedQuery){void loadList(1,limit)}else{setSubmittedQuery(query.trim());setPage(1)} }}>
          <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search movies and series" aria-label="Search movies and series" className="pl-9 bg-card/70" /></div>
          <Button type="submit" aria-label="Search" aria-busy={loading} className="shrink-0"><Search className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Search</span></Button>
        </form>
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Categories">
          {(listing?.categories?.length ? listing.categories : categoriesFallback).map(item => <button key={item.id} aria-pressed={category===item.id} onClick={() => { if(category!==item.id){setLoading(true);setCategory(item.id);setPage(1)} }} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${category === item.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card/55 hover:border-primary/50"}`}>{item.label}</button>)}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1.5" aria-label="Content type">
            {[["all", "All"], ["movie", "Movies"], ["series", "Series"], ["anime", "Anime"]].map(([key, label]) => <button key={key} aria-pressed={type===key} onClick={() => { if(type!==key){setLoading(true);setType(key);setPage(1)} }} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${type === key ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"}`}>{label}</button>)}
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">Show
            <select value={limit} onChange={event => { setLoading(true); setLimit(Number(event.target.value)); setPage(1) }} className="h-9 rounded-lg border border-border bg-card px-2 text-foreground" aria-label="Items per page">
              {[12, 24, 36].map(value => <option key={value} value={value}>{value}</option>)}
            </select>
            <span>per page</span>
          </label>
        </div>
      </div>
      {error && <div role="alert" className="glass rounded-xl p-3 flex items-center gap-3 text-sm"><AlertCircle className="h-5 w-5 shrink-0 text-primary" /><span className="flex-1">{error}</span><Button size="sm" variant="outline" onClick={() => void loadList(page, limit)}><RotateCw className="mr-1 h-4 w-4" />Retry</Button></div>}
      {loading && shownItems.length === 0 ? <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4" aria-label="Loading titles">{Array.from({ length: limit > 12 ? 12 : 8 }, (_, index) => <div className="space-y-2" key={index}><div className="skeleton aspect-[2/3] rounded-xl" /><div className="skeleton h-4 w-3/4 rounded" /></div>)}</div> : shownItems.length ? <>
        <div className={`grid grid-cols-2 ${compact ? "sm:grid-cols-3 lg:grid-cols-4" : "sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"} gap-x-3 gap-y-5 sm:gap-4`}>
          {shownItems.map(item => <button key={item.key} aria-label={`Open ${item.title}`} onPointerEnter={()=>{void titleDetails(item).catch(()=>{})}} onFocus={()=>{void titleDetails(item).catch(()=>{})}} onClick={() => void openItem(item)} className="group min-w-0 text-left focus-visible:rounded-xl">
            <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-border/70 bg-muted/70 shadow-sm">
              {item.poster ? <img src={item.poster} alt="" loading="lazy" onError={event=>{event.currentTarget.style.opacity="0"}} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.035]" /> : <div className="grid h-full place-items-center"><Film className="h-8 w-8 text-muted-foreground" /></div>}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#171a20]/95 via-[#171a20]/40 to-transparent px-2.5 pb-2.5 pt-8 text-left text-white">
                <span className="block line-clamp-2 text-sm font-semibold leading-tight">{item.title}</span>
                <span className="mt-1 block text-[11px] text-white/70">{[item.year, typeLabel(item.type)].filter(Boolean).join(" · ")}</span>
              </div>
              <span className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-background/85 text-primary opacity-0 backdrop-blur transition-opacity group-hover:opacity-100"><Play className="h-4 w-4" /></span>
            </div>
          </button>)}
        </div>
        <div className="flex items-center justify-between gap-2 rounded-xl border border-border/70 bg-card/40 p-2">
          <Button aria-label="Previous page" variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => { setLoading(true); setPage(current => Math.max(1, current - 1)) }}><ArrowLeft className="mr-1 h-4 w-4" /><span className="hidden sm:inline">Previous</span></Button>
          <span className="text-xs text-muted-foreground">Page {listing?.page || page}</span>
          <Button aria-label="Next page" variant="outline" size="sm" disabled={!listing?.hasNext || loading} onClick={() => { setLoading(true); setPage(current => current + 1) }}><span className="hidden sm:inline">Next</span><ArrowRight className="ml-1 h-4 w-4" /></Button>
        </div>
      </> : !loading && <div className="glass-card rounded-2xl px-5 py-10 text-center"><Film className="mx-auto h-8 w-8 text-primary" /><h3 className="mt-3 font-display text-2xl">No titles in this view</h3><p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">{listing?.message || "Try another search or category."}</p></div>}
    </> : <div className="glass-card min-w-0 rounded-2xl p-3 sm:p-5 space-y-4">
      <Button variant="ghost" size="sm" onClick={goBack}><ArrowLeft className="mr-2 h-4 w-4" />Back to movies &amp; series</Button>
      <div className="grid grid-cols-[88px_minmax(0,1fr)] sm:grid-cols-[150px_minmax(0,1fr)] gap-3 sm:gap-5">
        <div className="aspect-[2/3] overflow-hidden rounded-xl bg-muted">{selected.poster ? <img src={selected.poster} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center"><Film className="h-8 w-8" /></div>}</div>
        <div className="min-w-0 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">{typeLabel(selected.type)}{selected.year ? ` · ${selected.year}` : ""}</p>
          <h2 className="font-display text-xl leading-tight sm:text-3xl">{selected.title}</h2>
          {selected.rating != null && <p className="text-xs text-muted-foreground">Rating {selected.rating}</p>}
          <p className="line-clamp-5 text-xs leading-relaxed text-muted-foreground sm:text-sm">{selected.description || "A description is not available for this title."}</p>
          {selected.genres?.length ? <p className="text-[11px] text-muted-foreground">{selected.genres.join(" · ")}</p> : null}
        </div>
      </div>
      {detailLoading && <div className="space-y-2" aria-label="Loading title details"><div className="skeleton h-10 w-full rounded-xl" /><div className="skeleton h-24 w-full rounded-xl" /></div>}
      {!detailLoading && detail && <>
        {detail.message && <p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">{detail.message}</p>}
        {isSeries && detail.seasons.length > 0 && <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-sm font-medium">Season
              <select aria-label="Season" value={season} onChange={event => { streamController.current?.abort();setStreamLoading(false);setStreamError("");setSeason(Number(event.target.value)); const first = detail.episodes.find(ep => ep.season === Number(event.target.value)); setEpisode(first?.episode || 1); setStream(null) }} className="h-10 max-w-[180px] rounded-lg border border-border bg-card px-3">
                {detail.seasons.map(item => <option key={item.season} value={item.season}>Season {item.season} · {item.episode_count} episodes</option>)}
              </select>
            </label>
            <span className="text-xs text-muted-foreground">{episodesForSeason.length} of {detail.seasons.find(item => item.season === season)?.episode_count ?? 0} listed</span>
          </div>
          {episodesForSeason.length ? <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-border/70 p-1.5">
            {episodesForSeason.map(item => <button key={item.id} disabled={item.locked} onClick={() => { setEpisode(item.episode); setStream(null); void playItem(undefined, 0, item) }} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-muted/70 disabled:cursor-not-allowed disabled:opacity-50 ${episode === item.episode ? "bg-primary/10 text-primary" : ""}`}><Play className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1 truncate">{item.title || `Episode ${item.episode}`}</span><span className="text-xs text-muted-foreground">Ep {item.episode}</span></button>)}
          </div> : <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">Episode metadata is not available for this season.</p>}
        </section>}
        {isSeries && !detail.seasons.length && <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">Season and episode information is not available for this title.</p>}
        {detail.audioTracks.length > 0 && <div className="flex flex-wrap items-center gap-2"><Headphones className="h-4 w-4 text-primary" /><span className="text-sm font-medium">Audio editions</span>{detail.audioTracks.map(track => <Button key={track.key} size="sm" variant={activeKey === track.key ? "secondary" : "outline"} onClick={() => { setActiveKey(track.key); void playItem(track.key) }}>{track.title}</Button>)}</div>}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void playItem(undefined, 0)} disabled={streamLoading || (isSeries && !detail.seasons.length)}><Play className="mr-2 h-4 w-4" />{streamLoading ? "Finding a source…" : isSeries ? "Play selected episode" : "Play movie"}</Button>
          {stream && <Button variant="outline" disabled={streamLoading} onClick={() => void playItem(undefined, retry + 1)}><RotateCw className="mr-2 h-4 w-4" />Try another source</Button>}
        </div>
      </>}
      {streamError && <div role="alert" className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/25 bg-primary/5 p-3 text-sm"><AlertCircle className="h-4 w-4 shrink-0 text-primary" /><span className="flex-1">{streamError}</span><Button size="sm" variant="outline" disabled={streamLoading||detailLoading} onClick={() => detail?void playItem(undefined, streamPreparing?retry:retry + 1):void openItem(selected)}>{streamPreparing?"Check progress":"Retry"}</Button></div>}
      {stream?.sources?.length ? <section className="space-y-3 border-t border-border/70 pt-4">
        <h3 className="font-display text-lg">Playback</h3>
        <MediaPlayback key={`${stream.sources[0].url}-${retry}`} src={stream.sources[0].url} title={selected.title} subtitles={stream.subtitles} alternateSources={stream.sources.slice(1).map(source => ({ url: source.url, label: source.label, quality: source.quality }))} />
        <div className="flex flex-wrap gap-2">{stream.sources.filter(source => source.downloadUrl && !/\.m3u8(?:$|\?)/i.test(source.downloadUrl || "")).map((source, index) => <CheckedDownload key={`${source.downloadUrl}-${index}`} url={source.downloadUrl!} label={`Download ${source.label||source.quality||"file"}${source.format?` · ${source.format}`:""}`}/>)}</div>
        {stream.message && <p className="text-xs text-muted-foreground">{stream.message}</p>}
      </section> : null}
    </div>}
  </section>
}

"use client"

import { useEffect, useRef, useState } from "react"
import type { FormEvent } from "react"
import { AlertCircle, ArrowDownToLine, Headphones, Link2, LoaderCircle, Play, Search, Video } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MediaPlayback } from "@/components/media-playback"

type YouTubeItem = { id: string; title: string; thumbnail: string; duration: string; author: string; url: string }
type SearchResponse = { success: boolean; items?: YouTubeItem[]; error?: string }
type MediaResponse = { success: boolean; title?: string; downloadUrl?: string; playUrl?: string; format?: "mp3" | "mp4"; quality?: string; isPreview?: boolean; error?: string }
type ActivePlayback = { kind: "audio" | "video"; title: string; url: string }
type ReadyDownload = { title: string; url: string; format: string; quality?: string }

async function readResponse<T>(response: Response): Promise<T> {
  const body = await response.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    throw new Error("The media service returned an unreadable response. Please try again.")
  }
  if (!response.ok) {
    const message = parsed && typeof parsed === "object" && "error" in parsed && typeof parsed.error === "string"
      ? parsed.error
      : "The request could not be completed. Please try again."
    throw new Error(message)
  }
  return parsed as T
}

function isYouTubeLink(value: string) {
  try {
    const host = new URL(value).hostname.toLowerCase().replace(/^www\./, "")
    return host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be" || host === "music.youtube.com"
  } catch {
    return false
  }
}

export function YoutubeMediaTools() {
  const [query, setQuery] = useState("")
  const [items, setItems] = useState<YouTubeItem[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [working, setWorking] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [playback, setPlayback] = useState<ActivePlayback | null>(null)
  const [download, setDownload] = useState<ReadyDownload | null>(null)
  const searchController = useRef<AbortController | null>(null)
  const actionController = useRef<AbortController | null>(null)

  useEffect(() => () => {
    searchController.current?.abort()
    actionController.current?.abort()
  }, [])

  const runSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = query.trim()
    if (!value) return
    searchController.current?.abort()
    actionController.current?.abort()
    const controller = new AbortController()
    searchController.current = controller
    const timeout = window.setTimeout(() => controller.abort(), 18000)
    setSearching(true)
    setWorking(null)
    setError("")
    setNotice("")
    setItems([])
    setSelected(null)
    setPlayback(null)
    setDownload(null)
    try {
      const params = new URLSearchParams({ action: "search", query: value })
      const response = await fetch(`/api/youtube?${params}`, { cache: "no-store", signal: controller.signal })
      const data = await readResponse<SearchResponse>(response)
      if (!data.success) throw new Error(data.error || "No YouTube results were found.")
      const results = Array.isArray(data.items) ? data.items : []
      setItems(results)
      setSelected(results[0]?.id ?? null)
      if (!results.length) setNotice("No matches found. Try a different title or paste a YouTube link.")
    } catch (reason) {
      if (controller.signal.aborted) setError("Search cancelled or timed out. Please try again.")
      else setError(reason instanceof Error ? reason.message : "Could not search YouTube. Please try again.")
    } finally {
      window.clearTimeout(timeout)
      if (searchController.current === controller) {
        searchController.current = null
        setSearching(false)
      }
    }
  }

  const resolve = async (item: YouTubeItem, mode: "audio" | "video" | "download-audio" | "download-video") => {
    actionController.current?.abort()
    const controller = new AbortController()
    actionController.current = controller
    const timeout = window.setTimeout(() => controller.abort(), 30000)
    const isVideo = mode === "video" || mode === "download-video"
    const isDownload = mode.startsWith("download")
    setWorking(mode)
    setError("")
    setNotice("")
    setDownload(null)
    try {
      const params = new URLSearchParams({
        action: "download",
        url: item.url,
        format: isVideo ? "mp4" : "mp3",
        quality: "720p",
      })
      const response = await fetch(`/api/youtube?${params}`, { cache: "no-store", signal: controller.signal })
      const data = await readResponse<MediaResponse>(response)
      if (!data.success) throw new Error(data.error || "The media service could not prepare this item.")
      if (data.isPreview) throw new Error("A preview is not available for full playback. Choose another result.")
      if (isDownload) {
        if (!data.downloadUrl) throw new Error("A download link was not returned. Please retry.")
        setDownload({ title: data.title || item.title, url: data.downloadUrl, format: isVideo ? "MP4 video" : "MP3 audio", quality: isVideo ? data.quality || "720p" : undefined })
        setPlayback(null)
        return
      }
      if (!data.playUrl) throw new Error("A playback link was not returned. Please retry.")
      setPlayback({ kind: isVideo ? "video" : "audio", title: data.title || item.title, url: data.playUrl })
      setDownload(null)
    } catch (reason) {
      if (controller.signal.aborted) setError("The request was cancelled or took too long. Please try again.")
      else setError(reason instanceof Error ? reason.message : "Could not prepare this media. Please try again.")
    } finally {
      window.clearTimeout(timeout)
      if (actionController.current === controller) {
        actionController.current = null
        setWorking(null)
      }
    }
  }

  const cancel = () => {
    searchController.current?.abort()
    actionController.current?.abort()
  }

  const activeItem = items.find(item => item.id === selected)

  return <section className="glass-card rounded-3xl p-5 md:p-7 space-y-6" aria-label="YouTube media tools">
    <div>
      <p className="text-sm font-semibold">Search YouTube or paste a video link</p>
      <p className="text-sm text-muted-foreground mt-1">Find a full track or video, then listen, watch, or download it.</p>
    </div>
    <form onSubmit={runSearch} className="space-y-3">
      <label htmlFor="youtube-query" className="sr-only">YouTube link or search terms</label>
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
          <Input id="youtube-query" value={query} onChange={event => setQuery(event.target.value)} placeholder="Track, artist, or https://youtu.be/…" className="pl-10 h-12 bg-card/70" />
        </div>
        <Button type="submit" disabled={!query.trim() || searching} className="h-12 px-5">
          {searching ? <><LoaderCircle className="h-4 w-4 mr-2 animate-spin"/>Searching…</> : <><Search className="h-4 w-4 mr-2"/>Search</>}
        </Button>
        {(searching || working) && <Button type="button" variant="outline" className="h-12" onClick={cancel}>Cancel</Button>}
      </div>
      <p className="text-xs text-muted-foreground">{isYouTubeLink(query.trim()) ? "YouTube link detected — searching that video now." : "Paste a YouTube URL or search by keywords. No mode switch needed."}</p>
    </form>
    {searching && <div role="status" className="space-y-3"><div className="skeleton h-20 rounded-2xl"/><div className="skeleton h-20 rounded-2xl"/><span className="sr-only">Searching YouTube</span></div>}
    {error && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex gap-3 text-sm"><AlertCircle className="h-5 w-5 text-destructive shrink-0"/><span>{error}</span></div>}
    {notice && <p role="status" className="rounded-xl border border-border/70 bg-card/55 p-4 text-sm text-muted-foreground">{notice}</p>}
    {!searching && items.length > 0 && <div className="space-y-3">
      <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">Search results</h2><span className="text-xs text-muted-foreground">{items.length} found</span></div>
      <div className="max-h-[30rem] overflow-y-auto space-y-2 pr-1">
        {items.map(item => <button key={item.id} type="button" onClick={() => { setSelected(item.id); setPlayback(null); setDownload(null); setError("") }} aria-pressed={selected === item.id}
          className={`w-full text-left flex gap-3 items-center rounded-2xl border p-3 transition-colors ${selected === item.id ? "border-primary/60 bg-primary/5" : "border-border/70 bg-card/45 hover:bg-card/75"}`}>
          {item.thumbnail ? <img src={item.thumbnail} alt="" loading="lazy" className="h-16 w-24 sm:h-[4.5rem] sm:w-32 rounded-xl object-cover bg-muted shrink-0"/> : <div className="h-16 w-24 sm:h-[4.5rem] sm:w-32 rounded-xl bg-muted grid place-items-center shrink-0"><Video className="h-6 w-6 text-primary"/></div>}
          <span className="min-w-0 flex-1"><span className="block font-medium text-sm line-clamp-2">{item.title}</span><span className="mt-1 block text-xs text-muted-foreground truncate">{item.author}{item.duration ? ` · ${item.duration}` : ""}</span></span>
          {selected === item.id && <span className="text-[10px] uppercase tracking-wider text-primary font-bold">Selected</span>}
        </button>)}
      </div>
    </div>}
    {activeItem && <div className="rounded-2xl border border-border/70 bg-card/50 p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0"><p className="text-xs uppercase tracking-[.18em] text-primary font-semibold">Selected media</p><p className="font-semibold mt-1 line-clamp-2">{activeItem.title}</p></div>
        <span className="text-xs text-muted-foreground">{activeItem.duration}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Button type="button" variant="outline" disabled={!!working} onClick={() => resolve(activeItem, "audio")}><Headphones className="h-4 w-4 mr-2"/>Play full audio</Button>
        <Button type="button" variant="outline" disabled={!!working} onClick={() => resolve(activeItem, "video")}><Play className="h-4 w-4 mr-2"/>Watch video</Button>
        <Button type="button" disabled={!!working} onClick={() => resolve(activeItem, "download-audio")}><ArrowDownToLine className="h-4 w-4 mr-2"/>Download full audio</Button>
        <Button type="button" disabled={!!working} onClick={() => resolve(activeItem, "download-video")}><ArrowDownToLine className="h-4 w-4 mr-2"/>Download video · 720p</Button>
      </div>
      {working && <p role="status" className="text-xs text-muted-foreground">{working.startsWith("download") ? "Preparing your download…" : "Preparing full playback…"}</p>}
    </div>}
    {playback?.kind === "audio" && <div className="rounded-2xl border border-border/70 bg-card/55 p-4 space-y-3">
      <div className="flex items-center gap-3"><div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center"><Headphones className="h-5 w-5 text-primary"/></div><div className="min-w-0"><p className="text-xs uppercase tracking-wider text-primary font-semibold">Full audio</p><p className="font-medium text-sm truncate">{playback.title}</p></div></div>
      <audio key={playback.url} controls preload="metadata" className="w-full" aria-label={`Play full audio: ${playback.title}`} src={playback.url}>Your browser does not support audio playback.</audio>
    </div>}
    {playback?.kind === "video" && <div className="rounded-2xl border border-border/70 bg-card/55 p-4 space-y-3">
      <div className="flex items-center gap-3"><Video className="h-5 w-5 text-primary"/><p className="font-medium text-sm line-clamp-2">{playback.title}</p></div>
      <MediaPlayback key={playback.url} src={playback.url} title={playback.title}/>
    </div>}
    {download && <div role="status" className="rounded-2xl border border-primary/25 bg-primary/5 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1 min-w-0"><p className="font-semibold text-sm truncate">{download.title}</p><p className="text-xs text-muted-foreground mt-1">{download.format}{download.quality ? ` · ${download.quality}` : ""} · full media</p></div>
      <Button asChild className="shrink-0"><a href={download.url} download><ArrowDownToLine className="h-4 w-4 mr-2"/>Save file</a></Button>
    </div>}
  </section>
}

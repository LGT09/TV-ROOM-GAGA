"use client"

import { FormEvent, useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { AlertCircle, ArrowUpRight, Disc3, Download, LoaderCircle, Music2, Pause, Play, RotateCcw, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Track = {
  trackId: string | number
  trackName: string
  artistName: string
  previewUrl?: string
  isPreview?: boolean
  releaseDate?: string
  artworkUrl100?: string
  videoId?: string
}

type MusicResponse = {
  results?: Track[]
  success?: boolean
  audioUrl?: string
  downloadUrl?: string
  title?: string
  isPreview?: boolean
  error?: string
}

const trackKey = (track: Track) => String(track.trackId || `${track.trackName}-${track.artistName}`)
const isVideoLink = (value?: string) => !!value && /(?:youtube\.com|youtu\.be)/i.test(value)

async function requestJson<T>(url: string, controller: AbortController): Promise<T> {
  const timeout = window.setTimeout(() => controller.abort(), 12000)
  try {
    const response = await fetch(url, { signal: controller.signal, cache: "no-store" })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      const message = typeof body?.error === "string" ? body.error.trim() : ""
      throw new Error(message || "The music request couldn’t be completed.")
    }
    return body as T
  } finally {
    window.clearTimeout(timeout)
  }
}

export function HomeMusic() {
  const [tracks, setTracks] = useState<Track[]>([])
  const [query, setQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState("")
  const [actionError, setActionError] = useState<{ key: string; message: string } | null>(null)
  const [pendingPlay, setPendingPlay] = useState<string | null>(null)
  const [pendingDownload, setPendingDownload] = useState<string | null>(null)
  const [activeTrack, setActiveTrack] = useState<Track | null>(null)
  const [playingLabel, setPlayingLabel] = useState("")
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const listController = useRef<AbortController | null>(null)
  const actionControllers = useRef(new Set<AbortController>())
  const actionController = useRef<AbortController | null>(null)
  const sequence = useRef(0)
  const searchSequence = useRef(0)

  const loadTracks = useCallback(async (term = "") => {
    listController.current?.abort()
    const controller = new AbortController()
    listController.current = controller
    const version = ++searchSequence.current
    setError("")
    setActionError(null)
    if (term) setIsSearching(true)
    else setIsLoading(true)
    try {
      const url = term
        ? `/api/music?action=search&query=${encodeURIComponent(term)}`
        : "/api/music?action=trending"
      const data = await requestJson<MusicResponse>(url, controller)
      if (!controller.signal.aborted && version === searchSequence.current) {
        setTracks(Array.isArray(data.results) ? data.results.slice(0, 8) : [])
      }
    } catch (reason) {
      if (!controller.signal.aborted && version === searchSequence.current) {
        setError(reason instanceof Error ? reason.message : "Songs couldn’t load. Please try again.")
      }
    } finally {
      if (!controller.signal.aborted && version === searchSequence.current) {
        setIsLoading(false)
        setIsSearching(false)
      }
    }
  }, [])

  useEffect(() => {
    void loadTracks()
    return () => {
      listController.current?.abort()
      actionController.current?.abort()
      actionControllers.current.forEach(controller => controller.abort())
    }
  }, [loadTracks])

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const term = query.trim()
    if (term) void loadTracks(term)
  }

  const showTrending = () => {
    setQuery("")
    void loadTracks()
  }

  const playTrack = async (track: Track, full = false) => {
    const key = trackKey(track)
    const audio = audioRef.current
    if (!audio) return
    if (!full && activeTrack && trackKey(activeTrack) === key && !audio.paused) {
      audio.pause()
      setIsPlaying(false)
      return
    }
    actionController.current?.abort()
    const controller = new AbortController()
    actionController.current = controller
    const currentSequence = ++sequence.current
    setPendingPlay(key)
    setActionError(null)
    if (full) {
      audio.pause()
      setIsPlaying(false)
    }
    try {
      let source = track.previewUrl
      let preview = !!source && !isVideoLink(source)
      if (full || !source || isVideoLink(source)) {
        const inputUrl = source || (track.videoId ? `https://www.youtube.com/watch?v=${encodeURIComponent(track.videoId)}` : "")
        if (!inputUrl) throw new Error("There’s no playable audio for this song yet.")
        const params = new URLSearchParams({
          action: "get-audio",
          url: inputUrl,
          title: `${track.trackName} ${track.artistName}`,
          ...(full ? { full: "1" } : {}),
        })
        const data = await requestJson<MusicResponse>(`/api/music?${params}`, controller)
        if (controller.signal.aborted || currentSequence !== sequence.current) return
        if (!data.success || !data.audioUrl) throw new Error(data.error || "Playback isn’t available for this song right now.")
        source = data.audioUrl
        preview = data.isPreview ?? !!track.isPreview
      }
      if (controller.signal.aborted || currentSequence !== sequence.current) return
      if (!source) throw new Error("There’s no playable audio for this song yet.")
      audio.pause()
      audio.src = source
      audio.load()
      setActiveTrack(track)
      setPlayingLabel(preview ? "Preview" : "Full song")
      await audio.play()
      if (!controller.signal.aborted && currentSequence === sequence.current) setIsPlaying(true)
    } catch (reason) {
      if (!controller.signal.aborted && currentSequence === sequence.current) {
        setIsPlaying(false)
        setActionError({ key, message: reason instanceof Error ? reason.message : "Playback couldn’t start. Please try again." })
      }
    } finally {
      if (currentSequence === sequence.current) setPendingPlay(null)
    }
  }

  const downloadTrack = async (track: Track) => {
    const key = trackKey(track)
    const source = track.previewUrl || (track.videoId ? `https://www.youtube.com/watch?v=${encodeURIComponent(track.videoId)}` : "")
    if (!source) {
      setActionError({ key, message: "A full-song download isn’t available for this song." })
      return
    }
    const controller = new AbortController()
    actionControllers.current.add(controller)
    setPendingDownload(key)
    setActionError(null)
    try {
      const params = new URLSearchParams({ action: "download-mp3", url: source, title: `${track.trackName} ${track.artistName}` })
      const data = await requestJson<MusicResponse>(`/api/music?${params}`, controller)
      if (controller.signal.aborted) return
      if (!data.success || !data.downloadUrl) throw new Error(data.error || "A full-song download isn’t available for this song.")
      const link = document.createElement("a")
      link.href = data.downloadUrl
      link.download = `${(data.title || track.trackName).replace(/[\\/:*?"<>|]/g, "").trim() || "song"}.mp3`
      link.rel = "noopener"
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (reason) {
      if (!controller.signal.aborted) setActionError({ key, message: reason instanceof Error ? reason.message : "Download couldn’t start. Please try again." })
    } finally {
      actionControllers.current.delete(controller)
      setPendingDownload(current => current === key ? null : current)
    }
  }

  const searching = query.trim().length > 0

  return (
    <section aria-labelledby="home-music-heading" className="glass-card overflow-hidden rounded-[1.6rem] p-4 sm:p-6">
      <div className="pointer-events-none absolute -right-14 -top-20 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-primary sm:text-[11px]">
              <Music2 className="h-4 w-4" /> The listening room
            </p>
            <h2 id="home-music-heading" className="font-display text-2xl font-semibold sm:text-3xl">
              {searching ? "Find your next favorite" : "Trending songs"}
            </h2>
            <p className="mt-1 max-w-lg text-xs leading-relaxed text-muted-foreground sm:text-sm">
              {searching ? "Search songs and artists. Hear a preview right here." : "A little of what’s moving right now. Press play to hear a preview."}
            </p>
          </div>
          <Link href="/music" className="inline-flex min-h-9 items-center gap-1 self-start text-xs font-semibold text-primary transition-transform hover:translate-x-0.5 md:self-auto">
            Music for more results <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        <form onSubmit={submitSearch} className="mt-5 flex gap-2" role="search">
          <div className="relative min-w-0 flex-1">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search songs or artists"
              aria-label="Search songs or artists"
              className="h-11 rounded-xl border-border/70 bg-background/70 pl-9 text-sm"
            />
          </div>
          <Button type="submit" disabled={!query.trim() || isSearching} className="h-11 shrink-0 rounded-xl px-3 sm:px-4">
            {isSearching ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            <span className="ml-2 hidden sm:inline">{isSearching ? "Searching" : "Search"}</span>
          </Button>
          {searching && (
            <Button type="button" variant="outline" onClick={showTrending} className="h-11 shrink-0 gap-1.5 rounded-xl px-3" aria-label="Reset to trending songs">
              <RotateCcw className="h-4 w-4" /><span className="hidden sm:inline">Trending</span>
            </Button>
          )}
        </form>

        <div className="mb-3 mt-5 flex min-h-6 items-center justify-between gap-3">
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">
            {searching ? "Search results" : "On the chart"} {tracks.length > 0 && !isLoading ? <span className="ml-1 tabular-nums">· {tracks.length}</span> : null}
          </p>
          {searching && !isSearching && <button type="button" onClick={showTrending} className="text-[11px] font-semibold text-primary hover:underline">Back to trending</button>}
        </div>

        {error ? (
          <div role="alert" className="flex flex-col items-start justify-between gap-3 rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 sm:flex-row sm:items-center">
            <p className="flex items-start gap-2 text-xs text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>
            <Button variant="outline" size="sm" onClick={() => void loadTracks(searching ? query.trim() : "")}>Try again</Button>
          </div>
        ) : isLoading || isSearching ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" aria-label="Loading songs" aria-busy="true">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="flex min-w-0 items-center gap-3 rounded-xl border border-border/50 bg-card/45 p-2.5">
                <div className="skeleton h-12 w-12 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1 space-y-2"><div className="skeleton h-3 w-3/4 rounded" /><div className="skeleton h-2.5 w-1/2 rounded" /></div>
                <div className="skeleton h-9 w-9 shrink-0 rounded-full" />
              </div>
            ))}
          </div>
        ) : tracks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/80 bg-background/35 px-5 py-8 text-center">
            <Disc3 className="mx-auto h-7 w-7 text-primary/75" />
            <h3 className="mt-2 font-display text-lg font-semibold">{searching ? "No songs found" : "The chart is quiet"}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{searching ? "Try a different song or artist." : "Trending songs will appear here when available."}</p>
            {searching && <Button variant="ghost" size="sm" onClick={showTrending} className="mt-2">Show trending</Button>}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {tracks.map((track, index) => {
              const key = trackKey(track)
              const current = !!activeTrack && trackKey(activeTrack) === key
              return (
                <article key={key} className={`group min-w-0 rounded-xl border p-2.5 transition-[transform,border-color,background-color] duration-200 hover:-translate-y-0.5 ${current ? "border-primary/35 bg-primary/[.055]" : "border-border/60 bg-card/55 hover:border-primary/20 hover:bg-card/85"}`}>
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="w-4 shrink-0 text-center font-mono text-[10px] tabular-nums text-muted-foreground/70">{String(index + 1).padStart(2, "0")}</span>
                    <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted/70 ring-1 ring-border/50">
                      {track.artworkUrl100 ? <img src={track.artworkUrl100} alt="" loading="lazy" className="h-full w-full object-cover" /> : <Disc3 className="h-5 w-5 text-primary/55" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-[13px] font-semibold leading-tight">{track.trackName}</h3>
                      <p className="mt-1 truncate text-[11px] text-muted-foreground">{track.artistName}</p>
                      <span className="mt-1 inline-flex rounded-full bg-secondary/55 px-1.5 py-0.5 text-[9px] font-semibold text-secondary-foreground">{track.isPreview === false ? "Song" : "Preview"}</span>
                    </div>
                    <Button type="button" variant={current && isPlaying ? "default" : "outline"} onClick={() => void playTrack(track)} disabled={pendingPlay === key} className="h-9 w-9 shrink-0 rounded-full p-0" aria-label={`${current && isPlaying ? "Pause" : "Play preview"} ${track.trackName}`}>
                      {pendingPlay === key ? <LoaderCircle className="h-4 w-4 animate-spin" /> : current && isPlaying ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
                    </Button>
                  </div>
                  <div className="mt-1 flex min-h-7 items-center justify-between pl-[1.35rem]">
                    {track.isPreview !== false ? <span className="text-[9px] text-muted-foreground">Apple preview · ~30 sec</span> : <span className="text-[9px] text-muted-foreground">Search result audio</span>}
                    <div className="flex items-center gap-0.5">
                      <button type="button" onClick={() => void playTrack(track, true)} disabled={pendingPlay === key} className="rounded-md px-1.5 py-1 text-[10px] font-semibold text-primary transition-colors hover:bg-primary/10 disabled:opacity-50">Full song</button>
                      <button type="button" onClick={() => void downloadTrack(track)} disabled={pendingDownload !== null} aria-label={`Download full song ${track.trackName}`} title="Download full song" className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-50">
                        {pendingDownload === key ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                  {actionError?.key === key && <p role="alert" className="mt-1 flex items-start gap-1.5 pl-[1.35rem] text-[10px] leading-snug text-destructive"><AlertCircle className="mt-px h-3 w-3 shrink-0" />{actionError.message}</p>}
                </article>
              )
            })}
          </div>
        )}

        <div className={`mt-4 rounded-xl border border-primary/15 bg-background/65 p-3 transition-all duration-300 ${activeTrack ? "shadow-[0_10px_30px_hsl(var(--primary)/.10)]" : ""}`} aria-label="TV ROOM GAGA music player">
          <div className="flex min-w-0 items-center gap-3">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-card">
              <img src="/tvroom-logo.png" alt="TV ROOM GAGA" className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-bold uppercase tracking-[.18em] text-primary">TV ROOM GAGA · {activeTrack ? playingLabel || "Ready" : "Listening room"}</p>
              <p className="mt-0.5 truncate text-xs font-semibold">{activeTrack?.trackName || "Pick a song to play"}</p>
              <p className="truncate text-[10px] text-muted-foreground">{activeTrack?.artistName || "Trending music, close at hand"}</p>
            </div>
            {activeTrack && (
              <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 rounded-full" onClick={() => {
                const audio = audioRef.current
                if (!audio) return
                if (audio.paused) void audio.play().then(() => setIsPlaying(true)).catch(() => setActionError({ key: trackKey(activeTrack), message: "Playback couldn’t resume. Please try again." }))
                else { audio.pause(); setIsPlaying(false) }
              }} aria-label={isPlaying ? "Pause playback" : "Resume playback"}>
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
              </Button>
            )}
          </div>
          <audio ref={audioRef} controls className="mt-2 h-8 w-full accent-primary" onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onError={() => {
            if (activeTrack) setActionError({ key: trackKey(activeTrack), message: "This audio couldn’t be played. Try another song." })
            setIsPlaying(false)
          }} />
        </div>
      </div>
    </section>
  )
}

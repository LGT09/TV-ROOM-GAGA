"use client"

import { FormEvent, useCallback, useEffect, useRef, useState } from "react"
import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SongDownload } from "@/components/song-download"
import {
  AlertCircle,
  Disc3,
  Download,
  LoaderCircle,
  Music2,
  Pause,
  Play,
  RefreshCw,
  Search,
  X,
} from "lucide-react"

type Track = {
  trackId: string | number
  trackName: string
  artistName: string
  artworkUrl100?: string
  previewUrl?: string
  trackTimeMillis?: number
  releaseDate?: string
  primaryGenreName?: string
  audioUrl?: string
  downloadUrl?: string
  videoId?: string
  isPreview?: boolean
}

type MusicResponse = { results?: Track[]; message?: string }

function trackKey(track: Track) {
  return String(track.trackId || `${track.trackName}-${track.artistName}`)
}

function isVideoLink(value?: string) {
  return !!value && /(?:youtube\.com|youtu\.be)/i.test(value)
}

function isApplePreviewLink(value?: string) {
  return !!value && /(?:itunes\.apple\.com|mzstatic\.com)/i.test(value)
}

function formatDuration(milliseconds?: number) {
  if (!milliseconds || !Number.isFinite(milliseconds) || milliseconds <= 0) return null
  const seconds = Math.floor(milliseconds / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}

function formatReleaseDate(value?: string) {
  if (!value) return null
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return null
  return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" }).format(date)
}

export default function MusicPage() {
  const [tracks, setTracks] = useState<Track[]>([])
  const [searchResults, setSearchResults] = useState<Track[] | null>(null)
  const [query, setQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState("")
  const [chartMessage, setChartMessage] = useState("")
  const [playPendingKey, setPlayPendingKey] = useState<string | null>(null)
  const [downloadSong,setDownloadSong]=useState<Track|null>(null)
  const [actionError, setActionError] = useState<{ key: string; message: string } | null>(null)
  const [activeTrack, setActiveTrack] = useState<Track | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playingLabel, setPlayingLabel] = useState("")
  const audioRef = useRef<HTMLAudioElement>(null)
  const latestController = useRef<AbortController | null>(null)
  const searchController = useRef<AbortController | null>(null)
  const controllers = useRef<Set<AbortController>>(new Set())
  const searchVersion = useRef(0)
  const playController = useRef<AbortController | null>(null)
  const playSequence = useRef(0)
  const activeTracks = searchResults ?? tracks

  const requestJson = useCallback(async <T,>(url: string, controller: AbortController): Promise<T> => {
    controllers.current.add(controller)
    const timeout = setTimeout(() => controller.abort(), 12000)
    try {
      const response = await fetch(url, { method: "GET", signal: controller.signal, cache: "no-store" })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        const backendError = typeof body?.error === "string" ? body.error.trim() : ""
        throw new Error(backendError || "The request could not be completed.")
      }
      return body as T
    } finally {
      clearTimeout(timeout)
      controllers.current.delete(controller)
    }
  }, [])

  const loadLatest = useCallback(async (quiet = false) => {
    latestController.current?.abort()
    const controller = new AbortController()
    latestController.current = controller
    if (!quiet) setIsLoading(true)
    setError("")
    try {
      const data = await requestJson<MusicResponse>("/api/music?action=latest", controller)
      if (!controller.signal.aborted) {
        setTracks(Array.isArray(data.results) ? data.results : [])
        setChartMessage(data.message || "")
      }
    } catch (reason) {
      if (!controller.signal.aborted) {
        setError(reason instanceof Error ? reason.message : "Latest releases couldn’t load. Check your connection and try again.")
      }
    } finally {
      if (!controller.signal.aborted && latestController.current === controller) setIsLoading(false)
    }
  }, [requestJson])

  useEffect(() => {
    void loadLatest()
    return () => {
      controllers.current.forEach(controller => controller.abort())
    }
  }, [loadLatest])

  const search = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await runSearch(query)
  }

  const runSearch = async (rawQuery: string) => {
    const term = rawQuery.trim()
    if (!term) return
    searchController.current?.abort()
    const controller = new AbortController()
    searchController.current = controller
    const version = ++searchVersion.current
    setIsSearching(true)
    setError("")
    setActionError(null)
    try {
      const data = await requestJson<MusicResponse>(`/api/music?action=search&query=${encodeURIComponent(term)}`, controller)
      if (!controller.signal.aborted && version === searchVersion.current) {
        setSearchResults(Array.isArray(data.results) ? data.results : [])
      }
    } catch (reason) {
      if (!controller.signal.aborted && version === searchVersion.current) {
        setError(reason instanceof Error ? reason.message : "Search couldn’t finish. Your current releases are still here—please try again.")
      }
    } finally {
      if (!controller.signal.aborted && version === searchVersion.current) setIsSearching(false)
    }
  }

  const clearSearch = () => {
    searchController.current?.abort()
    searchVersion.current += 1
    setSearchResults(null)
    setIsSearching(false)
    setError("")
  }

  const startPlayback = async (track: Track, fullSong=true) => {
    const key = trackKey(track)
    const audio = audioRef.current
    if (!audio) return
    playController.current?.abort()
    const controller = new AbortController()
    playController.current = controller
    const sequence = ++playSequence.current
    if (activeTrack && trackKey(activeTrack) === key && !audio.paused) {
      audio.pause()
      setIsPlaying(false)
      setPlayPendingKey(null)
      return
    }

    setPlayPendingKey(key)
    if(fullSong){audio.pause();setIsPlaying(false)}
    setActionError(null)
    try {
      let source = track.previewUrl
      let preview = !!source && !isVideoLink(source)
      if ((fullSong || !source || isVideoLink(source)) && (source || track.videoId || track.audioUrl)) {
        const videoUrl = source || (track.videoId ? `https://www.youtube.com/watch?v=${encodeURIComponent(track.videoId)}` : track.audioUrl)
        if (videoUrl && (fullSong || isVideoLink(videoUrl))) {
          const params = new URLSearchParams({
            action: "get-audio",
            url: videoUrl,
            title: `${track.trackName} - ${track.artistName}`,
            full:fullSong?"1":"0",
          })
          const data = await requestJson<{ success?: boolean; audioUrl?: string; isPreview?: boolean }>(
            `/api/music?${params.toString()}`, controller,
          )
          if (controller.signal.aborted || sequence !== playSequence.current) return
          if (!data.success || !data.audioUrl) throw new Error("Playback isn’t available for this track right now.")
          source = data.audioUrl
          preview = data.isPreview ?? !!track.isPreview
        } else if (track.audioUrl) {
          source = track.audioUrl
          preview = !!track.isPreview
        }
      }
      if (controller.signal.aborted || sequence !== playSequence.current) return
      if (!source) throw new Error("There’s no playable audio for this track yet.")
      audio.pause()
      audio.src = source
      audio.load()
      setActiveTrack(track)
      setPlayingLabel(preview ? "Preview" : "Now playing")
      await audio.play()
      if (!controller.signal.aborted && sequence === playSequence.current) setIsPlaying(true)
    } catch (reason) {
      if (!controller.signal.aborted && sequence === playSequence.current) {
        setIsPlaying(false)
        setActionError({
          key,
          message: reason instanceof Error ? reason.message : "Playback couldn’t start. Please try again.",
        })
      }
    } finally {
      if (sequence === playSequence.current) {
        setPlayPendingKey(null)
        if (playController.current === controller) playController.current = null
      }
    }
  }

  const downloadTrack = async (track: Track) => {
    setDownloadSong(track)
  }

  return (
    <AppLayout>
      <main className="mx-auto w-full max-w-6xl space-y-8 px-4 pb-36 pt-20 md:px-8 md:pt-10">
        <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.2em] text-primary">
              <Music2 className="h-4 w-4" /> The listening room
            </p>
            <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Music</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Find a new favorite, play the full song, and download it when available.
            </p>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-border/70 bg-card/70 px-3 py-2 text-xs text-muted-foreground sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" /> No account needed
          </div>
        </header>

        <section className="glass-card rounded-2xl p-4 sm:p-5" aria-label="Search releases">
          <form onSubmit={search} className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search songs or artists"
                aria-label="Search songs or artists"
                className="h-12 rounded-xl border-border/70 bg-background/65 pl-10"
              />
            </div>
            <Button type="submit" disabled={!query.trim() || isSearching} className="h-12 rounded-xl px-4">
              {isSearching ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span className="ml-2 hidden sm:inline">{isSearching ? "Searching" : "Search"}</span>
            </Button>
            {searchResults !== null && (
              <Button type="button" variant="ghost" onClick={clearSearch} className="h-12 rounded-xl px-3" aria-label="Clear search">
                <X className="h-4 w-4" />
              </Button>
            )}
          </form>
        </section>

        {error && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm" role="alert">
            <span className="flex items-center gap-2 text-destructive"><AlertCircle className="h-4 w-4 shrink-0" />{error}</span>
            <Button variant="ghost" size="sm" onClick={() => searchResults !== null ? void runSearch(query) : void loadLatest(true)}>
              Retry
            </Button>
          </div>
        )}

        <section aria-labelledby="release-heading">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-muted-foreground">
                {searchResults !== null ? "Your search" : "New music discovery"}
              </p>
              <h2 id="release-heading" className="mt-1 font-display text-xl font-semibold sm:text-2xl">
                {searchResults !== null ? "Search results" : "New music picks"}
              </h2>
              {searchResults === null && (
                <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                  <p>{chartMessage || "Discover new music. Release dates appear when supplied."}</p>
                  <p>Not a universal release feed.</p>
                </div>
              )}
            </div>
            {searchResults === null && (
              <Button variant="ghost" size="sm" onClick={() => void loadLatest(true)} disabled={isLoading} className="gap-2 rounded-lg">
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
            )}
          </div>

          {isLoading && tracks.length === 0 && searchResults === null ? (
            <div className="space-y-2" aria-label="Loading latest releases">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="flex animate-pulse items-center gap-4 rounded-2xl border border-border/50 bg-card/55 p-3">
                  <div className="h-14 w-14 shrink-0 rounded-xl bg-muted/70" />
                  <div className="min-w-0 flex-1 space-y-2"><div className="h-3 w-2/5 rounded bg-muted/70" /><div className="h-3 w-1/4 rounded bg-muted/60" /></div>
                  <div className="h-9 w-20 rounded-xl bg-muted/70" />
                </div>
              ))}
            </div>
          ) : activeTracks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/80 bg-card/45 px-6 py-12 text-center">
              <Disc3 className="mx-auto h-8 w-8 text-primary/75" />
              <h3 className="mt-4 font-display text-lg font-semibold">
                {searchResults !== null ? "No matches this time" : "The room is quiet"}
              </h3>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                {searchResults !== null ? "Try another song or artist name." : "Latest releases will appear here as soon as they’re available."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {activeTracks.map(track => {
                const key = trackKey(track)
                const duration = formatDuration(track.trackTimeMillis)
                const release = formatReleaseDate(track.releaseDate)
                const isCurrent = activeTrack !== null && trackKey(activeTrack) === key
                return (
                  <article key={key} className={`group rounded-2xl border p-3 transition-colors sm:p-3.5 ${isCurrent ? "border-primary/30 bg-primary/[.045]" : "border-border/60 bg-card/65 hover:bg-card/90"}`}>
                    <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted/70 ring-1 ring-border/50 sm:h-16 sm:w-16">
                        {track.artworkUrl100 ? (
                          <img src={track.artworkUrl100} alt="" loading="lazy" className="h-full w-full object-cover" />
                        ) : (
                          <div className="grid h-full w-full place-items-center text-primary/55"><Disc3 className="h-6 w-6" /></div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-semibold text-foreground sm:text-[15px]">{track.trackName}</h3>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground sm:text-sm">{track.artistName}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground sm:text-[11px]">
                          {track.primaryGenreName && <span className="truncate">{track.primaryGenreName}</span>}
                          {release && <><span aria-hidden="true">·</span><span>{release}</span></>}
                          {duration && <><span aria-hidden="true">·</span><span>{duration}</span></>}
                          {track.isPreview === true && <span className="rounded-full bg-secondary/80 px-2 py-0.5 text-secondary-foreground">Preview available</span>}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Button
                          type="button"
                          variant={isCurrent && isPlaying ? "default" : "outline"}
                          onClick={() => void startPlayback(track)}
                          aria-label={`${isCurrent && isPlaying ? "Pause" : "Play"} ${track.trackName}`}
                          className="h-10 rounded-xl px-3"
                        >
                          {playPendingKey === key ? <LoaderCircle className="h-4 w-4 animate-spin" /> : isCurrent && isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
                          <span className="ml-2 hidden text-xs sm:inline">{playPendingKey === key ? "Loading" : isCurrent && isPlaying ? "Pause" : "Play"}</span>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => void downloadTrack(track)}
                          disabled={!(track.videoId || track.downloadUrl || track.audioUrl || track.previewUrl)}
                          aria-label={`Download full song ${track.trackName}`}
                          title="Download full song"
                          className="h-10 w-10 rounded-xl p-0"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {track.isPreview&&<Button size="sm" variant="ghost" className="ml-[68px] mt-1 h-8 text-xs" disabled={playPendingKey===key} onClick={()=>void startPlayback(track,true)}>Play full song</Button>}
                    {actionError?.key === key && (
                      <p role="alert" className="mt-2 flex items-start gap-2 pl-[68px] text-xs text-destructive sm:pl-20">
                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{actionError.message}
                      </p>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <section className={`glass-card rounded-2xl p-4 sm:p-5 ${activeTrack?"fixed inset-x-3 bottom-3 z-40 mx-auto max-w-3xl shadow-2xl":""}`} aria-label="TV Room GAGA player">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-border/70 bg-card">
              <img src="/tvroom-logo.png" alt="TV Room GAGA" className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-bold uppercase tracking-[.2em] text-primary">TV ROOM GAGA · Now in the room</p>
              <p className="mt-1 truncate text-sm font-semibold">{activeTrack?.trackName || "Choose a release to listen"}</p>
              <p className="truncate text-xs text-muted-foreground">
                {activeTrack ? `${activeTrack.artistName}${playingLabel ? ` · ${playingLabel}` : ""}` : "Your music, right here"}
              </p>
            </div>
            {activeTrack && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  const audio = audioRef.current
                  if (!audio) return
                  if (audio.paused) void audio.play().then(() => setIsPlaying(true)).catch(() => setActionError({ key: trackKey(activeTrack), message: "Playback couldn’t resume. Please try again." }))
                  else { audio.pause(); setIsPlaying(false) }
                }}
                aria-label={isPlaying ? "Pause playback" : "Resume playback"}
                className="h-10 w-10 rounded-full"
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
              </Button>
            )}
          </div>
          <audio
            ref={audioRef}
            className="mt-3 h-8 w-full accent-primary"
            controls
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onError={() => {
              if (activeTrack) setActionError({ key: trackKey(activeTrack), message: "This audio could not be played. Try another release." })
              setIsPlaying(false)
            }}
          />
        </section>
      </main>
      {downloadSong&&<SongDownload song={downloadSong} onClose={()=>setDownloadSong(null)}/>}
    </AppLayout>
  )
}

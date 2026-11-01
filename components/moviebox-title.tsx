"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Copy, Film, LoaderCircle, Share2, Star } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { MediaPlayback } from "@/components/media-playback"
import { CheckedDownload } from "@/components/checked-download"
import { Button } from "@/components/ui/button"
import { readApiJson } from "@/lib/client-json"
import { formatFileSize } from "@/lib/media-info"

type Source = { quality: string; format: string; size: string | number; proxyStream: string; proxyDownload: string }
type MovieDetail = { subjectId: string; title: string; cover: string; genre: string; description: string; releaseDate: string; imdbRatingValue: string; detailPath: string }
type Subtitle = { language: string; label: string; url: string }

export function MovieBoxTitle({ subjectId, initialTitle = "Movie" }: { subjectId: string; initialTitle?: string }) {
  const [movie, setMovie] = useState<MovieDetail | null>(null)
  const [sources, setSources] = useState<Source[]>([])
  const [subtitles, setSubtitles] = useState<Subtitle[]>([])
  const [subtitle, setSubtitle] = useState("")
  const [selected, setSelected] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [shareMessage, setShareMessage] = useState("")

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    fetch(`/api/moviebox?action=detail&subjectId=${encodeURIComponent(subjectId)}`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const data = await readApiJson(response)
        if (!response.ok || data.success === false) throw new Error(data.error || "Movie details could not be loaded.")
        setMovie(data.subject)
        setSources(data.sources || [])
        setSubtitles(data.proxySubtitles || [])
      })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Movie details could not be loaded.") })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [subjectId])

  const share = async () => {
    const url = `${window.location.origin}/mv/${encodeURIComponent(subjectId)}`
    try {
      if (navigator.share) await navigator.share({ title: movie?.title || initialTitle, url })
      else { await navigator.clipboard.writeText(url); setShareMessage("Link copied.") }
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === "AbortError")) setShareMessage("Could not share. Copy this page URL from your browser.")
    }
  }
  const current = sources[selected] || sources[0]

  return <AppLayout><main className="page-shell space-y-5 py-5 pb-12 sm:py-8">
    <Link href="/movies" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Back to movies</Link>
    <section className="glass-card overflow-hidden rounded-3xl">
      <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="mx-auto w-full max-w-[220px] overflow-hidden rounded-2xl bg-muted"><div className="aspect-[2/3]">{movie?.cover && <img src={movie.cover} alt={`${movie.title} poster`} className="h-full w-full object-cover" />}</div></div>
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-primary">Movie details</p><h1 className="mt-1 font-display text-3xl sm:text-4xl">{movie?.title || initialTitle}</h1><div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground"><span>{movie?.releaseDate?.slice(0, 4)}</span>{movie?.genre && <span>{movie.genre}</span>}{movie?.imdbRatingValue && <span className="inline-flex items-center gap-1 text-amber-600"><Star className="h-4 w-4 fill-current" />{movie.imdbRatingValue}</span>}</div></div><Button variant="outline" onClick={() => void share()}><Share2 className="mr-2 h-4 w-4" />Share</Button></div>
          {shareMessage && <p role="status" className="text-xs text-muted-foreground">{shareMessage}</p>}
          {movie?.description && <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{movie.description}</p>}
          {loading && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" />Loading playback and download sources…</p>}
          {error && <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          {!loading && !sources.length && !error && <p role="status" className="rounded-xl bg-muted/70 p-3 text-sm text-muted-foreground">No playable or downloadable source is available for this title right now.</p>}
        </div>
      </div>
    </section>
    {current && <section className="glass-card space-y-4 rounded-3xl p-3 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-display text-xl">Watch</h2><p className="text-xs text-muted-foreground">Available sources and subtitles</p></div><div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="movie-quality">Playback and download quality</label><select id="movie-quality" value={selected} onChange={event => setSelected(Number(event.target.value))} className="h-10 max-w-[190px] rounded-lg border border-border bg-card px-3 text-sm">{sources.map((source, index) => { const size = Number(source.size); return <option key={`${source.quality}-${index}`} value={index}>{source.quality} · {source.format}{source.size ? ` · ${Number.isFinite(size) && size > 1024 ? formatFileSize(size) : source.size}` : ""}</option> })}</select>
        {current.proxyDownload && <CheckedDownload url={current.proxyDownload} label={`Download ${current.quality}`} filename={`${movie?.title || "movie"}-${current.quality}`} />}
      </div></div>
      {current.proxyStream ? <MediaPlayback key={current.proxyStream} src={current.proxyStream} title={movie?.title || initialTitle} subtitles={subtitle ? subtitles.filter(item => item.url === subtitle) : []} /> : <p role="status" className="text-sm text-muted-foreground">A playback source is unavailable, but downloads may still be available.</p>}
      {subtitles.length > 0 && <div className="flex flex-wrap items-center gap-2"><label htmlFor="movie-subtitles" className="text-sm font-medium">Subtitles</label><select id="movie-subtitles" value={subtitle} onChange={event => setSubtitle(event.target.value)} className="h-10 rounded-lg border border-border bg-card px-3 text-sm"><option value="">Off</option>{subtitles.map((item, index) => <option key={`${item.url}-${index}`} value={item.url}>{item.label || item.language}</option>)}</select></div>}
    </section>}
    {!loading && movie && !sources.length && <div className="glass-card rounded-2xl p-4"><div className="flex items-center gap-2"><Film className="h-4 w-4 text-primary" /><span className="text-sm">{movie.title}</span><Button variant="ghost" size="sm" className="ml-auto" onClick={() => void share()}><Copy className="mr-1 h-4 w-4" />Copy link</Button></div></div>}
  </main></AppLayout>
}

"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { AlertCircle, ChevronLeft, ChevronRight, Film, LoaderCircle, Search, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { readApiJson } from "@/lib/client-json"

type Movie = { subjectId: string; title: string; cover: string; genre: string; imdbRatingValue: string | number; releaseDate?: string }
type SearchResult = { results: Movie[]; page: number; nextPage: number | null; hasMore: boolean; totalCount?: number }

export function MovieBoxBrowser() {
  const [query, setQuery] = useState("")
  const [result, setResult] = useState<SearchResult | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const request = useRef<AbortController | null>(null)
  const requestId = useRef(0)

  useEffect(() => {
    const term = query.trim()
    if (!term) { setResult(null); setLoading(false); setError(""); return }
    const id = ++requestId.current
    const timer = window.setTimeout(async () => {
      request.current?.abort()
      const controller = new AbortController()
      request.current = controller
      setLoading(true)
      setError("")
      try {
        const response = await fetch(`/api/moviebox?action=search&query=${encodeURIComponent(term)}&page=${page}`, { cache: "no-store", signal: controller.signal })
        const data = await readApiJson(response)
        if (!response.ok || data.success === false) throw new Error(data.error || "Movie search failed.")
        if (id === requestId.current) setResult({ results: data.results || [], page: data.page || page, nextPage: data.nextPage || null, hasMore: Boolean(data.hasMore), totalCount: data.totalCount })
      } catch (cause) {
        if (!controller.signal.aborted && id === requestId.current) setError(cause instanceof Error ? cause.message : "Movie search failed.")
      } finally {
        if (id === requestId.current) setLoading(false)
      }
    }, 300)
    return () => { window.clearTimeout(timer); request.current?.abort() }
  }, [query, page])

  return <section className="space-y-5">
    <div className="glass-card rounded-2xl p-3 sm:p-4">
      <label className="sr-only" htmlFor="moviebox-search">Search movies</label>
      <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="moviebox-search" value={query} onChange={event => { setQuery(event.target.value); setPage(1) }} placeholder="Search movies and series" autoComplete="off" className="h-12 bg-card/70 pl-10 pr-11" />{loading && <LoaderCircle className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" aria-label="Searching" />}</div>
      <p className="mt-2 px-1 text-xs text-muted-foreground">Search results load as you type. Open a title for playback, subtitles and available downloads.</p>
    </div>
    {error && <div role="alert" className="glass-card flex items-center gap-3 rounded-xl p-4 text-sm"><AlertCircle className="h-5 w-5 text-destructive" />{error}</div>}
    {!query.trim() && <div className="glass-card rounded-2xl p-8 text-center"><Film className="mx-auto h-8 w-8 text-primary" /><p className="mt-3 font-semibold">Find a movie to get started</p><p className="mt-1 text-sm text-muted-foreground">Type a title above to search the catalogue.</p></div>}
    {result && <>
      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground"><span>{result.totalCount ? `${result.totalCount.toLocaleString()} results` : `${result.results.length} titles`} · page {result.page}</span><span>20 per page</span></div>
      {result.results.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
        {result.results.map(movie => <Link key={movie.subjectId} href={`/mv/${movie.subjectId}`} className="group min-w-0 overflow-hidden rounded-2xl border border-border/70 bg-card/70 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <div className="relative aspect-[2/3] overflow-hidden bg-muted">{movie.cover && <img loading="lazy" src={movie.cover} alt={`${movie.title} poster`} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" onError={event => { event.currentTarget.style.display = "none" }} />}<span className="absolute bottom-2 left-2 rounded-full bg-black/75 px-2 py-1 text-[10px] font-semibold text-white">{movie.releaseDate?.slice(0, 4) || "Movie"}</span></div>
          <div className="space-y-1.5 p-3"><h2 className="line-clamp-2 min-h-10 text-sm font-semibold leading-5">{movie.title}</h2><p className="line-clamp-1 text-[11px] text-muted-foreground">{movie.genre || "Genre not listed"}</p>{movie.imdbRatingValue && <span className="inline-flex items-center gap-1 text-xs text-amber-600"><Star className="h-3 w-3 fill-current" />{movie.imdbRatingValue}</span>}</div>
        </Link>)}
      </div> : !loading && <div className="glass-card rounded-xl p-6 text-center text-sm text-muted-foreground">No matching titles were returned.</div>}
      <div className="flex items-center justify-center gap-3 py-2">
        <Button variant="outline" disabled={page <= 1 || loading} onClick={() => setPage(value => Math.max(1, value - 1))}><ChevronLeft className="mr-1 h-4 w-4" />Previous</Button>
        <span className="text-xs text-muted-foreground">Page {result.page}</span>
        <Button variant="outline" disabled={!result.hasMore || loading} onClick={() => setPage(result.nextPage || page + 1)}>Next<ChevronRight className="ml-1 h-4 w-4" /></Button>
      </div>
    </>}
  </section>
}

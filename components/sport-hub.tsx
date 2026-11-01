"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Activity, CalendarDays, CirclePlay, LoaderCircle, Radio, Share2, Trophy } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { MediaPlayback } from "@/components/media-playback"
import { Button } from "@/components/ui/button"
import { readApiJson } from "@/lib/client-json"

type Match = { id: string; league?: string; status?: string; statusLive?: string | number; startTime?: number; score?: string; isLive?: boolean; isEnded?: boolean; home?: { name?: string; score?: string | number; avatar?: string }; away?: { name?: string; score?: string | number; avatar?: string }; proxyStream?: string }
type League = { id: string; name: string }
type News = { id: string; title: string; summary?: string; cover?: string; publishedAt?: string }

async function request(action: string, signal?: AbortSignal, extra: Record<string, string> = {}) {
  const params = new URLSearchParams({ action, ...extra })
  const response = await fetch(`/api/sport?${params}`, { cache: "no-store", signal })
  const data = await readApiJson(response)
  if (!response.ok || data.success === false) throw new Error(data.error || "Sports service unavailable.")
  return data
}
function matchLabel(match: Match) { return `${match.home?.name || "Home"} vs ${match.away?.name || "Away"}` }

export function SportHub() {
  const [tab, setTab] = useState("trend")
  const [matches, setMatches] = useState<Match[]>([])
  const [live, setLive] = useState<Match[]>([])
  const [leagues, setLeagues] = useState<League[]>([])
  const [news, setNews] = useState<News[]>([])
  const [selected, setSelected] = useState<Match | null>(null)
  const [stream, setStream] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [shareStatus, setShareStatus] = useState("")
  const [selectedLeague, setSelectedLeague] = useState<League | null>(null)
  const [moreMatches, setMoreMatches] = useState(false)
  const [matchPage, setMatchPage] = useState(1)

  useEffect(() => {
    const controller = new AbortController()
    void Promise.allSettled([request("trend", controller.signal), request("feeds", controller.signal), request("matches", controller.signal), request("leagues", controller.signal), request("news", controller.signal), request("info", controller.signal)])
      .then(results => {
        if (controller.signal.aborted) return
        const [trend, feeds, matchesData, leaguesData, newsData] = results
        if (trend.status === "fulfilled") setMatches(trend.value.matches || [])
        if (feeds.status === "fulfilled") setLive(feeds.value.matches || [])
        if (matchesData.status === "fulfilled") {
          setMatches(matchesData.value.matches || [])
          setMoreMatches(Boolean(matchesData.value.hasMore))
          setMatchPage(Number(matchesData.value.page) || 1)
        }
        if (leaguesData.status === "fulfilled") setLeagues(leaguesData.value.leagues || [])
        if (newsData.status === "fulfilled") setNews(newsData.value.news || [])
        const failures = results.filter(value => value.status === "rejected")
        if (failures.length === results.length) setError("Sports data could not be reached. Check your connection and retry.")
        else if (failures.length) setError("Some sports sections are temporarily unavailable; the rest of the feed is loaded.")
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [])

  const play = async (match: Match) => {
    setSelected(match); setStream(""); setError("")
    try {
      const response = await fetch(`/api/sport?action=match-detail&matchId=${encodeURIComponent(match.id)}`, { cache: "no-store", signal: AbortSignal.timeout(12000) })
      const data = await readApiJson(response)
      if (!response.ok || data.success === false) throw new Error(data.error || "Match stream unavailable.")
      setStream(data.proxyStream || "")
      if (!data.proxyStream) setError(data.message || "No stream is available for this match.")
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Match stream unavailable.") }
  }
  const selectLeague = async (league: League) => {
    setSelectedLeague(league)
    setTab("matches")
    setError("")
    try {
      const data = await request("matches", undefined, { leagueId: league.id, page: "1" })
      setMatches(data.matches || [])
      setMoreMatches(Boolean(data.hasMore))
      setMatchPage(Number(data.page) || 1)
    } catch (cause) { setError(cause instanceof Error ? cause.message : "League fixtures could not be loaded.") }
  }
  const loadMoreMatches = async () => {
    try {
      const data = await request("matches", undefined, { page: String(matchPage + 1), ...(selectedLeague ? { leagueId: selectedLeague.id } : {}) })
      setMatches(previous => [...previous, ...(data.matches || [])])
      setMoreMatches(Boolean(data.hasMore))
      setMatchPage(Number(data.page) || matchPage + 1)
    } catch (cause) { setError(cause instanceof Error ? cause.message : "More matches could not be loaded.") }
  }
  const share = async (id: string, title: string) => {
    const url = `${window.location.origin}/sport/match/${encodeURIComponent(id)}`
    try {
      if (navigator.share) await navigator.share({ title, url })
      else { await navigator.clipboard.writeText(url); setShareStatus("Match link copied.") }
    } catch (cause) { if (!(cause instanceof DOMException && cause.name === "AbortError")) setShareStatus("Could not share this match.") }
  }

  const shown = tab === "live" ? live : matches
  return <AppLayout><main className="page-shell space-y-5 py-5 pb-12 sm:py-8">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-primary">Sports desk</p><h1 className="mt-2 font-display text-3xl sm:text-4xl">Live sport</h1><p className="mt-2 max-w-xl text-sm text-muted-foreground">Live fixtures, match schedules, leagues, highlights and sports news.</p></div><div className="glass rounded-xl px-4 py-3 text-xs text-muted-foreground"><Activity className="mr-2 inline h-4 w-4 text-primary" />{live.length} live now</div></header>
    <nav aria-label="Sports sections" className="flex gap-2 overflow-x-auto pb-1">{[["trend","Trending"],["live","Live"],["matches","Matches"],["leagues","Leagues"],["news","News"]].map(([key,label])=><button key={key} onClick={()=>setTab(key)} aria-pressed={tab===key} className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium ${tab===key?"border-primary bg-primary text-primary-foreground":"border-border bg-card/70 hover:border-primary/50"}`}>{label}</button>)}</nav>
    {error && <div role="alert" className="glass-card rounded-xl p-3 text-sm">{error} <Button size="sm" variant="outline" className="ml-2" onClick={()=>window.location.reload()}>Retry</Button></div>}
    {selected && <section className="glass-card space-y-3 rounded-2xl p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-wider text-primary">{selected.league || "Match"}</p><h2 className="font-display text-xl">{matchLabel(selected)}</h2></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={()=>void share(selected.id,matchLabel(selected))}><Share2 className="mr-2 h-4 w-4"/>Share match</Button><Button size="sm" variant="ghost" onClick={()=>{setSelected(null);setStream("")}}>Close</Button></div></div>
      {stream ? <MediaPlayback key={stream} src={stream} title={matchLabel(selected)} /> : <div className="grid aspect-video place-items-center rounded-xl bg-black/90 text-center text-white/70"><div><CirclePlay className="mx-auto h-10 w-10 text-primary"/><p className="mt-2">{error || "Loading the latest stream…"}</p></div></div>}
    </section>}
    {shareStatus && <p role="status" className="text-xs text-muted-foreground">{shareStatus}</p>}
    {loading && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin"/>Loading sports feed…</p>}
    {tab === "leagues" ? <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{leagues.map(league=><button key={league.id} onClick={()=>void selectLeague(league)} className="glass-card rounded-xl p-4 text-left font-medium hover:border-primary/40"><Trophy className="mb-2 h-5 w-5 text-primary"/>{league.name}</button>)}</section>
      : tab === "news" ? <section className="grid gap-3 sm:grid-cols-2">{news.map(item=><article key={item.id} className="glass-card overflow-hidden rounded-2xl">{item.cover && <img src={item.cover} alt="" loading="lazy" className="h-40 w-full object-cover"/>}<div className="p-4"><h2 className="font-semibold">{item.title}</h2>{item.summary&&<p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{item.summary}</p>}</div></article>)}</section>
      : <section className="space-y-3">{tab === "matches" && selectedLeague && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Trophy className="h-4 w-4 text-primary"/>{selectedLeague.name}<button className="ml-auto text-primary underline" onClick={()=>{setSelectedLeague(null);void request("matches").then(data=>{setMatches(data.matches||[]);setMoreMatches(Boolean(data.hasMore));setMatchPage(Number(data.page)||1)}).catch(e=>setError(e.message))}}>All leagues</button></div>}<div className="grid gap-3 md:grid-cols-2">{shown.map(match=><article key={match.id} className="glass-card rounded-2xl p-4">
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground"><span className="truncate">{match.league || "Fixture"}</span><span className="shrink-0">{match.isLive || String(match.statusLive).toLowerCase() === "live" ? "LIVE" : match.status || (match.startTime ? new Date(match.startTime).toLocaleString() : "Scheduled")}</span></div>
        <div className="my-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2"><div className="flex min-w-0 items-center gap-2">{match.home?.avatar&&<img src={match.home.avatar} alt="" className="h-8 w-8 object-contain"/>}<span className="truncate text-sm font-semibold">{match.home?.name || "Home"}</span></div><span className="font-display text-lg">{match.score || `${match.home?.score ?? "–"} : ${match.away?.score ?? "–"}`}</span><div className="flex min-w-0 items-center justify-end gap-2">{match.away?.avatar&&<img src={match.away.avatar} alt="" className="h-8 w-8 object-contain"/>}<span className="truncate text-right text-sm font-semibold">{match.away?.name || "Away"}</span></div></div>
        <div className="flex gap-2"><Button size="sm" onClick={()=>void play(match)}><Radio className="mr-2 h-4 w-4"/>Watch</Button><Button size="sm" variant="outline" onClick={()=>void share(match.id,matchLabel(match))}><Share2 className="mr-2 h-4 w-4"/>Share</Button><Link href={`/sport/match/${encodeURIComponent(match.id)}`} className="ml-auto inline-flex h-9 items-center gap-1 rounded-md px-3 text-sm text-muted-foreground hover:bg-muted"><CalendarDays className="h-4 w-4"/>Details</Link></div>
      </article>)}</div>
      {!loading && !shown.length && <div className="glass-card rounded-xl p-6 text-sm text-muted-foreground">{tab === "live" ? "No live fixtures are listed right now." : "No matches are available right now."}</div>}
      {tab === "matches" && moreMatches && <div className="flex justify-center"><Button variant="outline" onClick={()=>void loadMoreMatches()}>Load more matches</Button></div>}</section>}
  </main></AppLayout>
}

"use client"

import { useEffect, useState } from "react"
import { AppLayout } from "@/components/app-layout"
import { MediaPlayback } from "@/components/media-playback"
import { Button } from "@/components/ui/button"
import { readApiJson } from "@/lib/client-json"

type MatchInfo = { id: string; home?: string | { name?: string }; away?: string | { name?: string }; league?: string; score?: string; status?: string }
const nameOf = (value?: string | { name?: string }) => typeof value === "string" ? value : value?.name || ""
export function SharedSportMatch({ matchId }: { matchId: string }) {
  const [match, setMatch] = useState<MatchInfo | null>(null)
  const [stream, setStream] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const load = () => {
    setLoading(true); setError("")
    fetch(`/api/sport?action=match-detail&matchId=${encodeURIComponent(matchId)}`, { cache: "no-store", signal: AbortSignal.timeout(15000) })
      .then(async response => {
        const data = await readApiJson(response)
        if (!response.ok || data.success === false) throw new Error(data.error || "Match information is unavailable.")
        setMatch(data.match); setStream(data.proxyStream || "")
        if (!data.proxyStream) setError(data.message || "No stream is available for this match.")
      })
      .catch(cause => setError(cause instanceof Error ? cause.message : "Match information is unavailable."))
      .finally(() => setLoading(false))
  }
  useEffect(load, [matchId])
  const title = match ? `${nameOf(match.home) || "Home"} vs ${nameOf(match.away) || "Away"}` : "Sports match"
  return <AppLayout><main className="page-shell space-y-5 py-6 sm:py-10">
    <header><p className="text-xs font-bold uppercase tracking-[.2em] text-primary">Shared sports match</p><h1 className="mt-2 font-display text-3xl sm:text-4xl">{title}</h1><p className="mt-2 text-sm text-muted-foreground">{match?.league} {match?.score ? `· ${match.score}` : ""} {match?.status ? `· ${match.status}` : ""}</p></header>
    {stream ? <MediaPlayback src={stream} title={title} /> : <div className="glass-card grid aspect-video place-items-center rounded-2xl p-6 text-center"><div><p role={error ? "alert" : "status"} className="text-sm text-muted-foreground">{error || (loading ? "Loading match details…" : "No stream available.")}</p><Button variant="outline" className="mt-3" disabled={loading} onClick={load}>Retry</Button></div></div>}
  </main></AppLayout>
}

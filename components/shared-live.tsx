"use client"

import { useEffect, useState } from "react"
import { AppLayout } from "@/components/app-layout"
import { MediaPlayback } from "@/components/media-playback"
import { Button } from "@/components/ui/button"
import { readApiJson } from "@/lib/client-json"

type Channel = { id: string; name: string; category?: string; country?: string; logo?: string }
export function SharedLive({ channelId }: { channelId: string }) {
  const [channel, setChannel] = useState<Channel | null>(null)
  const [stream, setStream] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(true)
  const [copied, setCopied] = useState(false)
  const load = () => {
    setBusy(true); setError("")
    fetch(`/api/live-tv?action=stream&channelId=${encodeURIComponent(channelId)}`, { cache: "no-store", signal: AbortSignal.timeout(15000) })
      .then(async response => {
        const data = await readApiJson(response)
        if (!response.ok || data.success === false) throw new Error(data.error || "This channel is unavailable.")
        setChannel(data.channel)
        setStream(data.streamUrl || data.channel?.streamUrl || "")
      })
      .catch(cause => setError(cause instanceof Error ? cause.message : "This channel is unavailable."))
      .finally(() => setBusy(false))
  }
  useEffect(load, [channelId])
  return <AppLayout><main className="page-shell space-y-5 py-6 sm:py-10">
    <div><p className="text-xs font-bold uppercase tracking-[.2em] text-primary">Shared live channel</p><h1 className="mt-2 font-display text-3xl sm:text-4xl">{channel?.name || "Live TV"}</h1><p className="mt-2 text-sm text-muted-foreground">{channel?.country || "TV Room GAGA"} · Stream availability varies by region.</p></div>
    {stream ? <MediaPlayback src={stream} title={channel?.name || "Live TV"} /> : <div className="glass-card grid aspect-video place-items-center rounded-2xl p-6 text-center"><div><p role={error ? "alert" : "status"} className="text-sm text-muted-foreground">{error || (busy ? "Connecting to the channel…" : "No stream is available.")}</p><Button variant="outline" className="mt-3" onClick={load} disabled={busy}>Retry</Button></div></div>}
    <Button variant="outline" onClick={() => void navigator.clipboard?.writeText(window.location.href).then(() => setCopied(true))}>{copied ? "Link copied" : "Copy channel link"}</Button>
  </main></AppLayout>
}

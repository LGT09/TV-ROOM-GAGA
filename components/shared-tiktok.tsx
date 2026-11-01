"use client"

import { useEffect, useState } from "react"
import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { CheckedDownload } from "@/components/checked-download"
import { readApiJson } from "@/lib/client-json"

type Result = { title?: string; thumbnail?: string; links?: { label: string; url: string; quality?: string }[] }
export function SharedTikTok({ sourceUrl }: { sourceUrl: string }) {
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/social-download?platform=tiktok&url=${encodeURIComponent(sourceUrl)}`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const data = await readApiJson(response)
        if (!response.ok || !data.success) throw new Error(data.error || "Download options are unavailable.")
        setResult(data)
      })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Download options are unavailable.") })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [sourceUrl])
  return <AppLayout><main className="page-shell max-w-3xl space-y-5 py-8 sm:py-12">
    <header><p className="text-xs font-bold uppercase tracking-[.2em] text-primary">Shared media link</p><h1 className="mt-2 font-display text-3xl sm:text-4xl">{result?.title || "TikTok media"}</h1><p className="mt-2 text-sm text-muted-foreground">Share link valid for seven days. Media is resolved when opened; files are not stored on this site.</p></header>
    {result?.thumbnail && <img src={result.thumbnail} alt="" className="max-h-80 w-full rounded-2xl object-contain"/>}
    {loading && <p role="status" className="text-sm text-muted-foreground">Preparing current download options…</p>}
    {error && <p role="alert" className="glass-card rounded-xl p-4 text-sm">{error}</p>}
    {result?.links?.map((link, index) => <section key={`${link.url}-${index}`} className="glass-card flex flex-wrap items-center justify-between gap-3 rounded-xl p-4"><span className="text-sm">{link.label}{link.quality ? ` · ${link.quality}` : ""}</span><CheckedDownload url={link.url} label="Download"/></section>)}
    {result && !result.links?.length && <p className="text-sm text-muted-foreground">No download option was returned.</p>}
    <Button variant="outline" onClick={() => void navigator.clipboard?.writeText(window.location.href)}>Copy share link</Button>
  </main></AppLayout>
}

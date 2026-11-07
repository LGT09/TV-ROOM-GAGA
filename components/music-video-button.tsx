"use client"

import { useState } from "react"
import { AlertCircle, LoaderCircle, Video } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { readApiJson } from "@/lib/client-json"

type Props = {
  title: string
  artist?: string
  videoId?: string
  videoUrl?: string
  compact?: boolean
  onOpen?: () => void
}

function validVideoId(value: unknown) {
  if (typeof value !== "string") return ""
  const candidate = value.trim()
  return /^[\w-]{11}$/.test(candidate) ? candidate : ""
}

function videoIdFromUrl(value: unknown) {
  if (typeof value !== "string") return ""
  try {
    const url = new URL(value)
    if (!["http:", "https:"].includes(url.protocol)) return ""
    const host = url.hostname.replace(/^(www|m|music)\./, "")
    if (host === "youtu.be") return validVideoId(url.pathname.split("/")[1])
    if (host !== "youtube.com") return ""
    return validVideoId(url.searchParams.get("v") || url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1])
  } catch {
    return ""
  }
}

export function MusicVideoButton({ title, artist = "", videoId: suppliedId, videoUrl, compact = false, onOpen }: Props) {
  const [open, setOpen] = useState(false)
  const [resolvedId, setResolvedId] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const loadVideo = async () => {
    setResolvedId("")
    setError("")
    setLoading(true)
    const directId = validVideoId(suppliedId) || videoIdFromUrl(videoUrl)
    if (directId) {
      setResolvedId(directId)
      setLoading(false)
      return
    }
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 9000)
    try {
      const query = [title, artist].filter(Boolean).join(" ")
      const response = await fetch(`/api/youtube?action=search&query=${encodeURIComponent(query)}`, {
        cache: "no-store",
        signal: controller.signal,
      })
      const data = await readApiJson<{ items?: Array<{ id?: string; url?: string }> }>(response)
      const found = (Array.isArray(data.items) ? data.items : [])
        .map(item => validVideoId(item.id) || videoIdFromUrl(item.url))
        .find(Boolean)
      if (!found) throw new Error("No official YouTube video matched this song.")
      setResolvedId(found)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The music video could not be found.")
    } finally {
      window.clearTimeout(timeout)
      setLoading(false)
    }
  }

  const showVideo = () => {
    onOpen?.()
    setOpen(true)
    void loadVideo()
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={compact ? "icon" : "sm"}
        className={compact ? "h-9 w-9 shrink-0 rounded-full" : "h-7 gap-1 rounded-md px-2 text-[10px]"}
        onClick={showVideo}
        aria-label={`Watch music video for ${title}`}
        title={`Watch music video for ${title}`}
      >
        <Video className={compact ? "h-4 w-4" : "h-3.5 w-3.5"} />
        {!compact && <span>Watch video</span>}
        {compact && <span className="sr-only">Watch video</span>}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-4xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="pr-8">Music video</DialogTitle>
            <DialogDescription>{title}{artist ? ` · ${artist}` : ""}</DialogDescription>
          </DialogHeader>
          <div className="overflow-hidden rounded-xl bg-black">
            {loading ? (
              <div className="grid aspect-video place-items-center text-sm text-white/75" role="status">
                <span className="flex items-center gap-2"><LoaderCircle className="h-5 w-5 animate-spin" />Finding video…</span>
              </div>
            ) : resolvedId ? (
              <iframe
                key={resolvedId}
                src={`https://www.youtube-nocookie.com/embed/${resolvedId}?autoplay=1&rel=0`}
                title={`${title} music video`}
                className="aspect-video w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            ) : (
              <div className="flex aspect-video flex-col items-center justify-center gap-3 px-5 text-center text-sm text-white/80">
                <p role="alert" className="flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" />{error || "The video is unavailable."}</p>
                <Button variant="secondary" size="sm" onClick={() => void loadVideo()}>Try again</Button>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Video playback is provided by YouTube.</p>
        </DialogContent>
      </Dialog>
    </>
  )
}

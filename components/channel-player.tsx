"use client"
import { MediaWatermark } from "@/components/media-watermark"

import { useState, useEffect } from "react"
import { X, Loader2, RefreshCw, Tv, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { TVChannel } from "@/lib/api/channels"

interface ChannelPlayerProps {
  channel: TVChannel
  onClose: () => void
}

export function ChannelPlayer({ channel, onClose }: ChannelPlayerProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [streamUrl, setStreamUrl] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string>("")
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    loadChannelStream()
  }, [channel, retryCount])

  const loadChannelStream = async () => {
    setIsLoading(true)
    setHasError(false)
    setErrorMessage("")

    try {
      if (channel.streamUrl) {
        // Clean and format the stream URL
        let embedUrl = channel.streamUrl

        // Ensure proper embed URL format
        if (!embedUrl.includes("embed")) {
          embedUrl = embedUrl.replace("watch?v=", "embed/")
        }

        // Add autoplay and other parameters
        const separator = embedUrl.includes("?") ? "&" : "?"
        embedUrl = `${embedUrl}${separator}autoplay=1&controls=1&modestbranding=1&rel=0`

        setStreamUrl(embedUrl)
        setIsLoading(false)
        return
      }

      // Fallback: Search for channel content via YouTube API
      if (channel.fallbackSearchQuery) {
        const searchResponse = await fetch(
          `/api/youtube?action=search&query=${encodeURIComponent(channel.fallbackSearchQuery)}&maxResults=1`,
        )
        const searchData = await searchResponse.json()

        if (searchData.items && searchData.items.length > 0) {
          const video = searchData.items[0]
          const videoId = typeof video.id === "object" ? video.id.videoId : video.id
          const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=1&modestbranding=1`
          setStreamUrl(embedUrl)
          setIsLoading(false)
          return
        }
      }

      throw new Error("No stream found")
    } catch (error) {
      console.error("[v0] Error loading channel stream:", error)
      setHasError(true)
      setErrorMessage(
        "Stream temporarily unavailable. The channel may be offline or have content restrictions in your region.",
      )
      setIsLoading(false)
    }
  }

  const handleRetry = () => {
    setRetryCount((prev) => prev + 1)
  }

  const tryAlternativeStream = async () => {
    setIsLoading(true)
    try {
      const altQuery = `${channel.name} ${channel.shows[0]} full episode`
      const searchResponse = await fetch(
        `/api/youtube?action=search&query=${encodeURIComponent(altQuery)}&maxResults=1`,
      )
      const searchData = await searchResponse.json()

      if (searchData.items && searchData.items.length > 0) {
        const video = searchData.items[0]
        const videoId = typeof video.id === "object" ? video.id.videoId : video.id
        const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=1`
        setStreamUrl(embedUrl)
        setHasError(false)
      }
    } catch (error) {
      console.error("[v0] Alternative stream failed:", error)
    }
    setIsLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4">
      <div className="relative w-full max-w-6xl">
        <Button
          variant="ghost"
          size="icon"
          className="absolute -top-12 right-0 text-white hover:bg-white/20 z-10"
          onClick={onClose}
        >
          <X className="h-6 w-6" />
        </Button>

        <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
          <MediaWatermark/>
          {isLoading ? (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center space-y-4">
                <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto" />
                <p className="text-white">Loading {channel.name}...</p>
                <p className="text-white/60 text-sm">Connecting to stream...</p>
              </div>
            </div>
          ) : hasError || !streamUrl ? (
            <div className="w-full h-full flex items-center justify-center text-white">
              <div className="text-center space-y-4 max-w-md px-4">
                <Tv className="h-16 w-16 text-muted-foreground mx-auto" />
                <div>
                  <p className="text-xl mb-2">Stream Unavailable</p>
                  <p className="text-white/60 text-sm">{errorMessage}</p>
                </div>
                <div className="flex gap-3 justify-center">
                  <Button onClick={handleRetry} variant="secondary" className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Retry
                  </Button>
                  <Button onClick={tryAlternativeStream} variant="outline" className="gap-2 bg-transparent">
                    <ExternalLink className="h-4 w-4" />
                    Try Alternative
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <iframe
              src={streamUrl}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
              allowFullScreen
              title={channel.name}
              onError={() => setHasError(true)}
            />
          )}
        </div>

        {/* Channel Info */}
        <div className="mt-4 text-white space-y-3">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold">{channel.name}</h2>
            <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/50">
              {channel.category}
            </Badge>
            {!hasError && !isLoading && (
              <Badge variant="secondary" className="bg-red-500/20 text-red-400 border-red-500/50 animate-pulse">
                LIVE
              </Badge>
            )}
          </div>
          <p className="text-white/80 text-sm">{channel.description}</p>

          {/* Shows on this channel */}
          <div className="flex flex-wrap gap-2 mt-2">
            {channel.shows.slice(0, 5).map((show) => (
              <Badge key={show} variant="outline" className="text-white/70 border-white/30">
                {show}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

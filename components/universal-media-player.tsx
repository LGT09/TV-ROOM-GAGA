"use client"
import { MediaWatermark } from "@/components/media-watermark"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { X, Play, Pause, Volume2, VolumeX, Maximize, Minimize, SkipBack, SkipForward } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import type { ContentItem } from "@/lib/types"
import Link from "next/link"
import { Compass } from "lucide-react"

interface UniversalMediaPlayerProps {
  content: ContentItem
  onClose: () => void
  playlist?: ContentItem[]
  onNext?: () => void
  onPrevious?: () => void
}

export function UniversalMediaPlayer({ content, onClose, playlist, onNext, onPrevious }: UniversalMediaPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(70)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const playPromiseRef = useRef<Promise<void> | null>(null)
  const localUrl = (content as ContentItem & { localUrl?: string }).localUrl

  const isAudio = content.type === "music"
  const isVideo = content.type === "movie" || content.type === "series" || content.type === "anime"

  useEffect(() => {
    setIsLoading(true)
    if (mediaRef.current) {
      const mediaUrl = getMediaSource()
      if (mediaUrl) {
        mediaRef.current.src = mediaUrl
        mediaRef.current.load()

        playPromiseRef.current = mediaRef.current.play()
        playPromiseRef.current
          .then(() => {
            setIsPlaying(true)
            setIsLoading(false)
          })
          .catch((error) => {
            if (error.name !== "AbortError") {
              console.error("[v0] Media playback failed:", error)
            }
            setIsPlaying(false)
            setIsLoading(false)
          })
      } else {
        setIsLoading(false)
      }
    }

    return () => {
      if (mediaRef.current) {
        mediaRef.current.pause()
        mediaRef.current.src = ""
      }
      if (playPromiseRef.current) {
        playPromiseRef.current.catch(() => {})
        playPromiseRef.current = null
      }
    }
  }, [content])

  useEffect(() => {
    if (mediaRef.current) {
      mediaRef.current.volume = volume / 100
    }
  }, [volume])

  const getMediaSource = () => {
    // Priority: localUrl (downloaded file) > audioUrl/videoUrl > previewUrl > streamUrl
    if (localUrl) return localUrl
    if (isAudio && content.audioUrl) return content.audioUrl
    if (isAudio && content.previewUrl) return content.previewUrl
    return null
  }

  const togglePlay = () => {
    if (mediaRef.current) {
      if (isPlaying) {
        mediaRef.current.pause()
        setIsPlaying(false)
      } else {
        playPromiseRef.current = mediaRef.current.play()
        playPromiseRef.current
          .then(() => setIsPlaying(true))
          .catch((error) => {
            if (error.name !== "AbortError") {
              console.error("[v0] Media playback failed:", error)
            }
            setIsPlaying(false)
          })
      }
    }
  }

  const handleTimeUpdate = () => {
    if (mediaRef.current) {
      setCurrentTime(mediaRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (mediaRef.current) {
      setDuration(mediaRef.current.duration)
    }
  }

  const handleSeek = (value: number[]) => {
    if (mediaRef.current) {
      mediaRef.current.currentTime = value[0]
      setCurrentTime(value[0])
    }
  }

  const toggleMute = () => {
    if (mediaRef.current) {
      mediaRef.current.muted = !isMuted
      setIsMuted(!isMuted)
    }
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  const formatTime = (time: number) => {
    if (!isFinite(time)) return "0:00"
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  const handleEnded = () => {
    if (onNext) {
      onNext()
    } else {
      setIsPlaying(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4">
      <div ref={containerRef} className="relative w-full max-w-6xl">
        <Button
          variant="ghost"
          size="icon"
          className="absolute -top-12 right-0 text-white hover:bg-white/20 z-10"
          onClick={onClose}
        >
          <X className="h-6 w-6" />
        </Button>

        <div className={`relative bg-black rounded-lg overflow-hidden ${isAudio ? "aspect-[3/1]" : "aspect-video"}`}>
          <MediaWatermark/>
          {isAudio ? (
            <div className="w-full h-full flex items-center gap-6 p-8 bg-gradient-to-br from-primary/20 to-background">
              <div className="w-32 h-32 rounded-lg overflow-hidden flex-shrink-0 shadow-2xl">
                <img
                  src={content.imageUrl || "/placeholder.svg"}
                  alt={content.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-3xl font-bold text-white mb-2 truncate">{content.title}</h2>
                {content.artist && <p className="text-xl text-white/80 truncate">{content.artist}</p>}
              </div>
              <audio
                ref={mediaRef as React.RefObject<HTMLAudioElement>}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={handleEnded}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />
            </div>
          ) : !localUrl ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-4 px-6 text-center bg-background">
              <p className="font-display text-2xl text-foreground">No local video file is available.</p>
              <p className="text-sm text-muted-foreground max-w-md">A trailer or catalogue entry is not a full movie source. Browse the library to see whether playback is available.</p>
              <Link href={`/discover?q=${encodeURIComponent(content.title)}`} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"><Compass className="h-4 w-4"/>Open discovery</Link>
            </div>
          ) : (
            <video
              ref={mediaRef as React.RefObject<HTMLVideoElement>}
              className="w-full h-full"
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={handleEnded}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
          )}

          {(isAudio || localUrl) && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4">
              <div className="mb-4">
                <Slider
                  value={[currentTime]}
                  max={duration || 100}
                  step={0.1}
                  onValueChange={handleSeek}
                  className="cursor-pointer"
                />
                <div className="flex justify-between text-xs text-white/80 mt-1">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {playlist && playlist.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-white hover:bg-white/20"
                      onClick={onPrevious}
                      disabled={!onPrevious}
                    >
                      <SkipBack className="h-5 w-5" />
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/20 h-12 w-12"
                    onClick={togglePlay}
                  >
                    {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
                  </Button>

                  {playlist && playlist.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-white hover:bg-white/20"
                      onClick={onNext}
                      disabled={!onNext}
                    >
                      <SkipForward className="h-5 w-5" />
                    </Button>
                  )}

                  <div className="flex items-center gap-2 ml-4">
                    <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={toggleMute}>
                      {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                    </Button>
                    <Slider
                      value={[isMuted ? 0 : volume]}
                      max={100}
                      step={1}
                      onValueChange={(value) => {
                        setVolume(value[0])
                        if (value[0] > 0 && isMuted) setIsMuted(false)
                      }}
                      className="w-24"
                    />
                  </div>
                </div>

                {isVideo && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/20"
                    onClick={toggleFullscreen}
                  >
                    {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {content.description && (
          <div className="mt-4 text-white">
            <p className="text-white/80">{content.description}</p>
          </div>
        )}
      </div>
    </div>
  )
}

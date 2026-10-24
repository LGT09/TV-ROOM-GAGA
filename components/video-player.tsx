"use client"
import { MediaWatermark } from "@/components/media-watermark"

import { useState, useRef, useEffect } from "react"
import { X, Play, Pause, Volume2, VolumeX, Maximize, Minimize, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import type { ContentItem } from "@/lib/types"

interface VideoPlayerProps {
  content: ContentItem
  onClose: () => void
}

export function VideoPlayer({ content, onClose }: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(70)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const playPromiseRef = useRef<Promise<void> | null>(null)

  useEffect(() => {
    if (videoRef.current && !isYouTube) {
      playPromiseRef.current = videoRef.current.play()
      playPromiseRef.current
        .then(() => {
          setIsPlaying(true)
        })
        .catch((error) => {
          if (error.name !== "AbortError") {
            console.log("[v0] Video autoplay failed:", error)
          }
          setIsPlaying(false)
        })
    }

    return () => {
      if (videoRef.current) {
        videoRef.current.pause()
        videoRef.current.src = ""
      }
      if (playPromiseRef.current) {
        playPromiseRef.current.catch(() => {}) // Ignore errors from cleanup
        playPromiseRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume / 100
    }
  }, [volume])

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
        setIsPlaying(false)
      } else {
        playPromiseRef.current = videoRef.current.play()
        playPromiseRef.current
          .then(() => {
            setIsPlaying(true)
          })
          .catch((error) => {
            if (error.name !== "AbortError") {
              console.log("[v0] Video playback failed:", error)
            }
            setIsPlaying(false)
          })
      }
    }
  }

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration)
    }
  }

  const handleSeek = (value: number[]) => {
    if (videoRef.current) {
      videoRef.current.currentTime = value[0]
      setCurrentTime(value[0])
    }
  }

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted
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
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  const getVideoSource = () => {
    if (content.trailerKey) {
      return `https://www.youtube.com/embed/${content.trailerKey}?autoplay=1&controls=1&rel=0`
    }
    return content.videoUrl || content.streamUrl
  }

  const isYouTube = !!content.trailerKey

  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4">
      <div ref={containerRef} className="relative w-full max-w-6xl">
        {/* Close Button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute -top-12 right-0 text-white hover:bg-white/20 z-10"
          onClick={onClose}
        >
          <X className="h-6 w-6" />
        </Button>

        {/* Video Container */}
        <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
          <MediaWatermark/>
          {isYouTube ? (
            <iframe
              src={getVideoSource()}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <>
              <video
                ref={videoRef}
                src={getVideoSource()}
                className="w-full h-full"
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />

              {/* Custom Controls Overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                {/* Progress Bar */}
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

                {/* Control Buttons */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={togglePlay}>
                      {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                    </Button>

                    <div className="flex items-center gap-2">
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

                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/20"
                    onClick={toggleFullscreen}
                  >
                    {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Video Info */}
        <div className="mt-4 text-white">
          <h2 className="text-2xl font-bold">{content.title}</h2>
          {content.description && <p className="text-white/80 mt-2">{content.description}</p>}
          {content.cast && content.cast.length > 0 && (
            <div className="mt-4">
              <h3 className="text-lg font-semibold mb-2">Cast</h3>
              <div className="flex gap-4 overflow-x-auto pb-2">
                {content.cast.slice(0, 10).map((actor, index) => (
                  <div key={index} className="flex-shrink-0 text-center">
                    <div className="w-16 h-16 rounded-full bg-white/10 overflow-hidden mb-1">
                      {actor.profile_path ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w185${actor.profile_path}`}
                          alt={actor.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                  <div className="w-full h-full flex items-center justify-center"><UserRound className="h-7 w-7 text-muted-foreground" /></div>
                      )}
                    </div>
                    <p className="text-xs text-white/90">{actor.name}</p>
                    {actor.character && <p className="text-xs text-white/60">{actor.character}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

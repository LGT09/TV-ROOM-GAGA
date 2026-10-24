"use client"
import { readApiJson } from "@/lib/client-json"
import { MediaWatermark } from "@/components/media-watermark"

import { useState, useRef, useEffect } from "react"
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Shuffle, Repeat, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import type { ContentItem } from "@/lib/types"

interface MusicPlayerProps {
  currentTrack: ContentItem | null
  playlist: ContentItem[]
  onTrackChange?: (track: ContentItem) => void
}

export function MusicPlayer({ currentTrack, playlist, onTrackChange }: MusicPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(70)
  const [isMuted, setIsMuted] = useState(false)
  const [isShuffle, setIsShuffle] = useState(false)
  const [repeatMode, setRepeatMode] = useState<"off" | "all" | "one">("off")
  const audioRef = useRef<HTMLAudioElement>(null)
  const playPromiseRef = useRef<Promise<void> | null>(null)

  const [isLoadingAudio, setIsLoadingAudio] = useState(false)
  const [audioError, setAudioError] = useState<string | null>(null)

  // Fetch playable audio URL from Nayan API for YouTube-sourced tracks
  const fetchAudioUrl = async (track: ContentItem): Promise<string | null> => {
    const videoUrl = track.previewUrl || track.videoUrl
    if (!videoUrl) return null

    // If it's already a direct audio URL (not YouTube), use it directly
    if (
      track.audioUrl &&
      !track.audioUrl.includes("youtube.com") &&
      !track.audioUrl.includes("youtu.be")
    ) {
      return track.audioUrl
    }

    // Resolve full media; a chart listening sample is never a silent fallback.
    {
      try {
        setIsLoadingAudio(true)
        setAudioError(null)
        
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 24000)
        
        const response = await fetch(
          `/api/music?action=get-audio&full=1&url=${encodeURIComponent(videoUrl)}&title=${encodeURIComponent(track.title)}`,
          { signal: controller.signal, cache: "no-store" }
        )
        
        clearTimeout(timeoutId)
        
        const data = await readApiJson(response)
        if (data.success && data.audioUrl) {
          return data.audioUrl
        }
      } catch (err: any) {
        if (err.name === "AbortError") {
          setAudioError("Loading timed out")
        }
      } finally {
        setIsLoadingAudio(false)
      }
    }

    return null
  }

  useEffect(() => {
    if (currentTrack && audioRef.current) {
      // Cancel any pending play promise
      if (playPromiseRef.current) {
        playPromiseRef.current.catch(() => {})
      }

      // Try to get a playable audio URL
      const loadAndPlay = async () => {
        let audioUrl = currentTrack.audioUrl || null

        // If no direct audio URL, try fetching one
        if (
          !audioUrl ||
          audioUrl.includes("youtube.com") ||
          audioUrl.includes("youtu.be")
        ) {
          audioUrl = await fetchAudioUrl(currentTrack)
        }

        if (audioUrl && audioRef.current) {
          audioRef.current.src = audioUrl
          audioRef.current.load()

          playPromiseRef.current = audioRef.current.play()
          playPromiseRef.current
            .then(() => {
              setIsPlaying(true)
            })
            .catch((error) => {
              if (error.name !== "AbortError") {
                console.log("[v0] Audio playback failed:", error)
              }
              setIsPlaying(false)
            })
        } else {
          setIsPlaying(false)
        }
      }

      loadAndPlay()
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ""
      }
      if (playPromiseRef.current) {
        playPromiseRef.current.catch(() => {})
        playPromiseRef.current = null
      }
    }
  }, [currentTrack])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100
    }
  }, [volume])

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
        setIsPlaying(false)
      } else {
        playPromiseRef.current = audioRef.current.play()
        playPromiseRef.current
          .then(() => {
            setIsPlaying(true)
          })
          .catch((error) => {
            if (error.name !== "AbortError") {
              console.log("[v0] Audio playback failed:", error)
            }
            setIsPlaying(false)
          })
      }
    }
  }

  const handleSkipForward = () => {
    if (!currentTrack || playlist.length === 0) return
    const currentIndex = playlist.findIndex((track) => track.id === currentTrack.id)
    let nextIndex = currentIndex + 1

    if (isShuffle) {
      nextIndex = Math.floor(Math.random() * playlist.length)
    } else if (nextIndex >= playlist.length) {
      nextIndex = repeatMode === "all" ? 0 : currentIndex
    }

    if (nextIndex !== currentIndex || repeatMode === "one") {
      onTrackChange?.(playlist[nextIndex])
    }
  }

  const handleSkipBack = () => {
    if (!currentTrack || playlist.length === 0) return

    if (currentTime > 3) {
      if (audioRef.current) {
        audioRef.current.currentTime = 0
      }
      return
    }

    const currentIndex = playlist.findIndex((track) => track.id === currentTrack.id)
    let prevIndex = currentIndex - 1

    if (prevIndex < 0) {
      prevIndex = playlist.length - 1
    }

    onTrackChange?.(playlist[prevIndex])
  }

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration)
    }
  }

  const handleEnded = () => {
    if (repeatMode === "one") {
      if (audioRef.current) {
        playPromiseRef.current = audioRef.current.play()
        playPromiseRef.current.catch((error) => {
          if (error.name !== "AbortError") {
            console.log("[v0] Audio repeat failed:", error)
          }
        })
      }
    } else {
      handleSkipForward()
    }
  }

  const handleSeek = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0]
      setCurrentTime(value[0])
    }
  }

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted
      setIsMuted(!isMuted)
    }
  }

  const formatTime = (time: number) => {
    if (!isFinite(time)) return "0:00"
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  const toggleRepeat = () => {
    const modes: Array<"off" | "all" | "one"> = ["off", "all", "one"]
    const currentIndex = modes.indexOf(repeatMode)
    const nextIndex = (currentIndex + 1) % modes.length
    setRepeatMode(modes[nextIndex])
  }

  if (!currentTrack) {
    return null
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-30">
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      <div className="container mx-auto px-4 py-4">
        <MediaWatermark audio/>
        <div className="flex flex-col gap-4">
          {/* Progress Bar */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-12 text-right">{formatTime(currentTime)}</span>
            <Slider
              value={[currentTime]}
              max={duration || 100}
              step={1}
              onValueChange={handleSeek}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground w-12">{formatTime(duration)}</span>
          </div>

          {/* Player Controls */}
          <div className="flex items-center justify-between gap-4">
            {/* Track Info */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-12 h-12 bg-muted rounded overflow-hidden flex-shrink-0">
                <img
                  src={currentTrack.imageUrl || "/placeholder.svg"}
                  alt={currentTrack.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground truncate">{currentTrack.title}</p>
                {currentTrack.artist && <p className="text-sm text-muted-foreground truncate">{currentTrack.artist}</p>}
              </div>
            </div>

            {/* Playback Controls */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsShuffle(!isShuffle)}
                className={isShuffle ? "text-primary" : "text-muted-foreground"}
              >
                <Shuffle className="h-4 w-4" />
              </Button>

              <Button variant="ghost" size="icon" onClick={handleSkipBack}>
                <SkipBack className="h-5 w-5" />
              </Button>

              <Button variant="default" size="icon" className="h-10 w-10 rounded-full" onClick={togglePlay} disabled={isLoadingAudio}>
                {isLoadingAudio ? <Loader2 className="h-5 w-5 animate-spin" /> : isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
              </Button>

              <Button variant="ghost" size="icon" onClick={handleSkipForward}>
                <SkipForward className="h-5 w-5" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={toggleRepeat}
                className={repeatMode !== "off" ? "text-primary" : "text-muted-foreground"}
              >
                <Repeat className="h-4 w-4" />
                {repeatMode === "one" && <span className="absolute text-[10px] font-bold">1</span>}
              </Button>
            </div>

            {/* Volume Controls */}
            <div className="hidden md:flex items-center gap-2 flex-1 justify-end">
              <Button variant="ghost" size="icon" onClick={toggleMute}>
                {isMuted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </Button>
              <Slider
                value={[isMuted ? 0 : volume]}
                max={100}
                step={1}
                onValueChange={(value) => {
                  setVolume(value[0])
                  if (value[0] > 0 && isMuted) {
                    setIsMuted(false)
                  }
                }}
                className="w-24"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

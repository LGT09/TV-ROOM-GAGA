"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Play, Download, Music, Loader2 } from 'lucide-react'
import type { ContentItem } from "@/lib/types"
import { useMusicPlayer } from "@/components/music-player-provider"
import { useDownloadManager } from "@/components/download-manager-provider"

interface MusicSectionProps {
  tracks: ContentItem[]
  title?: string
}

export function MusicSection({ tracks, title = "Music Library" }: MusicSectionProps) {
  const { playTrack, currentTrack } = useMusicPlayer()
  const { startDownload } = useDownloadManager()
  const [loadingTrack, setLoadingTrack] = useState<string | null>(null)

  const handlePlay = async (track: ContentItem) => {
    setLoadingTrack(track.id as string)
    try {
      await playTrack(track, tracks)
    } finally {
      setLoadingTrack(null)
    }
  }

  const handleDownload = (track: ContentItem) => {
    startDownload(track, "320kbps")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Music className="h-5 w-5" />
          {title}
        </CardTitle>
        <CardDescription>Play music online or download in MP3 format with actual file sizes</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          <div className="space-y-2">
            {tracks.map((track) => (
              <div
                key={track.id}
                className={`flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors ${
                  currentTrack?.id === track.id ? "bg-primary/10" : ""
                }`}
              >
                <img
                  src={track.imageUrl || "/placeholder.svg"}
                  alt={track.title}
                  className="w-12 h-12 rounded object-cover"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{track.title}</p>
                  <p className="text-sm text-muted-foreground truncate">{track.artist}</p>
                </div>
                <div className="text-sm text-muted-foreground">{track.duration}</div>
                <div className="flex gap-2">
                  <Button
                    size="icon"
                    variant={currentTrack?.id === track.id ? "default" : "outline"}
                    onClick={() => handlePlay(track)}
                    disabled={loadingTrack === track.id}
                  >
                    {loadingTrack === track.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                  <Button size="icon" variant="outline" onClick={() => handleDownload(track)}>
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Music, Trash2, Download, Video } from "lucide-react"
import { UniversalMediaPlayer } from "@/components/universal-media-player"
import type { ContentItem } from "@/lib/types"

interface DownloadedMedia {
  id: string
  content: ContentItem
  downloadedAt: Date
  fileSize: string
  quality: string
  localUrl?: string
}

export function MediaLibrary() {
  const [downloads, setDownloads] = useState<DownloadedMedia[]>([])
  const [activeMedia, setActiveMedia] = useState<ContentItem | null>(null)
  const [currentPlaylist, setCurrentPlaylist] = useState<ContentItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    // Load downloads from localStorage
    const stored = localStorage.getItem("tv-room-downloads")
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setDownloads(parsed)
      } catch (error) {
        console.error("[v0] Error loading downloads:", error)
      }
    }
  }, [])

  const musicDownloads = downloads.filter((d) => d.content.type === "music")
  const videoDownloads = downloads.filter(
    (d) => d.content.type === "movie" || d.content.type === "series" || d.content.type === "anime",
  )

  const handlePlayMedia = (media: DownloadedMedia, playlist: DownloadedMedia[]) => {
    const contentPlaylist = playlist.map((m) => ({
      ...m.content,
      localUrl: m.localUrl,
    }))
    setCurrentPlaylist(contentPlaylist)
    const index = playlist.findIndex((m) => m.id === media.id)
    setCurrentIndex(index)
    setActiveMedia(contentPlaylist[index])
  }

  const handleNext = () => {
    if (currentIndex < currentPlaylist.length - 1) {
      const nextIndex = currentIndex + 1
      setCurrentIndex(nextIndex)
      setActiveMedia(currentPlaylist[nextIndex])
    }
  }

  const handlePrevious = () => {
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1
      setCurrentIndex(prevIndex)
      setActiveMedia(currentPlaylist[prevIndex])
    }
  }

  const handleDelete = (id: string) => {
    const updated = downloads.filter((d) => d.id !== id)
    setDownloads(updated)
    localStorage.setItem("tv-room-downloads", JSON.stringify(updated))
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All ({downloads.length})</TabsTrigger>
          <TabsTrigger value="music">Music ({musicDownloads.length})</TabsTrigger>
          <TabsTrigger value="videos">Videos ({videoDownloads.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <MediaGrid items={downloads} onPlay={handlePlayMedia} onDelete={handleDelete} />
        </TabsContent>

        <TabsContent value="music" className="mt-6">
          <MediaGrid items={musicDownloads} onPlay={handlePlayMedia} onDelete={handleDelete} />
        </TabsContent>

        <TabsContent value="videos" className="mt-6">
          <MediaGrid items={videoDownloads} onPlay={handlePlayMedia} onDelete={handleDelete} />
        </TabsContent>
      </Tabs>

      {activeMedia && (
        <UniversalMediaPlayer
          content={activeMedia}
          onClose={() => {
            setActiveMedia(null)
            setCurrentPlaylist([])
            setCurrentIndex(0)
          }}
          playlist={currentPlaylist}
          onNext={currentIndex < currentPlaylist.length - 1 ? handleNext : undefined}
          onPrevious={currentIndex > 0 ? handlePrevious : undefined}
        />
      )}
    </div>
  )
}

function MediaGrid({
  items,
  onPlay,
  onDelete,
}: {
  items: DownloadedMedia[]
  onPlay: (media: DownloadedMedia, playlist: DownloadedMedia[]) => void
  onDelete: (id: string) => void
}) {
  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Download className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No downloaded media yet</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {items.map((media) => (
        <Card key={media.id} className="group hover:border-primary/50 transition-colors">
          <CardContent className="p-4 space-y-3">
            <div className="relative aspect-square rounded-lg overflow-hidden bg-muted">
              <img
                src={media.content.imageUrl || "/placeholder.svg"}
                alt={media.content.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <Button size="icon" variant="secondary" onClick={() => onPlay(media, items)}>
                  {media.content.type === "music" ? <Music className="h-4 w-4" /> : <Video className="h-4 w-4" />}
                </Button>
                <Button size="icon" variant="destructive" onClick={() => onDelete(media.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-sm line-clamp-2">{media.content.title}</h4>
              <p className="text-xs text-muted-foreground mt-1">
                {media.quality} • {media.fileSize}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

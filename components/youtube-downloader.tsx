"use client"

import { useState } from "react"
import { Download, Loader2, CheckCircle, XCircle, Music, Film, ExternalLink } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { extractVideoId, getVideoInfo } from "@/lib/api/youtube"
import { useDownloadManager } from "@/components/download-manager-provider"

export function YouTubeDownloader() {
  const [url, setUrl] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [videoInfo, setVideoInfo] = useState<any>(null)
  const [selectedFormat, setSelectedFormat] = useState<"mp3" | "mp4">("mp4")
  const [selectedQuality, setSelectedQuality] = useState("720p")
  const [error, setError] = useState<string>("")
  const [success, setSuccess] = useState(false)

  const handleFetchInfo = async () => {
    if (!url) return

    setIsLoading(true)
    setError("")
    setSuccess(false)
    setVideoInfo(null)

    const videoId = extractVideoId(url)

    if (!videoId) {
      setError("Invalid YouTube URL. Please enter a valid YouTube video URL.")
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch("/api/youtube-download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId,
          format: selectedFormat,
          quality: selectedFormat === "mp3" ? "320kbps" : selectedQuality,
          contentType: selectedFormat === "mp3" ? "audio" : "video",
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Failed to fetch video information.")
        setIsLoading(false)
        return
      }

      if (data.isShort) {
        setError("YouTube Shorts are not supported. Please use full-length videos only (longer than 60 seconds).")
        setIsLoading(false)
        return
      }

      setVideoInfo(data)
      console.log("[v0] Video info fetched:", data)
    } catch (err) {
      console.error("[v0] Error fetching video info:", err)
      setError("Failed to fetch video information. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDownload = (serviceIndex: number = 0) => {
    if (!videoInfo || !videoInfo.downloadServices) return

    const service = videoInfo.downloadServices[serviceIndex]
    
    // Open the download service in a new tab
    window.open(service.url, "_blank")

    // Save to download history
    try {
      const contentItem = {
        id: videoInfo.videoId,
        title: videoInfo.title,
        artist: videoInfo.author,
        type: selectedFormat === "mp3" ? ("music" as const) : ("movie" as const),
        imageUrl: videoInfo.thumbnail,
        duration: videoInfo.durationFormatted,
        videoUrl: videoInfo.watchUrl,
      }

      const downloads = JSON.parse(localStorage.getItem("tv-room-downloads") || "[]")
      downloads.push({
        id: `download-${Date.now()}-${videoInfo.videoId}`,
        content: contentItem,
        downloadedAt: new Date(),
        fileSize: videoInfo.actualSize,
        quality: selectedFormat === "mp3" ? "320kbps Audio" : selectedQuality,
        format: selectedFormat,
      })
      localStorage.setItem("tv-room-downloads", JSON.stringify(downloads))

      setSuccess(true)
      setTimeout(() => {
        setUrl("")
        setVideoInfo(null)
        setSuccess(false)
      }, 3000)
    } catch (error) {
      console.error("[v0] Error saving to history:", error)
    }
  }

  return (
    <Card className="border-primary/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5 text-primary" />
          YouTube Downloader - Full Quality
        </CardTitle>
        <CardDescription>
          Download complete videos (MP4) or audio (MP3) from YouTube with actual file sizes - No shorts, full packages only
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Paste YouTube URL here (e.g., https://youtube.com/watch?v=...)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleFetchInfo()}
            className="flex-1"
          />
          <Button onClick={handleFetchInfo} disabled={!url || isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Fetch Info"}
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
            <XCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 text-sm text-green-500 bg-green-500/10 p-3 rounded-lg">
            <CheckCircle className="h-4 w-4 flex-shrink-0" />
            <span>Download page opened! Select your preferred quality and download the full file.</span>
          </div>
        )}

        {videoInfo && (
          <div className="space-y-4 p-4 bg-muted rounded-lg border border-border">
            <div className="flex gap-4">
              <img
                src={videoInfo.thumbnail || "/placeholder.svg"}
                alt={videoInfo.title}
                className="w-40 h-24 object-cover rounded-lg"
              />
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm line-clamp-2">{videoInfo.title}</h4>
                <p className="text-xs text-muted-foreground mt-1">{videoInfo.author}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="secondary">{videoInfo.durationFormatted}</Badge>
                  <Badge variant="outline" className="font-mono">
                    {videoInfo.actualSize}
                  </Badge>
                  <Badge variant="outline">{videoInfo.bitrate}</Badge>
                </div>
              </div>
            </div>

            <Tabs value={selectedFormat} onValueChange={(v) => setSelectedFormat(v as "mp3" | "mp4")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="mp4">
                  <Film className="h-4 w-4 mr-2" />
                  Video (MP4)
                </TabsTrigger>
                <TabsTrigger value="mp3">
                  <Music className="h-4 w-4 mr-2" />
                  Audio (MP3)
                </TabsTrigger>
              </TabsList>

              <TabsContent value="mp4" className="space-y-3">
                <Select value={selectedQuality} onValueChange={setSelectedQuality}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select quality" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1080p">1080p Full HD - Highest Quality</SelectItem>
                    <SelectItem value="720p">720p HD - High Quality</SelectItem>
                    <SelectItem value="480p">480p SD - Standard Quality</SelectItem>
                    <SelectItem value="360p">360p - Low Quality</SelectItem>
                  </SelectContent>
                </Select>
              </TabsContent>

              <TabsContent value="mp3" className="space-y-3">
                <Select value={selectedQuality} onValueChange={setSelectedQuality}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select quality" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="320kbps">320 kbps - Maximum Quality</SelectItem>
                    <SelectItem value="192kbps">192 kbps - High Quality</SelectItem>
                    <SelectItem value="128kbps">128 kbps - Standard Quality</SelectItem>
                  </SelectContent>
                </Select>
              </TabsContent>
            </Tabs>

            <div className="space-y-2">
              <p className="text-sm font-semibold">Choose Download Service:</p>
              <div className="grid gap-2">
                {videoInfo.downloadServices?.map((service: any, index: number) => (
                  <Button
                    key={index}
                    variant="outline"
                    className="justify-start h-auto py-3"
                    onClick={() => handleDownload(index)}
                  >
                    <ExternalLink className="h-4 w-4 mr-3 flex-shrink-0" />
                    <div className="text-left">
                      <div className="font-semibold">{service.name}</div>
                      <div className="text-xs text-muted-foreground">{service.description}</div>
                    </div>
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground text-center pt-2">
                Each service will open in a new tab where you can download the full {selectedFormat.toUpperCase()} file at {videoInfo.actualSize}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

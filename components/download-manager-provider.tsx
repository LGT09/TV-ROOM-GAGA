"use client"
import { readApiJson } from "@/lib/client-json"

import type React from "react"
import { createContext, useContext, useState, useRef, useCallback } from "react"
import type { ContentItem } from "@/lib/types"

export interface DownloadItem {
  id: string
  content: ContentItem
  progress: number
  status: "downloading" | "completed" | "failed" | "paused" | "pending"
  downloadedAt?: Date
  fileSize?: string
  fileSizeBytes?: number
  quality?: string
  downloadUrl?: string
  speed?: string
  eta?: string
}

interface DownloadManagerContextType {
  downloads: DownloadItem[]
  activeDownloads: DownloadItem[]
  completedDownloads: DownloadItem[]
  startDownload: (content: ContentItem, quality?: string) => void
  pauseDownload: (id: string) => void
  resumeDownload: (id: string) => void
  cancelDownload: (id: string) => void
  removeDownload: (id: string) => void
  searchAndDownloadMovie: (title: string, quality?: string) => Promise<void>
  downloadYouTube: (url: string, format: "mp3" | "mp4", title?: string) => Promise<void>
  directDownload: (url: string, filename: string) => void
}

const DownloadManagerContext = createContext<DownloadManagerContextType | undefined>(undefined)

// Format bytes to human readable size
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes"
  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

// Estimate file size based on quality and duration
function estimateFileSize(durationMinutes: number, quality: string, type: "video" | "audio" | "music"): { display: string, bytes: number } {
  const bitrates: Record<string, number> = {
    // Video bitrates (Mbps)
    "2160p": 25,
    "4K": 25,
    "1080p": 8,
    "720p": 5,
    "480p": 2.5,
    "360p": 1,
    // Audio bitrates (Kbps -> converted to Mbps)
    "320kbps": 0.32,
    "256kbps": 0.256,
    "192kbps": 0.192,
    "128kbps": 0.128,
  }

  let bitrate = bitrates[quality] || 5
  
  // Audio/Music uses much lower bitrates
  if (type === "audio" || type === "music") {
    bitrate = bitrates["320kbps"] || 0.32
  }
  
  const durationSeconds = durationMinutes * 60
  const fileSizeMB = (bitrate * durationSeconds) / 8
  const fileSizeBytes = fileSizeMB * 1024 * 1024
  
  return {
    display: formatBytes(fileSizeBytes),
    bytes: fileSizeBytes
  }
}

// Parse duration string to minutes
function parseDuration(duration: string | undefined): number {
  if (!duration) return 120

  const hourMatch = duration.match(/(\d+)h/)
  const minMatch = duration.match(/(\d+)m/)
  const epMatch = duration.match(/(\d+)\s*ep/i)
  const minOnlyMatch = duration.match(/(\d+)\s*min/i)

  if (hourMatch || minMatch) {
    const hours = hourMatch ? Number.parseInt(hourMatch[1]) : 0
    const mins = minMatch ? Number.parseInt(minMatch[1]) : 0
    return hours * 60 + mins
  }

  if (minOnlyMatch) {
    return Number.parseInt(minOnlyMatch[1])
  }

  if (epMatch) {
    return Number.parseInt(epMatch[1]) * 45
  }

  // Handle MM:SS format
  const timeMatch = duration.match(/(\d+):(\d+)/)
  if (timeMatch) {
    return parseInt(timeMatch[1]) + parseInt(timeMatch[2]) / 60
  }

  const plainMin = duration.match(/(\d+)/)
  if (plainMin) {
    return Number.parseInt(plainMin[1])
  }

  return 120
}

export function DownloadManagerProvider({ children }: { children: React.ReactNode }) {
  const [downloads, setDownloads] = useState<DownloadItem[]>([])
  const intervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

  // Direct download - triggers browser download by opening in new tab
  const directDownload = useCallback((url: string, filename: string) => {
    // Open URL in new tab for immediate download - faster than creating anchor
    window.open(url, "_blank")
  }, [])

  // Download YouTube video/audio
  const downloadYouTube = useCallback(async (url: string, format: "mp3" | "mp4", title?: string) => {
    try {
      const action = format === "mp3" ? "download-mp3" : "download-mp4"
      const response = await fetch(`/api/music?action=${action}&url=${encodeURIComponent(url)}`)
      const data = await readApiJson(response)

      if (data.success && data.downloadUrl) {
        // Trigger direct download to user's device
        directDownload(data.downloadUrl, `${title || "download"}.${format}`)
        
        alert(
          `Download Started!\n\n` +
          `Title: ${data.title || title || "Media"}\n` +
          `Format: ${format.toUpperCase()}\n` +
          `Quality: ${data.quality || "Best"}\n` +
          `Size: ${data.size || "N/A"}\n\n` +
          `File will be saved to your device's download folder.`
        )
      } else {
        // Try YouTube API as fallback
        const ytResponse = await fetch(`/api/youtube?action=download&url=${encodeURIComponent(url)}&format=${format}`)
        const ytData = await readApiJson(ytResponse)
        
        if (ytData.success && ytData.downloadUrl) {
          directDownload(ytData.downloadUrl, `${title || "download"}.${format}`)
          alert(
            `Download Started!\n\n` +
            `Title: ${ytData.title || title || "Media"}\n` +
            `Format: ${format.toUpperCase()}\n` +
            `Size: ${ytData.size || "N/A"}`
          )
        } else {
          alert("Could not get download link. Please try again.")
        }
      }
    } catch (error) {
      alert("Download failed. Please try again.")
    }
  }, [directDownload])

  // Search and download movie
  const searchAndDownloadMovie = useCallback(async (title: string, quality = "720p") => {
    try {
      // Search movies
      const response = await fetch(`/api/movie-download?action=search&query=${encodeURIComponent(title)}&limit=5`)
      const data = await readApiJson(response)

      if (!data.success && data.error) {
        alert(`Search failed: ${data.error}`)
        return
      }

      if (data.results && data.results.length > 0) {
        const movie = data.results[0]
        
        // If movie has a download URL, get the actual download link
        if (movie.downloadUrl) {
          const downloadResponse = await fetch(
            `/api/movie-download?action=download&url=${encodeURIComponent(movie.downloadUrl)}`
          )
          const downloadData = await readApiJson(downloadResponse)

          if (downloadData.success && downloadData.downloadUrl) {
            // Trigger direct download to user's device
            const filename = `${movie.title} (${movie.year || ""})-${quality}.mp4`
              .replace(/[/\\?%*:|"<>]/g, "-")
            
            directDownload(downloadData.downloadUrl, filename)
            
            alert(
              `Download Started!\n\n` +
              `Title: ${movie.title}\n` +
              `Year: ${movie.year || "N/A"}\n` +
              `Quality: ${downloadData.quality || movie.quality || quality}\n` +
              `Size: ${downloadData.size || movie.size || "N/A"}\n` +
              `Source: ${downloadData.source || movie.source}\n\n` +
              `File will be saved to your device's download folder.`
            )
            return
          }
        }
        
        // If we have a direct URL, open it
        if (movie.downloadUrl) {
          window.open(movie.downloadUrl, "_blank")
          alert(
            `Movie Found: ${movie.title}\n\n` +
            `Year: ${movie.year || "N/A"}\n` +
            `Quality: ${movie.quality || "HD"}\n` +
            `Size: ${movie.size || "N/A"}\n\n` +
            `Opening download page in new tab...`
          )
          return
        }
        
        alert(
          `Movie Found: ${movie.title}\n\n` +
          `Year: ${movie.year || "N/A"}\n` +
          `Quality: ${movie.quality || "HD"}\n\n` +
          `Click on the movie card to view download options.`
        )
      } else {
        alert(`No results found for: ${title}\n\nTry a different search term or check your spelling.`)
      }
    } catch (error) {
      alert("Failed to search for movie. Please check your connection and try again.")
    }
  }, [directDownload])

  // Start simulated download with progress tracking
  const startDownload = useCallback((content: ContentItem, quality = "720p") => {
    const durationMinutes = parseDuration(content.duration)
    const type = content.type === "music" ? "audio" : "video"
    const { display: fileSize, bytes: fileSizeBytes } = estimateFileSize(durationMinutes, quality, type)

    const newDownload: DownloadItem = {
      id: `download-${Date.now()}-${content.id}`,
      content,
      progress: 0,
      status: "downloading",
      fileSize,
      fileSizeBytes,
      quality,
    }

    setDownloads((prev) => [newDownload, ...prev])

    let progress = 0
    let downloadedBytes = 0
    const totalBytes = fileSizeBytes
    const startTime = Date.now()
    
    const interval = setInterval(() => {
      const increment = Math.random() * 12 + 3
      progress = Math.min(progress + increment, 100)
      downloadedBytes = (progress / 100) * totalBytes
      
      // Calculate speed and ETA
      const elapsedSeconds = (Date.now() - startTime) / 1000
      const speedBps = downloadedBytes / elapsedSeconds
      const remainingBytes = totalBytes - downloadedBytes
      const etaSeconds = speedBps > 0 ? remainingBytes / speedBps : 0

      if (progress >= 100) {
        clearInterval(interval)
        intervalsRef.current.delete(newDownload.id)
        
        setDownloads((prev) =>
          prev.map((d) =>
            d.id === newDownload.id
              ? { 
                  ...d, 
                  progress: 100, 
                  status: "completed" as const, 
                  downloadedAt: new Date(),
                  speed: undefined,
                  eta: undefined
                }
              : d,
          ),
        )

        alert(
          `Download Complete!\n\n` +
          `Title: ${content.title}\n` +
          `Type: ${content.type.toUpperCase()}\n` +
          `Quality: ${quality}\n` +
          `File Size: ${fileSize}\n` +
          `Duration: ${content.duration || "N/A"}\n\n` +
          `File saved successfully!`
        )
      } else {
        setDownloads((prev) => 
          prev.map((d) => 
            d.id === newDownload.id 
              ? { 
                  ...d, 
                  progress,
                  speed: formatBytes(speedBps) + "/s",
                  eta: etaSeconds > 0 ? `${Math.ceil(etaSeconds)}s remaining` : "Calculating..."
                } 
              : d
          )
        )
      }
    }, 800)

    intervalsRef.current.set(newDownload.id, interval)
  }, [])

  const pauseDownload = useCallback((id: string) => {
    const interval = intervalsRef.current.get(id)
    if (interval) {
      clearInterval(interval)
      intervalsRef.current.delete(id)
    }

    setDownloads((prev) =>
      prev.map((download) => 
        download.id === id 
          ? { ...download, status: "paused" as const, speed: undefined, eta: undefined } 
          : download
      ),
    )
  }, [])

  const resumeDownload = useCallback((id: string) => {
    const download = downloads.find((d) => d.id === id)
    if (download && download.status === "paused") {
      // Resume from current progress
      let progress = download.progress
      const totalBytes = download.fileSizeBytes || 0
      const startTime = Date.now()
      
      setDownloads((prev) =>
        prev.map((d) => (d.id === id ? { ...d, status: "downloading" as const } : d))
      )
      
      const interval = setInterval(() => {
        const increment = Math.random() * 12 + 3
        progress = Math.min(progress + increment, 100)
        const downloadedBytes = (progress / 100) * totalBytes
        
        const elapsedSeconds = (Date.now() - startTime) / 1000
        const speedBps = downloadedBytes / elapsedSeconds
        const remainingBytes = totalBytes - downloadedBytes
        const etaSeconds = speedBps > 0 ? remainingBytes / speedBps : 0

        if (progress >= 100) {
          clearInterval(interval)
          intervalsRef.current.delete(id)
          
          setDownloads((prev) =>
            prev.map((d) =>
              d.id === id
                ? { ...d, progress: 100, status: "completed" as const, downloadedAt: new Date() }
                : d,
            ),
          )
        } else {
          setDownloads((prev) => 
            prev.map((d) => 
              d.id === id 
                ? { 
                    ...d, 
                    progress,
                    speed: formatBytes(speedBps) + "/s",
                    eta: etaSeconds > 0 ? `${Math.ceil(etaSeconds)}s remaining` : "Calculating..."
                  } 
                : d
            )
          )
        }
      }, 800)

      intervalsRef.current.set(id, interval)
    }
  }, [downloads])

  const cancelDownload = useCallback((id: string) => {
    const interval = intervalsRef.current.get(id)
    if (interval) {
      clearInterval(interval)
      intervalsRef.current.delete(id)
    }

    setDownloads((prev) => prev.filter((download) => download.id !== id))
  }, [])

  const removeDownload = useCallback((id: string) => {
    setDownloads((prev) => prev.filter((download) => download.id !== id))
  }, [])

  const activeDownloads = downloads.filter((d) => d.status === "downloading" || d.status === "paused")
  const completedDownloads = downloads.filter((d) => d.status === "completed")

  return (
    <DownloadManagerContext.Provider
      value={{
        downloads,
        activeDownloads,
        completedDownloads,
        startDownload,
        pauseDownload,
        resumeDownload,
        cancelDownload,
        removeDownload,
        searchAndDownloadMovie,
        downloadYouTube,
        directDownload,
      }}
    >
      {children}
    </DownloadManagerContext.Provider>
  )
}

export function useDownloadManager() {
  const context = useContext(DownloadManagerContext)
  if (context === undefined) {
    throw new Error("useDownloadManager must be used within a DownloadManagerProvider")
  }
  return context
}

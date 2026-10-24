"use client"

import { useState, useEffect } from "react"
import { Play, Download, Clock, HardDrive, Film, Search, Loader2, ExternalLink, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import type { ContentItem } from "@/lib/types"

interface MovieSearchResult {
  id: string
  title: string
  year: string
  type: string
  poster: string
  downloadUrl: string
  quality: string
  size: string
  duration?: string
  source: "tvroom" | string
}

interface MovieActionModalProps {
  item: ContentItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onWatch: (item: ContentItem) => void
  onDownload: (item: ContentItem, quality: string) => void
}

export function MovieActionModal({ item, open, onOpenChange, onWatch, onDownload }: MovieActionModalProps) {
  const [searchResults, setSearchResults] = useState<MovieSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null)

  // Auto-search when modal opens with a movie
  useEffect(() => {
    if (open && item) {
      setSearchQuery(item.title)
      setSearchResults([])
      setShowSearchResults(false)
      setDownloadingId(null)
      setDownloadSuccess(null)
      // Automatically search for the movie
      autoSearchMovie(item.title)
    }
  }, [item, open])

  // Auto-search function that runs when modal opens
  const autoSearchMovie = async (title: string) => {
    if (!title.trim()) return

    setIsSearching(true)
    try {
      const response = await fetch(
        `/api/movie-download?action=search&query=${encodeURIComponent(title)}&limit=8`
      )
      const data = await response.json()

      if (data.success && data.results && data.results.length > 0) {
        setSearchResults(data.results)
        setShowSearchResults(true)
      } else {
        setSearchResults([])
        setShowSearchResults(true)
      }
    } catch {
      setSearchResults([])
      setShowSearchResults(true)
    } finally {
      setIsSearching(false)
    }
  }

  // Manual search
  const searchMovies = async (query: string) => {
    if (!query.trim()) return
    setDownloadingId(null)
    setDownloadSuccess(null)
    autoSearchMovie(query)
  }

  // Handle download - get direct download link and trigger browser download
  const handleMovieDownload = async (movie: MovieSearchResult) => {
    if (!movie.downloadUrl) return

    setDownloadingId(movie.id)
    setDownloadSuccess(null)

    try {
      // First, resolve the direct download link via our API
      const response = await fetch(
        `/api/movie-download?action=download&url=${encodeURIComponent(movie.downloadUrl)}`,
        { cache: "no-store" }
      )
      const data = await response.json()

      if (data.success && data.downloadUrl) {
        // Trigger actual browser download immediately
        triggerDownload(data.downloadUrl, data.filename || `${movie.title}.mp4`)
        setDownloadSuccess(movie.id)
        setDownloadingId(null)
        return
      }
    } catch {
      // fall through to direct URL
    }

    // Fallback: use original download URL directly
    triggerDownload(movie.downloadUrl, `${movie.title}.mp4`)
    setDownloadSuccess(movie.id)
    setDownloadingId(null)
  }

  // Trigger actual file download to user's device
  const triggerDownload = (url: string, filename: string) => {
    // Open in new tab for immediate download
    window.open(url, "_blank")
  }

  const handleWatch = () => {
    if (item) {
      onWatch(item)
      onOpenChange(false)
    }
  }

  if (!item) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Film className="h-6 w-6 text-primary" />
            {item.title}
          </DialogTitle>
          <DialogDescription>Choose how you want to enjoy this {item.type}</DialogDescription>
        </DialogHeader>

        {/* Movie Info */}
        <div className="space-y-4">
          <div className="relative aspect-video rounded-lg overflow-hidden">
            <img src={item.imageUrl || "/placeholder.svg"} alt={item.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4">
              <div className="flex items-center gap-2 flex-wrap">
                {item.year && <Badge variant="secondary">{item.year}</Badge>}
                {item.duration && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {item.duration}
                  </Badge>
                )}
                {item.rating && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    {"*"} {item.rating.toFixed(1)}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {item.description && <p className="text-sm text-muted-foreground line-clamp-3">{item.description}</p>}

          <Separator />

          {/* Watch Online Section */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Play className="h-5 w-5 text-primary" />
              Watch Online
            </h3>
            <p className="text-sm text-muted-foreground">
              Stream the trailer or preview instantly in your browser. No download required.
            </p>
            <Button onClick={handleWatch} className="w-full" size="lg">
              <Play className="h-5 w-5 mr-2" />
              Watch Trailer Now
            </Button>
          </div>

          <Separator />

          {/* Movie Search & Download Section */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              Download Movie
            </h3>
            <p className="text-sm text-muted-foreground">
              {isSearching
                ? "Searching for download links..."
                : searchResults.length > 0
                  ? `Found ${searchResults.length} download option${searchResults.length > 1 ? "s" : ""} for this movie.`
                  : "Search for a downloadable version of this movie."}
            </p>

            <div className="flex gap-2">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchMovies(searchQuery)}
                placeholder="Search movie title..."
                className="flex-1"
              />
              <Button onClick={() => searchMovies(searchQuery)} disabled={isSearching}>
                {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>

            {/* Loading state */}
            {isSearching && (
              <div className="flex items-center justify-center py-6 gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">
                  Searching for &quot;{searchQuery}&quot;...
                </span>
              </div>
            )}

            {/* Search Results */}
            {showSearchResults && !isSearching && searchResults.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {searchResults.map((movie, index) => (
                  <div
                    key={movie.id || index}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/50 transition-colors"
                  >
                    {movie.poster && (
                      <img
                        src={movie.poster}
                        alt={movie.title}
                        className="w-12 h-16 object-cover rounded"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{movie.title}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        {movie.year && <span>{movie.year}</span>}
                        {movie.quality && <Badge variant="outline" className="text-xs">{movie.quality}</Badge>}
                        {movie.size && (
                          <span className="flex items-center gap-0.5">
                            <HardDrive className="h-3 w-3" />
                            {movie.size}
                          </span>
                        )}
                        {movie.duration && <span>{movie.duration}</span>}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleMovieDownload(movie)}
                      disabled={downloadingId === movie.id}
                      className="shrink-0"
                    >
                      {downloadingId === movie.id ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          Wait...
                        </>
                      ) : downloadSuccess === movie.id ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Done
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {showSearchResults && !isSearching && searchResults.length === 0 && (
              <div className="text-center py-4 space-y-2">
                <p className="text-sm text-muted-foreground">
                  No download links found for &quot;{searchQuery}&quot;.
                </p>
                <p className="text-xs text-muted-foreground">
                  Try a different search term or check the spelling.
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

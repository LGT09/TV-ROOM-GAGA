"use client"

import { useState } from "react"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { ContentItem } from "@/lib/types"

export interface QualityOption {
  label: string
  quality: string
  size: string
  resolution?: string
}

interface DownloadQualitySelectorProps {
  item: ContentItem
  open: boolean
  onOpenChange: (open: boolean) => void
  onDownload: (item: ContentItem, quality: string) => void
}

export function DownloadQualitySelector({ item, open, onOpenChange, onDownload }: DownloadQualitySelectorProps) {
  const [selectedQuality, setSelectedQuality] = useState<string>("720p")

  const getQualityOptions = (): QualityOption[] => {
    if (item.type === "music") {
      return [
        { label: "High Quality", quality: "high", size: "~3-5 MB", resolution: "256 kbps" },
        { label: "Standard Quality", quality: "standard", size: "~2-3 MB", resolution: "128 kbps" },
      ]
    } else if (item.type === "movie" || item.type === "series" || item.type === "anime") {
      // For trailers (typically 2-3 minutes)
      return [
        { label: "1080p Full HD", quality: "1080p", size: "~80-120 MB", resolution: "1920x1080" },
        { label: "720p HD", quality: "720p", size: "~40-60 MB", resolution: "1280x720" },
        { label: "480p SD", quality: "480p", size: "~20-30 MB", resolution: "854x480" },
        { label: "360p", quality: "360p", size: "~10-15 MB", resolution: "640x360" },
      ]
    }
    return []
  }

  const qualityOptions = getQualityOptions()

  const handleDownload = () => {
    onDownload(item, selectedQuality)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select Download Quality</DialogTitle>
          <DialogDescription>Choose the quality for downloading {item.title}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {qualityOptions.map((option) => (
            <button
              key={option.quality}
              onClick={() => setSelectedQuality(option.quality)}
              className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                selectedQuality === option.quality
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">{option.label}</p>
                  {option.resolution && <p className="text-sm text-muted-foreground">{option.resolution}</p>}
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-muted-foreground">{option.size}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleDownload} className="flex-1">
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

"use client"

import { Pause, Play, X, Trash2, CheckCircle2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import type { DownloadItem } from "./download-manager-provider"

interface DownloadItemCardProps {
  download: DownloadItem
  onPause?: (id: string) => void
  onResume?: (id: string) => void
  onCancel?: (id: string) => void
  onRemove?: (id: string) => void
}

export function DownloadItemCard({ download, onPause, onResume, onCancel, onRemove }: DownloadItemCardProps) {
  const { content, progress, status, downloadedAt, fileSize, quality, speed, eta } = download

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-16 h-16 bg-muted rounded overflow-hidden flex-shrink-0">
          <img
            src={content.imageUrl || "/placeholder.svg"}
            alt={content.title}
            className="w-full h-full object-cover"
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-foreground truncate">{content.title}</h3>
              {content.artist && <p className="text-sm text-muted-foreground truncate">{content.artist}</p>}
              {quality && (
                <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded">
                  {quality}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {status === "downloading" && (
                <>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onPause?.(download.id)}>
                    <Pause className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onCancel?.(download.id)}>
                    <X className="h-4 w-4" />
                  </Button>
                </>
              )}

              {status === "paused" && (
                <>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onResume?.(download.id)}>
                    <Play className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onCancel?.(download.id)}>
                    <X className="h-4 w-4" />
                  </Button>
                </>
              )}

              {status === "completed" && (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onRemove?.(download.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}

              {status === "failed" && (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onRemove?.(download.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="mt-2 space-y-2">
            {(status === "downloading" || status === "paused") && (
              <>
                <Progress value={progress} className="h-2" />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span>
                      {status === "paused" ? "Paused" : "Downloading"} - {Math.round(progress)}%
                    </span>
                    {speed && status === "downloading" && (
                      <span className="text-primary font-medium">{speed}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {eta && status === "downloading" && (
                      <span className="text-muted-foreground">{eta}</span>
                    )}
                    {fileSize && <span className="font-medium">{fileSize}</span>}
                  </div>
                </div>
              </>
            )}

            {status === "completed" && (
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                <span>Download completed</span>
                {downloadedAt && (
                  <span className="text-muted-foreground">
                    • {downloadedAt.toLocaleDateString()} {downloadedAt.toLocaleTimeString()}
                  </span>
                )}
              </div>
            )}

            {status === "failed" && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>Download failed</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

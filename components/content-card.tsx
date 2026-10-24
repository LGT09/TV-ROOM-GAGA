"use client"

import { useState, lazy, Suspense, useRef } from "react"
import { Download, Play, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ContentItem } from "@/lib/types"
export type { ContentItem } from "@/lib/types"

const DownloadQualitySelector = lazy(() =>
  import("@/components/download-quality-selector").then((mod) => ({ default: mod.DownloadQualitySelector })),
)
interface ContentCardProps {
  item: ContentItem
  onPlay?: (item: ContentItem) => void
  onDownload?: (item: ContentItem, quality?: string) => void
}

export function ContentCard({ item, onPlay, onDownload }: ContentCardProps) {
  const [showQualitySelector, setShowQualitySelector] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const [transform, setTransform] = useState({ rotateX: 0, rotateY: 0 })

  // 3D tilt effect on mouse move
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    const rotateX = ((y - centerY) / centerY) * -8
    const rotateY = ((x - centerX) / centerX) * 8
    setTransform({ rotateX, rotateY })
  }

  const handleMouseLeave = () => {
    setTransform({ rotateX: 0, rotateY: 0 })
  }

  const handleDownloadClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (item.type === "movie" || item.type === "series" || item.type === "anime") onDownload?.(item)
    else setShowQualitySelector(true)
  }

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onPlay?.(item)
  }

  const handleCardClick = () => {
    onPlay?.(item)
  }

  const handleDownloadWithQuality = (item: ContentItem, quality: string) => {
    onDownload?.(item, quality)
  }

  return (
    <>
      <div
        ref={cardRef}
        onClick={handleCardClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="group relative cursor-pointer"
        style={{
          perspective: "1000px",
          transformStyle: "preserve-3d",
        }}
      >
        <div
          className="relative rounded-xl overflow-hidden bg-card border border-white/5 transition-all duration-300 ease-out group-hover:border-primary/30 group-hover:shadow-xl group-hover:shadow-primary/10"
          style={{
            transform: `rotateX(${transform.rotateX}deg) rotateY(${transform.rotateY}deg) scale(${transform.rotateX !== 0 || transform.rotateY !== 0 ? 1.02 : 1})`,
            transformStyle: "preserve-3d",
            transition: "transform 0.15s ease-out, border-color 0.3s, box-shadow 0.3s",
          }}
        >
          {/* Image Container */}
          <div className="relative aspect-[2/3] overflow-hidden">
            <img
              src={item.imageUrl || "/placeholder.svg"}
              alt={item.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              loading="lazy"
            />
            
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-300" />
            
            {/* Neon glow on hover */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
              <div className="absolute inset-0 bg-gradient-to-t from-primary/20 via-transparent to-transparent" />
            </div>
            
            {/* Rating Badge */}
            {item.rating && (
              <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-md bg-black/60 backdrop-blur-sm border border-white/10">
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                <span className="text-xs font-semibold text-white">{item.rating.toFixed(1)}</span>
              </div>
            )}

            {/* Type Badge */}
            <div className="absolute top-2 right-2 px-2 py-1 rounded-md bg-primary/80 backdrop-blur-sm text-[10px] font-bold uppercase tracking-wider text-white">
              {item.type}
            </div>
            
            {/* Action Buttons - Floating */}
            <div className="absolute inset-0 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-4 group-hover:translate-y-0">
              <Button
                size="icon"
                onClick={handlePlayClick}
                className="h-12 w-12 rounded-full bg-primary/90 hover:bg-primary text-white shadow-lg shadow-primary/30 backdrop-blur-sm border border-white/20 transition-all duration-300 hover:scale-110"
              >
                <Play className="h-5 w-5 fill-current" />
              </Button>
              <Button
                size="icon"
                onClick={handleDownloadClick}
                className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm border border-white/20 transition-all duration-300 hover:scale-110"
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>

            {/* Bottom Info */}
            <div className="absolute bottom-0 left-0 right-0 p-3 transform translate-y-0 group-hover:translate-y-0 transition-transform duration-300">
              <h3 className="font-semibold text-white text-sm line-clamp-1 drop-shadow-lg">
                {item.title}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                {item.year && (
                  <span className="text-xs text-white/70">{item.year}</span>
                )}
                {item.duration && (
                  <>
                    <span className="text-white/40">•</span>
                    <span className="text-xs text-white/70">{item.duration}</span>
                  </>
                )}
              </div>
              {item.artist && (
                <p className="text-xs text-white/60 mt-1 line-clamp-1">{item.artist}</p>
              )}
            </div>
          </div>
        </div>

        {/* Reflection effect */}
        <div 
          className="absolute -bottom-4 left-2 right-2 h-8 opacity-0 group-hover:opacity-30 transition-opacity duration-500 blur-sm"
          style={{
            background: "linear-gradient(to bottom, var(--primary), transparent)",
            transform: "scaleY(-0.3) translateY(-100%)",
            borderRadius: "0 0 12px 12px",
          }}
        />
      </div>

      {showQualitySelector && (
        <Suspense fallback={null}>
          <DownloadQualitySelector
            item={item}
            open={showQualitySelector}
            onOpenChange={setShowQualitySelector}
            onDownload={handleDownloadWithQuality}
          />
        </Suspense>
      )}
    </>
  )
}

"use client"

import { useRef, useState } from "react"
import { ContentCard } from "./content-card"
import type { ContentItem } from "@/lib/types"
import { ChevronRight, ChevronLeft } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

interface ContentSectionProps {
  title: string
  items: ContentItem[]
  viewAllHref?: string
  onPlay?: (item: ContentItem) => void
  onDownload?: (item: ContentItem, quality?: string) => void
}

export function ContentSection({ title, items, viewAllHref, onPlay, onDownload }: ContentSectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
      setCanScrollLeft(scrollLeft > 0)
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10)
    }
  }

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = scrollRef.current.clientWidth * 0.75
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      })
      setTimeout(checkScroll, 350)
    }
  }

  if (!items || items.length === 0) return null

  return (
    <section className="relative group py-4 md:py-6">
      {/* Section Header with neon glow */}
      <div className="flex items-center justify-between mb-4 md:mb-6 px-1">
        <div className="relative">
          <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-foreground tracking-tight">
            {title}
          </h2>
          <div className="absolute -bottom-1 left-0 h-0.5 w-12 md:w-16 bg-gradient-to-r from-primary via-primary/50 to-transparent rounded-full" />
        </div>
        
        <div className="flex items-center gap-2">
          {viewAllHref && (
            <Link 
              href={viewAllHref} 
              className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors mr-2"
            >
              View All
              <ChevronRight className="h-4 w-4" />
            </Link>
          )}
          
          {/* Navigation Arrows */}
          <div className="hidden md:flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <Button
              variant="outline"
              size="icon"
              onClick={() => scroll("left")}
              disabled={!canScrollLeft}
              className="h-9 w-9 rounded-full border-white/10 bg-black/40 backdrop-blur-sm hover:border-primary/50 hover:bg-primary/20 disabled:opacity-20 transition-all duration-300"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => scroll("right")}
              disabled={!canScrollRight}
              className="h-9 w-9 rounded-full border-white/10 bg-black/40 backdrop-blur-sm hover:border-primary/50 hover:bg-primary/20 disabled:opacity-20 transition-all duration-300"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Horizontal Scrolling Content */}
      <div className="relative">
        {/* Left Gradient Mask */}
        <div className="absolute left-0 top-0 bottom-0 w-8 md:w-12 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
        {/* Right Gradient Mask */}
        <div className="absolute right-0 top-0 bottom-0 w-8 md:w-12 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
        
        {/* Scrollable Container */}
        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex gap-3 md:gap-4 overflow-x-auto scrollbar-hide pb-4 px-1 scroll-smooth"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {items.map((item, index) => (
            <div
              key={item.id}
              className="flex-shrink-0 w-[140px] sm:w-[160px] md:w-[180px] lg:w-[200px] scroll-snap-start"
              style={{
                animationDelay: `${index * 50}ms`,
              }}
            >
              <ContentCard 
                item={item} 
                onPlay={onPlay} 
                onDownload={onDownload}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

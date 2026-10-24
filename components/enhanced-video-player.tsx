"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Download, X, Star, Clock, Calendar, Film, Tv, Users, List, Play, Compass } from "lucide-react"
import type { ContentItem } from "@/lib/types"
import { getTVSeriesDetails, getSeasonDetails } from "@/lib/api/tmdb"
import Link from "next/link"

interface EnhancedVideoPlayerProps {
  content: ContentItem
  onClose: () => void
}

interface SeasonData {
  seasonNumber: number
  episodes: any[]
}

export function EnhancedVideoPlayer({ content, onClose }: EnhancedVideoPlayerProps) {
  const [seriesDetails, setSeriesDetails] = useState<any>(null)
  const [selectedSeason, setSelectedSeason] = useState<number>(1)
  const [seasonData, setSeasonData] = useState<SeasonData | null>(null)
  const [loadingSeasons, setLoadingSeasons] = useState(false)
  useEffect(() => {
    async function fetchSeriesDetails() {
      if (content.type === "series") {
        setLoadingSeasons(true)
        try {
          const details = await getTVSeriesDetails(content.id as number)
          if (details) {
            setSeriesDetails(details)
            console.log("[v0] Series details loaded:", {
              name: details.name,
              seasons: details.number_of_seasons,
              episodes: details.number_of_episodes,
            })
          }
        } catch (error) {
          console.error("[v0] Error fetching series details:", error)
        } finally {
          setLoadingSeasons(false)
        }
      }
    }
    fetchSeriesDetails()
  }, [content])

  useEffect(() => {
    async function fetchSeasonEpisodes() {
      if (seriesDetails && selectedSeason) {
        try {
          const season = await getSeasonDetails(content.id as number, selectedSeason)
          if (season) {
            setSeasonData({
              seasonNumber: selectedSeason,
              episodes: season.episodes || [],
            })
          }
        } catch (error) {
          console.error("[v0] Error fetching season episodes:", error)
        }
      }
    }
    fetchSeasonEpisodes()
  }, [seriesDetails, selectedSeason, content.id])

  const handleDownload = (quality: string) => {
    void quality
    window.location.assign("/discover")
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-2xl">{content.title}</DialogTitle>
              {content.artist && <p className="text-muted-foreground mt-1">{content.artist}</p>}
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Video Player */}
          <div className="aspect-video glass rounded-2xl flex flex-col items-center justify-center gap-4 p-6 text-center">
            <p className="font-display text-2xl">Find a full stream source</p>
            <p className="max-w-md text-sm text-muted-foreground">Open the movie library to choose a season, episode, and an available playback or download quality.</p>
            <Link href={`/discover?q=${encodeURIComponent(content.title)}`} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"><Compass className="h-4 w-4"/>Open discovery</Link>
            </div>

          {/* Content Info */}
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              {content.type && (
                <Badge variant="secondary">
                  {content.type === "movie" ? (
                    <>
                      <Film className="h-3 w-3 mr-1" />
                      Movie
                    </>
                  ) : content.type === "series" ? (
                    <>
                      <Tv className="h-3 w-3 mr-1" />
                      Series
                    </>
                  ) : (
                    content.type
                  )}
                </Badge>
              )}
              {content.rating && (
                <Badge variant="outline">
                  <Star className="h-3 w-3 mr-1 fill-yellow-500 text-yellow-500" />
                  {content.rating.toFixed(1)}
                </Badge>
              )}
              {content.year && (
                <Badge variant="outline">
                  <Calendar className="h-3 w-3 mr-1" />
                  {content.year}
                </Badge>
              )}
              {content.duration && (
                <Badge variant="outline">
                  <Clock className="h-3 w-3 mr-1" />
                  {content.duration}
                </Badge>
              )}
            </div>

            {content.type === "series" && (
              <div className="bg-muted/50 p-4 rounded-lg space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <List className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Seasons & Episodes</h3>
                </div>

                {loadingSeasons ? (
                  <p className="text-sm text-muted-foreground">Loading series information...</p>
                ) : seriesDetails ? (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="bg-background p-3 rounded-lg">
                        <p className="text-muted-foreground">Total Seasons</p>
                        <p className="text-2xl font-bold text-primary">{seriesDetails.number_of_seasons || "N/A"}</p>
                      </div>
                      <div className="bg-background p-3 rounded-lg">
                        <p className="text-muted-foreground">Total Episodes</p>
                        <p className="text-2xl font-bold text-primary">{seriesDetails.number_of_episodes || "N/A"}</p>
                      </div>
                      <div className="bg-background p-3 rounded-lg">
                        <p className="text-muted-foreground">Episode Runtime</p>
                        <p className="text-2xl font-bold text-primary">
                          {seriesDetails.episode_run_time?.[0] ? `${seriesDetails.episode_run_time[0]}m` : "~45m"}
                        </p>
                      </div>
                      <div className="bg-background p-3 rounded-lg">
                        <p className="text-muted-foreground">Status</p>
                        <p className="text-lg font-semibold">{seriesDetails.status || "Ongoing"}</p>
                      </div>
                    </div>

                    {/* Season Selector */}
                    {seriesDetails.seasons && seriesDetails.seasons.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                          {seriesDetails.seasons
                            .filter((s: any) => s.season_number > 0)
                            .map((season: any) => (
                              <Button
                                key={season.season_number}
                                variant={selectedSeason === season.season_number ? "default" : "outline"}
                                size="sm"
                                onClick={() => setSelectedSeason(season.season_number)}
                              >
                                Season {season.season_number}
                                <Badge variant="secondary" className="ml-2">
                                  {season.episode_count} eps
                                </Badge>
                              </Button>
                            ))}
                        </div>

                        {/* Episode List */}
                        {seasonData && seasonData.episodes.length > 0 && (
                          <div className="max-h-48 overflow-y-auto space-y-2">
                            {seasonData.episodes.map((episode: any) => (
                              <div
                                key={episode.id}
                                className="flex items-center justify-between bg-background p-3 rounded-lg"
                              >
                                <div className="flex-1">
                                  <p className="font-medium">
                                    E{episode.episode_number}: {episode.name}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {episode.runtime ? `${episode.runtime}m` : "~45m"} | {episode.air_date || "TBA"}
                                  </p>
                                </div>
                                <Button size="sm" variant="ghost">
                                  <Play className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-semibold">Seasons:</span> {content.seasons || "N/A"}
                    </div>
                    <div>
                      <span className="font-semibold">Episodes:</span> {content.episodes || "N/A"}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Genres */}
            {content.genres && content.genres.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {content.genres.map((genre, index) => (
                  <Badge key={index} variant="secondary">
                    {typeof genre === "string" ? genre : (genre as any)?.name ?? String(genre)}
                  </Badge>
                ))}
              </div>
            )}

            {/* Description */}
            {content.description && (
              <div>
                <h3 className="font-semibold mb-2">Overview</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{content.description}</p>
              </div>
            )}

            {/* Cast */}
            {content.cast && content.cast.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Cast
                </h3>
                <div className="flex flex-wrap gap-2">
                  {content.cast.slice(0, 8).map((actor) => (
                    <Badge key={actor.name} variant="outline">
                      {actor.name} {actor.character ? `as ${actor.character}` : ""}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Download className="h-5 w-5 text-primary" />
                Download Full {content.type === "music" ? "Song (MP3)" : "Video (MP4)"}
              </h3>

              <p className="text-sm text-muted-foreground">
                Download the complete {content.type} to your device. Use the search feature to find available download links with real file sizes.
              </p>

              <Button onClick={() => handleDownload("best")} className="w-full" size="lg">
                <Download className="h-4 w-4 mr-2" />
                Search & Download
              </Button>

              <div className="bg-primary/10 border border-primary/20 p-3 rounded-lg">
                <p className="text-xs text-center">
                  <strong>Full Content Download</strong> - Downloads show actual file sizes from the source.
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

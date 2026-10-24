"use client"

import { useState } from "react"
import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus, ListMusic, Trash2 } from "lucide-react"
import { usePlaylistManager } from "@/components/playlist-manager-provider"
import { useMusicPlayer } from "@/components/music-player-provider"
import { useDownloadManager } from "@/components/download-manager-provider"
import type { ContentItem } from "@/lib/types"
import { ContentCard } from "@/components/content-card"

export default function PlaylistsPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newPlaylistName, setNewPlaylistName] = useState("")
  const [newPlaylistDescription, setNewPlaylistDescription] = useState("")
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null)

  const { playlists, createPlaylist, deletePlaylist, removeFromPlaylist } = usePlaylistManager()
  const { playTrack } = useMusicPlayer()
  const { startDownload } = useDownloadManager()

  const handleCreatePlaylist = () => {
    if (newPlaylistName.trim()) {
      createPlaylist(newPlaylistName, newPlaylistDescription)
      setNewPlaylistName("")
      setNewPlaylistDescription("")
      setIsCreateDialogOpen(false)
    }
  }

  const selectedPlaylist = playlists.find((p) => p.id === selectedPlaylistId)

  const handlePlay = (item: ContentItem) => {
    if (item.type === "music" && selectedPlaylist) {
      playTrack(item, selectedPlaylist.items)
    } else if (item.type !== "music") {
      window.location.assign(`/discover?q=${encodeURIComponent(item.title)}`)
    }
  }

  const handleDownload = (item: ContentItem, quality?: string) => {
    if (item.type === "music") startDownload(item, quality)
    else window.location.assign(`/discover?q=${encodeURIComponent(item.title)}`)
  }

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8 pb-32 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Playlists</h1>
            <p className="text-muted-foreground">Create and manage your playlists</p>
          </div>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Playlist
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Playlist</DialogTitle>
                <DialogDescription>Add a name and description for your new playlist</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    placeholder="My Awesome Playlist"
                    value={newPlaylistName}
                    onChange={(e) => setNewPlaylistName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Textarea
                    id="description"
                    placeholder="A collection of my favorite songs..."
                    value={newPlaylistDescription}
                    onChange={(e) => setNewPlaylistDescription(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreatePlaylist}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Playlists Grid */}
        {!selectedPlaylistId ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {playlists.map((playlist) => (
              <Card
                key={playlist.id}
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => setSelectedPlaylistId(playlist.id)}
              >
                <CardHeader>
                  <div className="w-full aspect-square bg-muted rounded-lg flex items-center justify-center mb-4">
                    <ListMusic className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <CardTitle className="line-clamp-1">{playlist.name}</CardTitle>
                  {playlist.description && (
                    <CardDescription className="line-clamp-2">{playlist.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{playlist.items.length} items</p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          /* Playlist Detail View */
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <Button variant="ghost" onClick={() => setSelectedPlaylistId(null)} className="mb-4">
                  ← Back to Playlists
                </Button>
                <h2 className="text-2xl font-bold text-foreground">{selectedPlaylist?.name}</h2>
                {selectedPlaylist?.description && (
                  <p className="text-muted-foreground mt-1">{selectedPlaylist.description}</p>
                )}
                <p className="text-sm text-muted-foreground mt-2">{selectedPlaylist?.items.length} items</p>
              </div>

              {selectedPlaylist?.id !== "favorites" && (
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (selectedPlaylist) {
                      deletePlaylist(selectedPlaylist.id)
                      setSelectedPlaylistId(null)
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Playlist
                </Button>
              )}
            </div>

            {selectedPlaylist && selectedPlaylist.items.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {selectedPlaylist.items.map((item) => (
                  <ContentCard key={item.id} item={item} onPlay={handlePlay} onDownload={handleDownload} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-4">
                  <ListMusic className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">No items in this playlist</h3>
                <p className="text-muted-foreground max-w-md">
                  Add songs, movies, or series to this playlist from the home page
                </p>
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {playlists.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-4">
              <ListMusic className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">No playlists yet</h3>
            <p className="text-muted-foreground max-w-md mb-4">
              Create your first playlist to organize your favorite content
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Playlist
            </Button>
          </div>
        )}
      </div>

    </AppLayout>
  )
}

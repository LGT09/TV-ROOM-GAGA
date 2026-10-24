"use client"

import type React from "react"
import { createContext, useContext, useState } from "react"
import type { ContentItem } from "./content-card"

export interface Playlist {
  id: string
  name: string
  description?: string
  items: ContentItem[]
  createdAt: Date
  coverImage?: string
}

interface PlaylistManagerContextType {
  playlists: Playlist[]
  createPlaylist: (name: string, description?: string) => void
  deletePlaylist: (id: string) => void
  addToPlaylist: (playlistId: string, item: ContentItem) => void
  removeFromPlaylist: (playlistId: string, itemId: string) => void
}

const PlaylistManagerContext = createContext<PlaylistManagerContextType | undefined>(undefined)

export function PlaylistManagerProvider({ children }: { children: React.ReactNode }) {
  const [playlists, setPlaylists] = useState<Playlist[]>([
    {
      id: "favorites",
      name: "Favorites",
      description: "Your favorite tracks",
      items: [],
      createdAt: new Date(),
    },
  ])

  const createPlaylist = (name: string, description?: string) => {
    const newPlaylist: Playlist = {
      id: `playlist-${Date.now()}`,
      name,
      description,
      items: [],
      createdAt: new Date(),
    }
    setPlaylists((prev) => [...prev, newPlaylist])
  }

  const deletePlaylist = (id: string) => {
    setPlaylists((prev) => prev.filter((playlist) => playlist.id !== id))
  }

  const addToPlaylist = (playlistId: string, item: ContentItem) => {
    setPlaylists((prev) =>
      prev.map((playlist) => {
        if (playlist.id === playlistId) {
          const exists = playlist.items.find((i) => i.id === item.id)
          if (!exists) {
            return { ...playlist, items: [...playlist.items, item] }
          }
        }
        return playlist
      }),
    )
  }

  const removeFromPlaylist = (playlistId: string, itemId: string) => {
    setPlaylists((prev) =>
      prev.map((playlist) => {
        if (playlist.id === playlistId) {
          return {
            ...playlist,
            items: playlist.items.filter((item) => item.id !== itemId),
          }
        }
        return playlist
      }),
    )
  }

  return (
    <PlaylistManagerContext.Provider
      value={{
        playlists,
        createPlaylist,
        deletePlaylist,
        addToPlaylist,
        removeFromPlaylist,
      }}
    >
      {children}
    </PlaylistManagerContext.Provider>
  )
}

export function usePlaylistManager() {
  const context = useContext(PlaylistManagerContext)
  if (context === undefined) {
    throw new Error("usePlaylistManager must be used within a PlaylistManagerProvider")
  }
  return context
}

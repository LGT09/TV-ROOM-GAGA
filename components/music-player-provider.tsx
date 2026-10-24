"use client"

import type React from "react"
import { createContext, useContext, useState } from "react"
import dynamic from "next/dynamic"
const MusicPlayer=dynamic(()=>import("./music-player").then(m=>m.MusicPlayer),{ssr:false})
import type { ContentItem } from "./content-card"

interface MusicPlayerContextType {
  currentTrack: ContentItem | null
  playlist: ContentItem[]
  playTrack: (track: ContentItem, playlist?: ContentItem[]) => void
  addToPlaylist: (track: ContentItem) => void
  clearPlaylist: () => void
}

const MusicPlayerContext = createContext<MusicPlayerContextType | undefined>(undefined)

export function MusicPlayerProvider({ children }: { children: React.ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<ContentItem | null>(null)
  const [playlist, setPlaylist] = useState<ContentItem[]>([])

  const playTrack = (track: ContentItem, newPlaylist?: ContentItem[]) => {
    setCurrentTrack(track)
    if (newPlaylist) {
      setPlaylist(newPlaylist)
    } else if (!playlist.find((t) => t.id === track.id)) {
      setPlaylist([...playlist, track])
    }
  }

  const addToPlaylist = (track: ContentItem) => {
    if (!playlist.find((t) => t.id === track.id)) {
      setPlaylist([...playlist, track])
    }
  }

  const clearPlaylist = () => {
    setPlaylist([])
    setCurrentTrack(null)
  }

  return (
    <MusicPlayerContext.Provider
      value={{
        currentTrack,
        playlist,
        playTrack,
        addToPlaylist,
        clearPlaylist,
      }}
    >
      {children}
      {currentTrack&&<MusicPlayer currentTrack={currentTrack} playlist={playlist} onTrackChange={setCurrentTrack} />}
    </MusicPlayerContext.Provider>
  )
}

export function useMusicPlayer() {
  const context = useContext(MusicPlayerContext)
  if (context === undefined) {
    throw new Error("useMusicPlayer must be used within a MusicPlayerProvider")
  }
  return context
}

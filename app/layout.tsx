import type React from "react"
import type { Metadata } from "next"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { MusicPlayerProvider } from "@/components/music-player-provider"
import { DownloadManagerProvider } from "@/components/download-manager-provider"
import { PlaylistManagerProvider } from "@/components/playlist-manager-provider"
import { AIAssistant } from "@/components/ai-assistant"
import { VideoExports } from "@/components/video-exports"

export const metadata: Metadata = {
  title: "TV Room GAGA - Movies, Series, Cinema & Entertainment",
  description: "A sign-in-free entertainment room for discovering films, series, short dramas, music and public live television.",
  generator: "v0.app",
  icons: {
    icon: "/tvroom-logo.png",
    shortcut: "/tvroom-logo.png",
    apple: "/tvroom-logo.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider>
          <DownloadManagerProvider>
            <PlaylistManagerProvider>
              <MusicPlayerProvider>
                {children}
                <AIAssistant />
                <VideoExports />
              </MusicPlayerProvider>
            </PlaylistManagerProvider>
          </DownloadManagerProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}

"use client"

import { AppLayout } from "@/components/app-layout"
import { MovieBoxBrowser } from "@/components/moviebox-browser"

export default function MoviesPage() {
  return <AppLayout><div className="page-shell space-y-5 py-5 pb-12 sm:py-8">
    <header><p className="text-xs font-bold uppercase tracking-[.2em] text-primary">MovieBox library</p><h1 className="mt-2 font-display text-3xl sm:text-4xl">Movies &amp; series</h1><p className="mt-2 text-sm text-muted-foreground">Search, stream, and save from available movie sources.</p></header>
    <MovieBoxBrowser />
  </div></AppLayout>
}

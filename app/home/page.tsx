"use client"

import Link from "next/link"
import { ArrowUpRight, Compass, Film, Music, Radio, Search, Wrench } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { ProviderBrowser } from "@/components/provider-browser"
import { HomeMusic } from "@/components/home-music"

export default function Home() {
  return <AppLayout>
    <div className="page-shell space-y-8 py-5 pb-12 sm:py-8">
      <header className="flex flex-col gap-5 border-b border-border/70 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-primary">Your room, no account needed</p>
          <h1 className="mt-2 font-display text-3xl leading-tight sm:text-5xl">Settle in. Pick a story.</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">Browse movies and series, then keep the controls close at hand.</p>
        </div>
        <Link href="/search" className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-border bg-card/70 px-4 text-sm font-semibold hover:border-primary/40"><Search className="h-4 w-4 text-primary" /> Search titles</Link>
      </header>
      <section aria-labelledby="library-heading" className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-[.18em] text-primary">The library</p><h2 id="library-heading" className="mt-1 font-display text-2xl sm:text-3xl">Movies &amp; series</h2></div>
          <Link href="/movies" className="inline-flex items-center gap-1 text-sm font-semibold text-primary">Full library <ArrowUpRight className="h-4 w-4" /></Link>
        </div>
        <ProviderBrowser compact />
      </section>
      <HomeMusic />
      <nav aria-label="More rooms" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { href: "/music", label: "Music", icon: Music, note: "Tracks and playlists" },
          { href: "/live-tv", label: "Live TV", icon: Radio, note: "Choose a country" },
          { href: "/downloader", label: "Media tools", icon: Wrench, note: "Tools for your links" },
          { href: "/discover", label: "Discover", icon: Compass, note: "Browse the full library" },
        ].map(({ href, label, icon: Icon, note }) => <Link key={href} href={href} className="glass-card hover-lift flex min-w-0 items-center gap-3 rounded-xl p-3 sm:p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span>
          <span className="min-w-0"><span className="block truncate text-sm font-semibold">{label}</span><span className="hidden truncate text-xs text-muted-foreground sm:block">{note}</span></span>
        </Link>)}
      </nav>
      <p className="flex items-center gap-2 text-xs text-muted-foreground"><Film className="h-4 w-4 text-primary" />No account required. Your browser keeps your local preferences.</p>
    </div>
  </AppLayout>
}

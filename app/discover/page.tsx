"use client"

import { AppLayout } from "@/components/app-layout"
import { ProviderBrowser } from "@/components/provider-browser"

export default function DiscoverPage() {
  return <AppLayout><div className="page-shell space-y-5 py-5 pb-12 sm:py-8">
    <header><p className="text-xs font-bold uppercase tracking-[.2em] text-primary">Find a new favorite</p><h1 className="mt-2 font-display text-3xl sm:text-4xl">Discover</h1><p className="mt-2 max-w-xl text-sm text-muted-foreground">Filter by category or format, then open a title for seasons, episodes, and playback.</p></header>
    <ProviderBrowser />
  </div></AppLayout>
}

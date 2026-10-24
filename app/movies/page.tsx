"use client"

import { AppLayout } from "@/components/app-layout"
import { ProviderBrowser } from "@/components/provider-browser"

export default function MoviesPage() {
  return <AppLayout><div className="page-shell space-y-5 py-5 pb-12 sm:py-8">
    <header><p className="text-xs font-bold uppercase tracking-[.2em] text-primary">Browse the collection</p><h1 className="mt-2 font-display text-3xl sm:text-4xl">Movies &amp; series</h1><p className="mt-2 text-sm text-muted-foreground">A compact library with quick category and format filters.</p></header>
    <ProviderBrowser />
  </div></AppLayout>
}

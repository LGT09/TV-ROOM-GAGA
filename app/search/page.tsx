"use client"

import { AppLayout } from "@/components/app-layout"
import { ProviderBrowser } from "@/components/provider-browser"

export default function SearchPage() {
  return <AppLayout><div className="page-shell space-y-5 py-5 pb-12 sm:py-8">
    <header><p className="text-xs font-bold uppercase tracking-[.2em] text-primary">Search the room</p><h1 className="mt-2 font-display text-3xl sm:text-4xl">Find a title</h1><p className="mt-2 text-sm text-muted-foreground">Search movies and series by title.</p></header>
    <ProviderBrowser />
  </div></AppLayout>
}

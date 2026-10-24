"use client"

import { AppLayout } from "@/components/app-layout"
import { useDownloadManager } from "@/components/download-manager-provider"
import { DownloadItemCard } from "@/components/download-item"
import { MediaLibrary } from "@/components/media-library"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Download, Library, Compass, Film } from "lucide-react"
import Link from "next/link"

export default function DownloadPage() {
  const {activeDownloads,completedDownloads,pauseDownload,resumeDownload,cancelDownload,removeDownload}=useDownloadManager()
  return <AppLayout><main className="container mx-auto max-w-6xl px-4 py-8 md:py-12 pb-32 space-y-7">
    <header><p className="text-xs uppercase tracking-[.25em] text-primary font-bold">Your shelf / Offline</p><h1 className="font-display text-4xl md:text-5xl mt-2">Downloads & library</h1><p className="text-muted-foreground mt-2">Track download tasks and revisit items in your local media library.</p></header>
    <div className="glass-card rounded-2xl p-5 md:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
      <div className="flex gap-3"><span className="rounded-xl bg-primary/10 p-3 text-primary"><Film className="h-5 w-5"/></span><div><h2 className="font-display text-2xl">Find a film</h2><p className="text-sm text-muted-foreground mt-1">Browse available titles, then use the playback controls when a source is listed.</p></div></div>
      <Link href="/discover" className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:brightness-110"><Compass className="h-4 w-4 mr-2"/>Browse movies &amp; series</Link>
    </div>
    <Tabs defaultValue="downloads">
      <TabsList><TabsTrigger value="downloads"><Download className="h-4 w-4 mr-2"/>Downloads</TabsTrigger><TabsTrigger value="library"><Library className="h-4 w-4 mr-2"/>Media library</TabsTrigger></TabsList>
      <TabsContent value="downloads" className="mt-6 space-y-8">
        {activeDownloads.length>0&&<section className="space-y-3"><h2 className="font-display text-2xl">In progress <span className="text-base text-muted-foreground">({activeDownloads.length})</span></h2><div className="space-y-3">{activeDownloads.map(d=><DownloadItemCard key={d.id} download={d} onPause={pauseDownload} onResume={resumeDownload} onCancel={cancelDownload}/>)}</div></section>}
        {completedDownloads.length>0&&<section className="space-y-3"><h2 className="font-display text-2xl">Completed <span className="text-base text-muted-foreground">({completedDownloads.length})</span></h2><div className="space-y-3">{completedDownloads.map(d=><DownloadItemCard key={d.id} download={d} onRemove={removeDownload}/>)}</div></section>}
        {activeDownloads.length===0&&completedDownloads.length===0&&<div className="glass-card rounded-3xl p-12 text-center"><div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 text-primary grid place-items-center"><Download className="h-7 w-7"/></div><h2 className="font-display text-2xl mt-4">Your queue is clear</h2><p className="text-muted-foreground mt-2">Items added to the download manager will appear here.</p><Button asChild className="mt-5"><Link href="/discover"><Compass className="h-4 w-4 mr-2"/>Discover media</Link></Button></div>}
      </TabsContent>
      <TabsContent value="library" className="mt-6"><MediaLibrary/></TabsContent>
    </Tabs>
  </main></AppLayout>
}

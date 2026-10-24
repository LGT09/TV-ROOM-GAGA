"use client"

import { useState } from "react"
import type React from "react"
import { AppLayout } from "@/components/app-layout"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AlertCircle, ArrowDownToLine, ExternalLink, Link2, Music2, ShieldCheck, Video } from "lucide-react"

type Platform = "youtube-audio"|"youtube-video"|"tiktok"|"instagram"|"facebook"
type DownloadResult = {success:boolean;error?:string;title?:string;thumbnail?:string|null;links?:{label:string;url:string;quality?:string}[]}
const platforms:{id:Platform;label:string;hint:string;placeholder:string}[]=[
  {id:"youtube-audio",label:"YouTube audio",hint:"Paste a video link, or search YouTube by title.",placeholder:"YouTube URL or title"},
  {id:"youtube-video",label:"YouTube video",hint:"Paste a video link, or search YouTube by title.",placeholder:"YouTube URL or title"},
  {id:"tiktok",label:"TikTok",hint:"Paste a public TikTok URL.",placeholder:"https://www.tiktok.com/@creator/video/..."},
  {id:"instagram",label:"Instagram",hint:"Paste a public post or reel URL.",placeholder:"https://www.instagram.com/reel/..."},
  {id:"facebook",label:"Facebook",hint:"Paste a public Facebook video URL.",placeholder:"https://www.facebook.com/watch/..."},
]
function DownloadPanel({platform,hint,placeholder}:{platform:Platform;hint:string;placeholder:string}) {
  const youtube=platform.startsWith("youtube")
  const [input,setInput]=useState("")
  const [quality,setQuality]=useState("720p")
  const [searchMode,setSearchMode]=useState(false)
  const [loading,setLoading]=useState(false)
  const [result,setResult]=useState<DownloadResult|null>(null)
  const [error,setError]=useState("")
  const run=async(e:React.FormEvent)=>{
    e.preventDefault()
    if(!input.trim())return
    setLoading(true);setError("");setResult(null)
    try{
      const params=new URLSearchParams({platform,[searchMode&&youtube?"query":"url"]:input.trim(),...(youtube?{quality}: {})})
      const response=await fetch(`/api/social-download?${params}`,{cache:"no-store"})
      const data:DownloadResult=await response.json()
      if(!response.ok||!data.success)throw new Error(data.error||"No download links were returned.")
      setResult(data)
    }catch(e){setError(e instanceof Error?e.message:"Could not resolve this media. Check the input and retry.")}
    finally{setLoading(false)}
  }
  return <div className="glass-card rounded-3xl p-5 md:p-7 space-y-5">
    <form onSubmit={run} className="space-y-4">
      <label className="block text-sm font-medium" htmlFor={`media-${platform}`}>Media link or search term</label>
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1"><Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/><Input id={`media-${platform}`} value={input} onChange={e=>setInput(e.target.value)} placeholder={placeholder} className="pl-10 h-12 bg-card/70"/></div>
        {youtube&&<label className="sr-only" htmlFor={`quality-${platform}`}>Video quality</label>}
        {youtube&&<select id={`quality-${platform}`} value={quality} onChange={e=>setQuality(e.target.value)} className="h-12 rounded-xl border border-border bg-card px-3 text-sm"><option value="360p">360p</option><option value="480p">480p</option><option value="720p">720p</option><option value="1080p">1080p</option></select>}
        <Button type="submit" disabled={!input.trim()||loading} className="h-12 px-5">{loading?"Resolving…":"Get download links"}</Button>
      </div>
      <div className="flex flex-wrap gap-3 justify-between text-sm text-muted-foreground">
        <p>{hint}</p>
        {youtube&&<label className="inline-flex items-center gap-2"><input type="checkbox" checked={searchMode} onChange={e=>setSearchMode(e.target.checked)} className="accent-primary"/>Search by title instead of URL</label>}
      </div>
    </form>
    {loading&&<div role="status" className="space-y-3"><div className="skeleton h-24 rounded-xl"/><div className="skeleton h-10 rounded-xl"/><span className="sr-only">Resolving media links</span></div>}
    {error&&<div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex gap-3 text-sm"><AlertCircle className="h-5 w-5 text-destructive shrink-0"/>{error}</div>}
    {result&&!loading&&<div className="rounded-2xl border border-border/70 bg-card/55 p-4 md:p-5 space-y-4">
      <div className="flex gap-4 items-center">
        {result.thumbnail?<img src={result.thumbnail} alt="" className="h-20 w-28 rounded-xl object-cover bg-muted"/>:<div className="h-20 w-28 rounded-xl bg-muted grid place-items-center">{platform==="youtube-audio"?<Music2 className="h-7 w-7 text-primary"/>:<Video className="h-7 w-7 text-primary"/>}</div>}
        <div><h3 className="font-semibold">{result.title||"Resolved media"}</h3><p className="text-xs text-muted-foreground mt-1">{result.links?.length||0} link options returned by the service</p></div>
      </div>
      {result.links?.length?<div className="space-y-2">{result.links.map((link,i)=><a key={link.url+i} href={link.url} target="_blank" rel="noopener noreferrer" className="glass rounded-xl px-4 py-3 flex items-center gap-3 text-sm hover:text-primary transition-colors">
        <ArrowDownToLine className="h-4 w-4"/><span className="flex-1 font-medium">{link.label||"Download"}</span>{link.quality&&<span className="text-xs text-muted-foreground">{link.quality}</span>}<ExternalLink className="h-4 w-4"/>
      </a>)}</div>:<p className="text-sm text-muted-foreground">The service returned no download options.</p>}
    </div>}
  </div>
}
export default function DownloaderPage(){
  return <AppLayout><main className="container mx-auto max-w-4xl px-4 py-8 md:py-12 pb-24 space-y-7">
    <header><p className="text-xs uppercase tracking-[.25em] text-primary font-bold">Tools / Save for later</p><h1 className="font-display text-4xl md:text-6xl mt-2">Media downloader</h1><p className="text-muted-foreground mt-3 max-w-2xl">Resolve download options supplied by the media service. Links open directly from their source; availability and format are not guaranteed.</p></header>
    <div className="glass rounded-2xl p-4 flex gap-3 text-sm"><ShieldCheck className="h-5 w-5 text-accent shrink-0"/><p><strong>Rights reminder.</strong> Only download material you own or are authorized to save. Follow the platform’s terms and your local copyright laws.</p></div>
    <Tabs defaultValue="youtube-audio">
      <TabsList className="grid grid-cols-2 sm:grid-cols-5 h-auto w-full">{platforms.map(p=><TabsTrigger key={p.id} value={p.id} className="text-xs sm:text-sm">{p.label}</TabsTrigger>)}</TabsList>
      {platforms.map(p=><TabsContent key={p.id} value={p.id} className="mt-5"><DownloadPanel platform={p.id} hint={p.hint} placeholder={p.placeholder}/></TabsContent>)}
    </Tabs>
  </main></AppLayout>
}

"use client"

import { useEffect, useRef, useState } from "react"
import type React from "react"
import { AppLayout } from "@/components/app-layout"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AlertCircle, ArrowDownToLine, ExternalLink, Link2, ShieldCheck } from "lucide-react"
import { YoutubeMediaTools } from "@/components/youtube-media-tools"
import { CheckedDownload } from "@/components/checked-download"

type Platform = "tiktok"|"instagram"|"facebook"
type DownloadResult = {success:boolean;error?:string;title?:string;thumbnail?:string|null;links?:{label:string;url:string;quality?:string}[]}
const platforms:{id:Platform;label:string;hint:string;placeholder:string}[]=[
  {id:"tiktok",label:"TikTok",hint:"Paste a public TikTok URL.",placeholder:"https://www.tiktok.com/@creator/video/..."},
  {id:"instagram",label:"Instagram",hint:"Paste a public post or reel URL.",placeholder:"https://www.instagram.com/reel/..."},
  {id:"facebook",label:"Facebook",hint:"Paste a public Facebook video URL.",placeholder:"https://www.facebook.com/watch/..."},
]
function DownloadPanel({platform,hint,placeholder}:{platform:Platform;hint:string;placeholder:string}) {
  const [input,setInput]=useState("")
  const [loading,setLoading]=useState(false)
  const [result,setResult]=useState<DownloadResult|null>(null)
  const [error,setError]=useState("")
  const controllerRef=useRef<AbortController|null>(null)
  useEffect(()=>()=>controllerRef.current?.abort(),[])
  const run=async(e:React.FormEvent)=>{
    e.preventDefault()
    if(!input.trim())return
    controllerRef.current?.abort()
    const controller=new AbortController()
    controllerRef.current=controller
    setLoading(true);setError("");setResult(null)
    const timeout=setTimeout(()=>controller.abort(),20000)
    try{
      const params=new URLSearchParams({platform,url:input.trim()})
      const response=await fetch(`/api/social-download?${params}`,{cache:"no-store",signal:controller.signal})
      const text=await response.text()
      let data:DownloadResult
      try{data=JSON.parse(text) as DownloadResult}catch{throw new Error("The media service returned an unreadable response. Please try again.")}
      if(!response.ok||!data.success)throw new Error(data.error||"No download links were returned.")
      setResult(data)
    }catch(e){setError(controller.signal.aborted?"The request was cancelled or took too long. Please retry.":e instanceof Error?e.message:"Could not resolve this media. Check the input and retry.")}
    finally{clearTimeout(timeout);if(controllerRef.current===controller){controllerRef.current=null;setLoading(false)}}
  }
  return <div className="glass-card rounded-3xl p-5 md:p-7 space-y-5">
    <form onSubmit={run} className="space-y-4">
      <label className="block text-sm font-medium" htmlFor={`media-${platform}`}>Media link</label>
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1"><Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/><Input id={`media-${platform}`} value={input} onChange={e=>setInput(e.target.value)} placeholder={placeholder} className="pl-10 h-12 bg-card/70"/></div>
        <Button type="submit" disabled={!input.trim()||loading} className="h-12 px-5">{loading?"Resolving…":"Get download links"}</Button>
        {loading&&<Button type="button" variant="outline" className="h-12" onClick={()=>controllerRef.current?.abort()}>Cancel</Button>}
      </div>
      <p className="text-sm text-muted-foreground">{hint}</p>
    </form>
    {loading&&<div role="status" className="space-y-3"><div className="skeleton h-24 rounded-xl"/><div className="skeleton h-10 rounded-xl"/><span className="sr-only">Resolving media links</span></div>}
    {error&&<div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex gap-3 text-sm"><AlertCircle className="h-5 w-5 text-destructive shrink-0"/>{error}</div>}
    {result&&!loading&&<div className="rounded-2xl border border-border/70 bg-card/55 p-4 md:p-5 space-y-4">
      <div className="flex gap-4 items-center">
        {result.thumbnail?<img src={result.thumbnail} alt="" className="h-20 w-28 rounded-xl object-cover bg-muted"/>:<div className="h-20 w-28 rounded-xl bg-muted grid place-items-center"><Link2 className="h-7 w-7 text-primary"/></div>}
        <div><h3 className="font-semibold">{result.title||"Resolved media"}</h3><p className="text-xs text-muted-foreground mt-1">{result.links?.length||0} link options returned by the service</p></div>
      </div>
      {result.links?.length?<div className="space-y-2">{result.links.map((link,i)=><CheckedDownload key={link.url+i} url={link.url} label={`${link.label||"Download"}${link.quality?` · ${link.quality}`:""}`}/>)}</div>:<p className="text-sm text-muted-foreground">The service returned no download options.</p>}
    </div>}
  </div>
}
export default function DownloaderPage(){
  return <AppLayout><main className="container mx-auto max-w-4xl px-4 py-8 md:py-12 pb-24 space-y-7">
    <header><p className="text-xs uppercase tracking-[.25em] text-primary font-bold">Tools / Save for later</p><h1 className="font-display text-4xl md:text-6xl mt-2">Media downloader</h1><p className="text-muted-foreground mt-3 max-w-2xl">Find a track, listen in full, watch it here, or save an authorized copy for later.</p></header>
    <div className="glass rounded-2xl p-4 flex gap-3 text-sm"><ShieldCheck className="h-5 w-5 text-accent shrink-0"/><p><strong>Rights reminder.</strong> Only download material you own or are authorized to save. Follow the platform’s terms and your local copyright laws.</p></div>
    <Tabs defaultValue="youtube-audio">
      <TabsList className="grid grid-cols-2 sm:grid-cols-4 h-auto w-full"><TabsTrigger value="youtube-audio" className="text-xs sm:text-sm">YouTube media</TabsTrigger>{platforms.map(p=><TabsTrigger key={p.id} value={p.id} className="text-xs sm:text-sm">{p.label}</TabsTrigger>)}</TabsList>
      <TabsContent value="youtube-audio" className="mt-5"><YoutubeMediaTools/></TabsContent>
      {platforms.map(p=><TabsContent key={p.id} value={p.id} className="mt-5"><DownloadPanel platform={p.id} hint={p.hint} placeholder={p.placeholder}/></TabsContent>)}
    </Tabs>
  </main></AppLayout>
}

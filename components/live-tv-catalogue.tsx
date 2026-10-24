"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AlertCircle, Globe2, Radio, RotateCw, Search, Tv } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { MediaPlayback } from "@/components/media-playback"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { countryInfo } from "@/lib/countries"

type Channel = { id:string; name:string; category?:string; categories?:string[]; country?:string; logo?:string; streamUrl?:string; streams?:{url:string;quality?:string}[]; hasStream?:boolean }
export function LiveTvCatalogue() {
  const [channels,setChannels]=useState<Channel[]>([])
  const [categories,setCategories]=useState<string[]>([])
  const [countries,setCountries]=useState<string[]>([])
  const [category,setCategory]=useState("")
  const [country,setCountry]=useState("")
  const [query,setQuery]=useState("")
  const [submittedQuery,setSubmittedQuery]=useState("")
  const [selected,setSelected]=useState<Channel|null>(null)
  const [stream,setStream]=useState("")
  const [alternates,setAlternates]=useState<{url:string;quality?:string}[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState("")
  const [total,setTotal]=useState(0)
  const [warnings,setWarnings]=useState<string[]>([])
  const [offset,setOffset]=useState(0)
  const listRequest=useRef<AbortController|null>(null)
  const channelRequest=useRef<AbortController|null>(null)
  const [selecting,setSelecting]=useState(false)
  const load=useCallback(async(nextOffset=0)=>{
    listRequest.current?.abort()
    const controller=new AbortController()
    listRequest.current=controller
    setLoading(true);setError("")
    try {
      const params=new URLSearchParams({action:submittedQuery.trim()?"search":"channels",...(submittedQuery.trim()?{q:submittedQuery.trim()}:{}),...(category?{category}:{}),...(country?{country}:{}),offset:String(nextOffset),limit:"100"})
      const response=await fetch(`/api/live-tv?${params}`,{cache:"no-store",signal:controller.signal});const data=await response.json()
      if(!response.ok||data.success===false)throw new Error(data.error||"The channel catalogue could not be loaded.")
      const results:Channel[]=data.channels||data.results||[]
      setChannels(results);setCategories(data.categories||[]);setCountries(data.countries||[]);setTotal(data.totalChannels??results.length);setOffset(nextOffset)
      setWarnings(data.warnings||[])
    }catch(e){if(!controller.signal.aborted){setError(e instanceof Error?e.message:"Could not load channels.");setChannels([])}}
    finally{if(!controller.signal.aborted)setLoading(false)}
  },[submittedQuery,category,country])
  useEffect(()=>{load(0);return()=>listRequest.current?.abort()},[load])
  useEffect(()=>()=>channelRequest.current?.abort(),[])
  const selectChannel=async(channel:Channel)=>{
    channelRequest.current?.abort()
    const controller=new AbortController()
    channelRequest.current=controller
    setSelected(channel);setStream("");setAlternates([]);setError("");setSelecting(true)
    try {
      const res=await fetch(`/api/live-tv?action=stream&channelId=${encodeURIComponent(channel.id)}`,{cache:"no-store",signal:controller.signal});const data=await res.json()
      if(!res.ok||data.success===false)throw new Error(data.error||"No stream was returned for this channel.")
      const urls=(data.channel?.streams||channel.streams||[]).filter((s:any)=>s.url)
      const primary=data.streamUrl||data.channel?.streamUrl||urls[0]?.url||channel.streamUrl||""
      if(!primary)throw new Error("This channel does not currently provide a stream URL.")
      setStream(primary);setAlternates(urls.filter((s:any)=>s.url!==primary))
    }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:"Channel stream unavailable.")}
    finally{if(!controller.signal.aborted)setSelecting(false)}
  }
  const categoryOptions=["",...categories]
  return <AppLayout><main className="page-shell space-y-5">
    <header className="flex flex-col md:flex-row md:items-end justify-between gap-5">
      <div><p className="text-xs uppercase tracking-[.2em] text-primary font-bold">Public broadcast</p><h1 className="font-display text-3xl sm:text-4xl mt-2">Live television</h1><p className="text-muted-foreground mt-2 max-w-xl text-sm">Choose a country, find a channel, and watch. Availability varies by channel and region.</p></div>
      <div className="glass rounded-2xl px-4 py-3 text-sm text-muted-foreground"><Radio className="inline h-4 w-4 mr-2 text-primary"/>{total.toLocaleString()} catalogue entries</div>
    </header>
    {warnings.length>0&&<div role="status" className="glass rounded-xl p-4 text-sm">{warnings.join(" ")}</div>}
    <div className="grid lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,1fr)] gap-4 items-start">
      <section className="space-y-4">
        <div className="glass-card rounded-3xl p-3 md:p-4">
          {selected&&stream?<MediaPlayback key={stream} src={stream} title={selected.name} alternateSources={alternates}/>:<div className="aspect-video rounded-2xl bg-[#171c28] text-white/70 grid place-items-center text-center p-8">
            <div><Tv className="h-10 w-10 mx-auto text-primary/80"/><p className="mt-3 font-display text-xl text-white">{selected?.name||"Choose a channel"}</p><p role="status" className="mt-2 text-sm">{selecting?"Opening channel…":selected?"No playable stream yet. Retry below or select another channel.":"Choose a country and a channel below."}</p></div>
          </div>}
          {selected&&<div className="mt-4 flex items-center gap-3">
            {selected.logo&&<img src={selected.logo} alt="" className="w-14 h-10 object-contain rounded-lg bg-white/80 p-1" onError={e=>{e.currentTarget.style.visibility="hidden"}}/>}
            <div className="min-w-0"><h2 className="font-semibold break-words">{selected.name}</h2><p className="text-xs text-muted-foreground">{selected.category} · {countryInfo(selected.country||"").flag} {countryInfo(selected.country||"").name}</p></div>
            {stream&&<span className="ml-auto text-xs rounded-full border border-accent/35 bg-accent/10 px-3 py-1 text-accent-foreground">Stream URL resolved</span>}
          </div>}
        </div>
        {error&&<div role="alert" className="glass rounded-xl p-4 flex items-center gap-3 text-sm"><AlertCircle className="h-5 w-5 text-primary shrink-0"/><span className="flex-1">{error}</span><Button size="sm" variant="outline" onClick={()=>selected?selectChannel(selected):load(offset)}>Retry</Button></div>}
      </section>
      <section className="glass-card rounded-3xl p-4 space-y-4">
        <form className="flex gap-2" onSubmit={e=>{e.preventDefault();if(query===submittedQuery)load(0);else setSubmittedQuery(query)}}>
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/><Input className="pl-9 bg-card/70" placeholder="Search channels" value={query} onChange={e=>setQuery(e.target.value)} aria-label="Search public channels"/></div>
          <Button type="submit" aria-label="Search"><Search className="h-4 w-4"/></Button>
          <Button type="button" variant="outline" size="icon" aria-label="Refresh catalogue" onClick={()=>load(0)}><RotateCw className="h-4 w-4"/></Button>
        </form>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-muted-foreground">Category<select value={category} onChange={e=>setCategory(e.target.value)} className="mt-1 w-full h-10 rounded-lg border border-border bg-card px-2 text-foreground"><option value="">All categories</option>{categoryOptions.filter(Boolean).map(c=><option key={c} value={c}>{c}</option>)}</select></label>
          <label className="text-xs text-muted-foreground"><Globe2 className="inline h-3.5 w-3.5 mr-1"/>Country<select aria-label="Country" value={country} onChange={e=>setCountry(e.target.value)} className="mt-1 w-full h-10 rounded-lg border border-border bg-card px-2 text-foreground"><option value="">All countries</option>{[...countries].sort((a,b)=>countryInfo(a).name.localeCompare(countryInfo(b).name)).map(c=><option key={c} value={c}>{countryInfo(c).flag} {countryInfo(c).name}</option>)}</select></label>
        </div>
        <div className="max-h-[min(68vh,690px)] overflow-y-auto space-y-2 pr-1">
          {loading?Array.from({length:7},(_,i)=><div key={i} className="skeleton h-[66px] rounded-xl"/>):channels.length===0?<div className="py-12 text-center"><Tv className="h-8 w-8 mx-auto text-muted-foreground"/><p className="font-display text-xl mt-3">No channels found</p><p className="text-sm text-muted-foreground mt-1">Adjust the filters or try a different search.</p></div>:channels.map(ch=><button key={ch.id} onClick={()=>selectChannel(ch)} className={`w-full flex items-center gap-3 p-3 rounded-xl text-left border transition-colors ${selected?.id===ch.id?"border-primary/50 bg-primary/10":"border-transparent bg-card/45 hover:bg-card/90"}`}>
            {ch.logo?<img src={ch.logo} alt="" loading="lazy" className="w-12 h-9 object-contain rounded-md bg-white/80 p-1" onError={e=>{e.currentTarget.style.visibility="hidden"}}/>:<span className="w-12 h-9 grid place-items-center rounded-md bg-muted"><Tv className="h-4 w-4"/></span>}
            <span className="min-w-0 flex-1"><span className="block font-medium text-sm truncate">{ch.name}</span><span className="block text-xs text-muted-foreground truncate">{ch.category} · {countryInfo(ch.country||"").flag} {countryInfo(ch.country||"").name}</span></span>
            <span className={`h-2 w-2 rounded-full shrink-0 ${ch.hasStream?"bg-accent":"bg-muted-foreground/40"}`} title={ch.hasStream?"Catalogue reports a stream URL":"No stream URL reported"}/>
          </button>)}
        </div>
        <div className="flex justify-between text-xs text-muted-foreground"><span>Entries {Math.min(offset+1,total)}–{Math.min(offset+channels.length,total)} of {total}</span><div className="flex gap-1"><Button size="sm" variant="outline" disabled={offset<=0||loading} onClick={()=>load(Math.max(offset-100,0))}>Previous</Button><Button size="sm" variant="outline" disabled={loading||offset+channels.length>=total} onClick={()=>load(offset+100)}>Next</Button></div></div>
        <p className="text-[11px] text-muted-foreground">A catalogue stream listing does not guarantee that playback is available. No audience counts or live status are inferred.</p>
      </section>
    </div>
  </main></AppLayout>
}

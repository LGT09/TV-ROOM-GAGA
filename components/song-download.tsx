"use client"
import { useEffect,useState } from "react"
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { readApiJson } from "@/lib/client-json"
import { saveMediaFile } from "@/lib/client-download"
import { formatFileSize } from "@/lib/media-info"
export type DownloadSong={trackName:string;artistName:string;videoId?:string;previewUrl?:string;audioUrl?:string;downloadUrl?:string}
type Choice={downloadUrl:string;format:string;quality:string;sizeBytes?:number}
type Extras={downloadUrl:string;sizeBytes:number;files:{name:string;sizeBytes:number}[];lyricsStatus:string}
export function SongDownload({song,onClose}:{song:DownloadSong;onClose:()=>void}){
  const [choices,setChoices]=useState<Choice[]>([])
  const [index,setIndex]=useState(0)
  const [extras,setExtras]=useState<Extras|null>(null)
  const [loading,setLoading]=useState(true),[extrasLoading,setExtrasLoading]=useState(true)
  const [error,setError]=useState(""),[extrasError,setExtrasError]=useState("")
  const [saving,setSaving]=useState(false),[message,setMessage]=useState("")
  const [retry,setRetry]=useState(0)
  const source=song.videoId?`https://youtu.be/${song.videoId}`:song.previewUrl||song.audioUrl||song.downloadUrl||""
  useEffect(()=>{
    const controller=new AbortController()
    let active=true,completed=0
    const timeout=setTimeout(()=>{controller.abort();if(active){setLoading(false);setExtrasLoading(false);setError("Preparation timed out. Retry the download options.")}},30000)
    const finish=()=>{completed++;if(completed===2)clearTimeout(timeout)}
    setLoading(true);setExtrasLoading(true);setError("");setExtrasError("");setChoices([]);setExtras(null);setIndex(0)
    void (async()=>{
      try{
        const response=await fetch(`/api/music?${new URLSearchParams({action:"download-mp3",url:source,title:song.trackName})}`,{signal:controller.signal,cache:"no-store"})
        const data=await readApiJson(response)
        if(!response.ok||!data.downloadUrl)throw new Error(data.error||"Full audio unavailable.")
        setChoices(data.choices?.length?data.choices:[data])
      }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:"Audio unavailable.")}
      finally{if(active)setLoading(false);finish()}
    })()
    void (async()=>{
      try{
        const response=await fetch("/api/music-extras",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url:source,title:song.trackName,artist:song.artistName}),signal:controller.signal})
        const data=await readApiJson(response)
        if(!response.ok)throw new Error(data.error||"Extras unavailable.")
        setExtras(data)
      }catch(e){if(!controller.signal.aborted)setExtrasError(e instanceof Error?e.message:"Extras unavailable.")}
      finally{if(active)setExtrasLoading(false);finish()}
    })()
    return()=>{active=false;clearTimeout(timeout);controller.abort()}
  },[source,song.trackName,song.artistName,retry])
  const saveExtras=()=>{
    if(!extras)return
    const anchor=document.createElement("a")
    anchor.href=extras.downloadUrl;anchor.download="";document.body.appendChild(anchor);anchor.click();anchor.remove()
  }
  const save=async(withExtras:boolean)=>{
    if(!choices[index])return
    setSaving(true);setError("");setMessage("")
    try{
      await saveMediaFile(choices[index].downloadUrl)
      if(withExtras)saveExtras()
      setMessage(withExtras?"Audio and extras sent to your browser. If multiple downloads are blocked, use Save extras ZIP separately.":"Audio sent to your browser’s download manager.")
    }catch(e){setError(e instanceof Error?e.message:"Download failed.")}
    finally{setSaving(false)}
  }
  return <Dialog open onOpenChange={open=>{if(!open)onClose()}}><DialogContent className="max-h-[90dvh] overflow-y-auto max-w-lg">
    <DialogHeader><DialogTitle>Download song</DialogTitle><DialogDescription>{song.trackName} · {song.artistName}</DialogDescription></DialogHeader>
    <div className="space-y-4 min-w-0">
      <section className="space-y-2"><h3 className="font-semibold">Audio quality &amp; size</h3>
        {loading?<p role="status" className="text-sm text-muted-foreground">Finding full audio files…</p>:choices.length>0?<label className="block text-sm">Choose available file<select aria-label="Download quality" value={index} onChange={e=>setIndex(Number(e.target.value))} className="mt-2 w-full rounded-lg border bg-background p-3">{choices.map((choice,i)=><option key={i} value={i}>{choice.quality||"Original quality"} · {choice.format} · {formatFileSize(choice.sizeBytes)}</option>)}</select></label>:null}
        <p className="text-xs text-muted-foreground">Only actual supplied files are offered. No upscaling or invented bitrates; unknown sizes are marked unavailable.</p>
      </section>
      <section className="rounded-xl border p-3 space-y-2"><h3 className="font-semibold">Cover, artist details &amp; lyrics</h3>
        {extrasLoading?<p role="status" className="text-sm">Preparing companion files…</p>:extras?<><p className="text-sm text-muted-foreground">{extras.lyricsStatus} · ZIP {formatFileSize(extras.sizeBytes)}</p><ul className="text-sm">{extras.files.map(file=><li key={file.name}>{file.name} · {formatFileSize(file.sizeBytes)}</li>)}</ul><Button variant="outline" onClick={saveExtras}>Save extras ZIP</Button></>:<p role="alert" className="text-sm">{extrasError}</p>}
        <p className="text-xs text-muted-foreground">Companion files are separate, not embedded audio tags. Cover uses the video thumbnail when verified album art is unavailable. Unavailable lyrics are not fabricated.</p>
      </section>
      {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
      {message&&<p role="status" className="text-sm">{message}</p>}
      <div className="flex flex-wrap gap-2"><Button disabled={!choices.length||saving} onClick={()=>void save(false)}>{saving?"Starting…":"Download audio"}</Button><Button variant="secondary" disabled={!choices.length||!extras||saving} onClick={()=>void save(true)}>Download song + extras</Button><Button variant="outline" disabled={loading||extrasLoading||saving} onClick={()=>setRetry(n=>n+1)}>Refresh options</Button></div>
    </div>
  </DialogContent></Dialog>
}

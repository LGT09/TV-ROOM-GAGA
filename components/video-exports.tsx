"use client"

import { useEffect, useState } from "react"
import { savedVideoExports, watchVideoExports, refreshVideoExport, removeVideoExport, type VideoExport } from "@/lib/client-video-exports"
import { CheckedDownload } from "./checked-download"

export function VideoExports() {
  const [items,setItems]=useState<VideoExport[]>([])
  const [open,setOpen]=useState(true)
  useEffect(()=>{
    const sync=()=>setItems(savedVideoExports())
    sync()
    const unwatch=watchVideoExports(sync)
    let polling=false,closed=false
    const poll=async()=>{
      if(polling||!navigator.onLine)return
      polling=true
      try {
        for(const item of savedVideoExports()){
          if(closed)break
          if(item.key&&!["failed","unknown"].includes(item.status)&&(!item.downloadUrl||item.status!=="done"))await refreshVideoExport(item)
        }
      }finally{polling=false}
    }
    void poll()
    const timer=setInterval(()=>void poll(),5000)
    window.addEventListener("online",poll)
    return ()=>{closed=true;unwatch();clearInterval(timer);window.removeEventListener("online",poll)}
  },[])
  if(!items.length)return null
  return <section aria-label="Watermarked videos" className="fixed bottom-3 left-3 right-3 z-50 max-h-[55dvh] overflow-y-auto rounded-xl border border-border bg-background/95 p-3 shadow-xl backdrop-blur-xl sm:left-auto sm:w-96">
    <button className="flex min-h-10 w-full items-center justify-between text-sm font-semibold" onClick={()=>setOpen(!open)} aria-expanded={open}>Watermarked videos ({items.length}) <span>{open?"Hide":"Show"}</span></button>
    {open&&<><p className="mb-3 text-xs text-muted-foreground">Rendering continues after you leave. Return in this browser within 23 hours to save the file. Processing and temporary hosting limits apply.</p>
      <ul className="space-y-3">{items.map(item=><li key={item.id} className="space-y-1 border-t border-border pt-2">
        <p className="truncate text-sm font-medium">{item.title}</p>
        <p role="status" className="text-xs text-muted-foreground">{item.status==="done"?"Ready · TV ROOM GAGA embedded":item.status==="submitting"?"Submitting — keep this tab open until confirmed":item.status==="failed"?"Processing failed":item.status==="unknown"?"Submission needs checking":`Processing: ${item.status}`}</p>
        {item.status==="submitting"&&Date.now()-item.created>60000&&<p className="text-xs text-destructive">If submission was interrupted, check the processing account before starting another job.</p>}
        {item.message&&<p role="alert" className="text-xs text-destructive">{item.message}</p>}
        {item.status==="done"&&item.downloadUrl&&<CheckedDownload url={item.downloadUrl} label="Save watermarked video"/>}
        {item.key&&<button className="mr-3 min-h-9 text-xs underline" onClick={()=>void refreshVideoExport(item)}>Refresh status / link</button>}
        <button className="min-h-9 text-xs text-muted-foreground underline" onClick={()=>{if(window.confirm("Remove this item? This does not cancel processing or refund processor usage."))removeVideoExport(item.id)}}>Remove</button>
      </li>)}</ul></>}
  </section>
}

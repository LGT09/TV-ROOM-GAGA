"use client"

import { useEffect, useRef, useState } from "react"
import { Download, LoaderCircle } from "lucide-react"
import { saveMediaFile } from "@/lib/client-download"

export function CheckedDownload({url,label="Download file",filename}:{url:string;label?:string;filename?:string}) {
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState("")
  const [error,setError]=useState(false)
  const controller=useRef<AbortController|null>(null)
  useEffect(()=>()=>controller.current?.abort(),[])
  const save=async()=>{
    if(busy)return
    const abort=new AbortController()
    controller.current=abort
    const timeout=setTimeout(()=>abort.abort(),75000)
    setBusy(true);setMessage("");setError(false)
    try{
      const result=await saveMediaFile(url,filename,abort.signal)
      setMessage(result==="queued"?"Background processing started. Use Watermarked videos to check progress and save the finished file.":"Sent to your browser’s downloads. Your browser handles saving the file.")
    }catch(e){
      setError(true)
      setMessage(abort.signal.aborted?"The file took too long to respond. Refresh sources or try another quality.":e instanceof Error?e.message:"Download could not start.")
    }finally{clearTimeout(timeout);setBusy(false)}
  }
  return <div className="min-w-0 space-y-1">
    <button type="button" onClick={()=>void save()} disabled={busy} aria-busy={busy} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border bg-card/70 px-3 py-2 text-sm font-medium hover:border-primary/50 disabled:opacity-60">
      {busy?<LoaderCircle className="h-4 w-4 animate-spin"/>:<Download className="h-4 w-4"/>}{busy?"Preparing download…":label}
    </button>
    {message&&<p role={error?"alert":"status"} className={`max-w-sm text-xs ${error?"text-destructive":"text-muted-foreground"}`}>{message}</p>}
  </div>
}

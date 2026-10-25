"use client"

import type React from "react"
import { createContext, useContext, useState, useRef, useCallback, useEffect } from "react"
import type { ContentItem } from "@/lib/types"
import { readApiJson } from "@/lib/client-json"
import { resolveMovieDownload, saveMediaFile } from "@/lib/client-download"

export interface DownloadItem {
  id: string
  content: ContentItem
  progress: number
  status: "downloading" | "completed" | "failed" | "paused" | "pending" | "requested" | "processing"
  downloadedAt?: Date
  fileSize?: string
  fileSizeBytes?: number
  quality?: string
  downloadUrl?: string
  speed?: string
  eta?: string
  error?: string
}
interface DownloadManagerContextType {
  downloads: DownloadItem[]
  activeDownloads: DownloadItem[]
  completedDownloads: DownloadItem[]
  startDownload: (content: ContentItem, quality?: string) => void
  pauseDownload: (id: string) => void
  resumeDownload: (id: string) => void
  cancelDownload: (id: string) => void
  removeDownload: (id: string) => void
  searchAndDownloadMovie: (title: string, quality?: string) => Promise<void>
  downloadYouTube: (url: string, format: "mp3" | "mp4", title?: string) => Promise<void>
  directDownload: (url: string, filename: string) => void
}
const DownloadManagerContext = createContext<DownloadManagerContextType | undefined>(undefined)

export function DownloadManagerProvider({ children }: { children: React.ReactNode }) {
  const [downloads, setDownloads] = useState<DownloadItem[]>([])
  const controllers = useRef(new Map<string, AbortController>())
  useEffect(()=>()=>{controllers.current.forEach(controller=>controller.abort())},[])

  const directDownload = useCallback((url: string, filename: string) => {
    void saveMediaFile(url,filename).catch(error=>alert(error.message||"Download could not start."))
  }, [])
  const downloadYouTube = useCallback(async (url: string, format: "mp3" | "mp4", title?: string) => {
    const data=await readApiJson(await fetch(`/api/youtube?${new URLSearchParams({action:"download",url,format})}`,{signal:AbortSignal.timeout(30000)}))
    if(!data.downloadUrl||data.isPreview)throw new Error("No full downloadable file was returned.")
    await saveMediaFile(data.downloadUrl)
  },[])
  const searchAndDownloadMovie = useCallback(async (title: string, quality = "720p") => {
    try{
      const data=await resolveMovieDownload(title,quality)
      await saveMediaFile(data.downloadUrl)
    }catch(error){alert(error instanceof Error?error.message:"Download could not start.")}
  },[])

  const startDownload = useCallback((content: ContentItem, quality = "720p") => {
    const id=`download-${Date.now()}-${content.id}`
    const controller=new AbortController()
    controllers.current.set(id,controller)
    setDownloads(current=>[{id,content,quality,status:"pending",progress:0},...current])
    const update=(changes:Partial<DownloadItem>)=>setDownloads(current=>current.map(item=>item.id===id?{...item,...changes}:item))
    const timeout=setTimeout(()=>controller.abort(),90000)
    void (async()=>{
      try{
        if(!navigator.onLine)throw new Error("You are offline. Reconnect to download this file.")
        let url=content.downloadUrl?.startsWith("/api/media?")?content.downloadUrl:""
        if(!url&&content.type==="music"){
          const source=content.audioUrl||content.previewUrl||content.videoUrl||""
          const params=new URLSearchParams({action:"download",format:"mp3",...(source?{url:source}:{query:`${content.title} ${content.artist||""}`})})
          // Resolve chart previews by title, never download the sample itself.
          const data=source&&!/youtube\.com|youtu\.be/.test(source)
            ?await readApiJson(await fetch(`/api/music?${new URLSearchParams({action:"download-mp3",url:source,title:`${content.title} ${content.artist||""}`})}`,{signal:controller.signal}))
            :await readApiJson(await fetch(`/api/youtube?${params}`,{signal:controller.signal}))
          if(data.isPreview)throw new Error("A preview is not a full-song download.")
          url=data.downloadUrl
        }else if(!url&&content.type==="movie"){
          url=(await resolveMovieDownload(content.title,quality,controller.signal)).downloadUrl
        }
        if(!url)throw new Error("Open this title in Movies & series and choose an available episode or file.")
        const result=await saveMediaFile(url,undefined,controller.signal)
        update({status:result==="queued"?"processing":"requested",downloadUrl:url,downloadedAt:new Date()})
      }catch(error){
        if(!controller.signal.aborted)update({status:"failed",error:error instanceof Error?error.message:"Download could not start."})
        else update({status:"paused",error:"Preparation stopped. Retry when your connection is ready."})
      }finally{clearTimeout(timeout);controllers.current.delete(id)}
    })()
  },[])
  const pauseDownload=useCallback((id:string)=>{controllers.current.get(id)?.abort()},[])
  const cancelDownload=useCallback((id:string)=>{
    controllers.current.get(id)?.abort()
    controllers.current.delete(id)
    setDownloads(current=>current.filter(item=>item.id!==id))
  },[])
  const resumeDownload=useCallback((id:string)=>{
    const item=downloads.find(item=>item.id===id)
    if(item){cancelDownload(id);startDownload(item.content,item.quality)}
  },[downloads,cancelDownload,startDownload])
  const activeDownloads=downloads.filter(item=>["pending","downloading","paused","failed","processing"].includes(item.status))
  const completedDownloads=downloads.filter(item=>["requested","completed"].includes(item.status))
  return <DownloadManagerContext.Provider value={{downloads,activeDownloads,completedDownloads,startDownload,pauseDownload,resumeDownload,cancelDownload,removeDownload:cancelDownload,searchAndDownloadMovie,downloadYouTube,directDownload}}>{children}</DownloadManagerContext.Provider>
}
export function useDownloadManager() {
  const context=useContext(DownloadManagerContext)
  if(!context)throw new Error("useDownloadManager must be used within a DownloadManagerProvider")
  return context
}

"use client"

import { useEffect, useRef, useState } from "react"
import { AlertTriangle, RotateCw, Maximize } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MediaWatermark } from "@/components/media-watermark"

type Caption = { url: string; language?: string; label?: string }
export function MediaPlayback({ src, title = "Media playback", subtitles = [], alternateSources = [] }: {
  src: string; title?: string; subtitles?: Caption[]; alternateSources?: { url: string; label?: string; quality?: string }[]
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef=useRef<HTMLDivElement>(null)
  const hlsRef = useRef<any>(null)
  const tried=useRef(new Set<string>())
  const choices=useRef(alternateSources)
  choices.current=alternateSources
  const resume=useRef(false)
  const position=useRef(0)
  const [status,setStatus]=useState("")
  const [error, setError] = useState("")
  const [activeSrc, setActiveSrc] = useState(src)
  const [attempt, setAttempt] = useState(0)
  const [watermarkInset,setWatermarkInset]=useState<{top:number;right:number}>()
  const alignWatermark=()=>{
    const video=videoRef.current
    if(!video?.videoWidth||!video.videoHeight)return
    const {width,height}=video.getBoundingClientRect()
    const scale=Math.min(width/video.videoWidth,height/video.videoHeight)
    const mediaWidth=video.videoWidth*scale,mediaHeight=video.videoHeight*scale
    setWatermarkInset({top:(height-mediaHeight)/2+mediaHeight*.05,right:(width-mediaWidth)/2+mediaWidth*.04})
  }
  useEffect(()=>{
    if(!containerRef.current)return
    const observer=new ResizeObserver(alignWatermark)
    observer.observe(containerRef.current)
    return()=>observer.disconnect()
  },[])

  useEffect(() => {
    setActiveSrc(src)
    setError("")
    tried.current.clear()
    setStatus("")
    position.current=0
    resume.current=false
  }, [src])
  const fail=(message:string)=>{
    tried.current.add(activeSrc)
    const next=choices.current.find(source=>source.url&&source.url!==activeSrc&&!tried.current.has(source.url))
    if(next){position.current=videoRef.current?.currentTime||0;setStatus("Trying another available stream…");setActiveSrc(next.url);setError("")}
    else{setStatus("");setError(message)}
  }

  useEffect(() => {
    setError("")
    const video = videoRef.current
    if (!video || !activeSrc) return
    let disposed = false
    let mediaRecoveries=0
    tried.current.add(activeSrc)
    const isHls = /\.m3u8(?:$|\?)|[?&]format=hls(?:&|$)/i.test(activeSrc)
    if (isHls && video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = activeSrc
      video.load()
    } else if (isHls) {
      import("hls.js").then(({ default: Hls }) => {
        if (disposed) return
        if (!Hls.isSupported()) { fail("This browser cannot play the available stream format."); return }
        const hls = new Hls({ enableWorker: true, backBufferLength: 30,manifestLoadingTimeOut:8000,manifestLoadingMaxRetry:1,levelLoadingMaxRetry:1,fragLoadingMaxRetry:1 })
        hlsRef.current = hls
        hls.loadSource(activeSrc)
        hls.attachMedia(video)
        hls.on(Hls.Events.ERROR, (_: unknown, data: { fatal?: boolean; type?: string }) => {
          if(disposed||!data.fatal)return
          if(data.type==="mediaError"&&mediaRecoveries++<1){hls.recoverMediaError();return}
          fail("None of the available streams could play. The channel may be offline, region-restricted, or use an unsupported codec.")
        })
      }).catch(() => setError("HLS playback support could not be loaded."))
    } else if (/\.mpd(?:$|\?)|[?&]format=dash(?:&|$)/i.test(activeSrc) && !video.canPlayType("application/dash+xml")) {
      fail("The available DASH format is not supported by this browser. Choose another quality.")
    } else {
      video.src = activeSrc
      video.load()
    }
    return () => { disposed = true; hlsRef.current?.destroy(); hlsRef.current = null }
  }, [activeSrc, attempt])

  return <div className="space-y-3">
    <div ref={containerRef} className="relative aspect-video overflow-hidden rounded-2xl bg-[#111722] border border-white/10">
      {activeSrc ? <video key={activeSrc} ref={videoRef} controls controlsList="nodownload nofullscreen" disablePictureInPicture playsInline className="w-full h-full object-contain" aria-label={title}
        onPlay={()=>{resume.current=true}} onPause={()=>{if(!videoRef.current?.error)resume.current=false}}
        onLoadedMetadata={()=>{alignWatermark();const video=videoRef.current;if(video&&position.current&&Number.isFinite(video.duration))video.currentTime=Math.min(position.current,Math.max(0,video.duration-1));if(video&&resume.current)void video.play().catch(()=>{})}}
        onCanPlay={()=>setStatus("")}
        onError={()=>{if(!hlsRef.current)fail("None of the available streams could play. Try refreshing the sources; the host may be offline, region-restricted, or use an unsupported codec.")}}>
        {subtitles.map((caption, i) => <track key={`${caption.url}-${i}`} kind="subtitles" src={caption.url.startsWith("/") ? caption.url : `/api/subtitle?url=${encodeURIComponent(caption.url)}`} srcLang={caption.language || "en"} label={caption.label || caption.language || "Captions"} />)}
      </video> : <div className="h-full grid place-items-center text-sm text-white/65">Choose an available source to begin playback.</div>}
      <MediaWatermark inset={watermarkInset}/>
      {error && <div role="alert" className="absolute inset-x-3 bottom-14 glass rounded-xl p-3 text-sm flex gap-3 items-start">
        <AlertTriangle className="h-4 w-4 text-primary shrink-0 mt-0.5" /><span>{error}</span>
      </div>}
    </div>
    {status&&<p role="status" className="text-xs text-muted-foreground">{status}</p>}
    <div className="flex flex-wrap gap-2 items-center">
      <Button size="sm" variant="outline" onClick={() => { tried.current.clear();setError(""); setAttempt((x) => x + 1) }}><RotateCw className="h-4 w-4 mr-2" />Retry playback</Button>
      {alternateSources.length>0&&<Button size="sm" variant={activeSrc===src?"secondary":"outline"} onClick={()=>{setActiveSrc(src);setError("")}}>Original source</Button>}
      {alternateSources.map((source, i) => <Button key={`${source.url}-${i}`} size="sm" variant={activeSrc === source.url ? "secondary" : "outline"} onClick={() => { setActiveSrc(source.url); setError("") }}>{source.quality || source.label || `Source ${i + 1}`}</Button>)}
      {activeSrc && <Button size="sm" variant="outline" className="ml-auto" onClick={async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await containerRef.current?.requestFullscreen()}catch{setError("Fullscreen is unavailable in this browser.")}}}><Maximize className="h-3.5 w-3.5 mr-1"/>Fullscreen</Button>}
    </div>
  </div>
}

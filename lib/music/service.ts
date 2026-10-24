import "server-only"
import { providerJson, ProviderError, webUrl } from "../providers/http"
import { allowedMediaUrl } from "../providers/media-url"
import { seal } from "../library/tokens"

const base="https://nayan-video-downloader.vercel.app"
const cache=new Map<string,{until:number;data:any}>()
const pending=new Map<string,Promise<any>>()
async function cached(key:string,ttl:number,work:()=>Promise<any>) {
  const hit=cache.get(key)
  if(hit&&hit.until>Date.now())return hit.data
  if(pending.has(key))return pending.get(key)!
  const job=work().then(data=>{if(cache.size>80)cache.delete(cache.keys().next().value!);cache.set(key,{data,until:Date.now()+ttl});return data}).finally(()=>pending.delete(key))
  pending.set(key,job);return job
}
export function chartTracks(data:any,sortByRelease=true) {
  return (data.feed?.entry||[]).map((entry:any)=>{
    const links=Array.isArray(entry.link)?entry.link:[entry.link].filter(Boolean)
    const preview=links.find((l:any)=>l.attributes?.type?.startsWith("audio/"))
    return {trackId:String(entry.id?.attributes?.["im:id"]||entry.id?.label||""),trackName:entry["im:name"]?.label||"",artistName:entry["im:artist"]?.label||"",
      artworkUrl100:entry["im:image"]?.at(-1)?.label||"",previewUrl:preview?.attributes?.href||"",trackTimeMillis:Number(preview?.["im:duration"]?.label)||0,
      releaseDate:entry["im:releaseDate"]?.label||"",primaryGenreName:entry.category?.attributes?.label||"Music",isPreview:true}
  }).filter((t:any)=>t.trackId&&t.trackName).sort((a:any,b:any)=>sortByRelease?(Date.parse(b.releaseDate)||0)-(Date.parse(a.releaseDate)||0):0)
}
function searchTracks(data:any) {
  const values=data.results||data.result||data.data?.results||data.data||[]
  if(!Array.isArray(values))return []
  return values.filter(v=>v?.title&&(v.url||v.id)).map((v:any)=>({
    trackId:String(v.id||v.videoId||v.url),trackName:String(v.title),artistName:String(v.author||v.channel||""),
    artworkUrl100:webUrl(v.thumbnail||v.thumbnailUrl),previewUrl:webUrl(v.url)||`https://www.youtube.com/watch?v=${encodeURIComponent(v.id||v.videoId)}`,
    trackTimeMillis:typeof v.duration==="number"?v.duration*1000:0,releaseDate:v.publishedAt||v.uploadDate||"",primaryGenreName:"Music",videoId:v.id||v.videoId,isPreview:false,
  }))
}
export async function musicList(query="",trending=false) {
  return cached(`list:${trending?"trending:":""}${query}`,120000,async()=>{
    if(query) {
      try{
        const items=searchTracks(await providerJson(`${base}/ytsearch?${new URLSearchParams({q:query})}`,5000))
        if(items.length)return {results:items,message:"Search results. Release dates are shown when supplied."}
      }catch{}
    }
    const tracks=chartTracks(await providerJson("https://itunes.apple.com/us/rss/topsongs/limit=50/json",5000),!trending)
    const q=query.toLowerCase()
    return {results:(query?tracks.filter((t:any)=>`${t.trackName} ${t.artistName}`.toLowerCase().includes(q)):tracks).slice(0,30),
      message:query?"Matching songs from the current music chart.":trending?"Trending songs in current chart order. Listening samples are labeled Preview.":"Latest releases in the current music chart. Direct listening samples are labeled Preview."}
  })
}
export function extractAudio(data:any):string {
  const r=data.result||data.data||data
  const media=(r.medias||r.formats||[]).find((m:any)=>/^(mp3|m4a|aac|audio)$|audio\//i.test(String(m.extension||m.type||m.mimeType||m.format||"")))
  return webUrl(r.audio?.url||r.mp3?.url||r.audio_url||r.audioUrl||media?.url||(typeof r.audio==="string"?r.audio:"")||(typeof r.mp3==="string"?r.mp3:"")||(/\.(mp3|m4a|aac)(?:[?#]|$)/i.test(r.url||"")?r.url:""))
}
async function verifiedAudio(url:string) {
  allowedMediaUrl(url)
  const response=await fetch(url,{headers:{Range:"bytes=0-0"},signal:AbortSignal.timeout(2500),redirect:"error",cache:"no-store"})
  const type=response.headers.get("content-type")||""
  await response.body?.cancel()
  if(!response.ok||!/audio\/|application\/octet-stream/i.test(type))throw new Error("Audio file unavailable")
  const format=/webm/i.test(type)?"WEBM":/ogg/i.test(type)?"OGG":/aac/i.test(type)?"AAC":/mp4|m4a/i.test(type)?"M4A":"MP3"
  return {url,format}
}
function audioLink(url:string,title:string,download=false,nativeFormat?:string) {
  allowedMediaUrl(url)
  const format=nativeFormat||(/\.m4a(?:[?#]|$)/i.test(url)?"M4A":/\.aac(?:[?#]|$)/i.test(url)?"AAC":"MP3")
  return `/api/media?key=${seal("media",{url,title,kind:"audio",format},1800)}${download?"&download=1":""}`
}
export async function musicFile(input:string,title:string,download=false,fullSong=false) {
  const url=webUrl(input)
  if(!url)throw new ProviderError("Choose a song or enter a valid music URL.",400)
  const host=new URL(url).hostname
  const preview=host==="mzstatic.com"||host.endsWith(".mzstatic.com")||host==="itunes.apple.com"||host.endsWith(".itunes.apple.com")
  if(preview&&!download&&!fullSong)return {success:true,audioUrl:audioLink(url,title),isPreview:true}
  if(!/^(www\.|m\.)?(youtube\.com|youtu\.be)$/.test(host)&&!preview) {
    if(!/\.(mp3|m4a|aac)(?:[?#]|$)/i.test(url))throw new ProviderError("This is not a supported audio file.",400)
    const link=audioLink(url,title,download)
    return {success:true,audioUrl:link,downloadUrl:download?link:undefined,title,isPreview:false}
  }
  const full=await cached(`file:${url}:${title}`,20000,async()=>{
    let source=url
    if(preview){
      if(!title)throw new ProviderError("A song title is needed to find a full audio file.",400)
      const matches=searchTracks(await providerJson(`${base}/ytsearch?${new URLSearchParams({q:title})}`,4500))
      const words=title.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu," ").split(/\s+/).filter(w=>w.length>2)
      const match=matches.find((m:any)=>words.length>0&&words.filter(w=>m.trackName.toLowerCase().includes(w)).length>=Math.ceil(words.length*.7))
      if(!match)throw new ProviderError("A matching full song is unavailable. The preview is still playable.")
      source=match.previewUrl
    }
    const attempts=["ytdown","alldown"].map(async action=>{
      const audio=extractAudio(await providerJson(`${base}/${action}?${new URLSearchParams({url:source})}`,6000))
      if(!audio)throw new Error("No audio file")
      return verifiedAudio(audio)
    })
    attempts.push((async()=>{
      const data=await providerJson(`https://knightbotapi.stream/api/download?${new URLSearchParams({apikey:"knight",type:"mp3",url:source})}`,6000)
      const audio=extractAudio(data)
      if(!audio)throw new Error("No audio file")
      return verifiedAudio(audio)
    })())
    try{return await Promise.any(attempts)}catch{throw new ProviderError("Full-song audio is unavailable after trying alternate connections. A preview is not a full download.")}
  })
  return {success:true,audioUrl:audioLink(full.url,title,false,full.format),downloadUrl:download?audioLink(full.url,title,true,full.format):undefined,title,format:full.format,isPreview:false}
}

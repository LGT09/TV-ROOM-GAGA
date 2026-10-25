import "server-only"
import { ProviderError, webUrl } from "../providers/http"
import { allowedMediaUrl } from "../providers/media-url"
import { seal } from "../library/tokens"
import { resolveYoutube, youtubeSearch } from "./youtube"

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
    const term=query.trim()||(trending?"trending songs official music":`new music releases ${new Date().getFullYear()} official audio`)
    const items=searchTracks({results:await youtubeSearch(term)}).slice(0,30)
    return {results:items,message:query?"Song search results. Release dates are shown when supplied.":trending?"Trending song picks, not an official ranked chart. Play or download full audio when available.":"New music discovery. Release dates are shown only when supplied."}
  })
}
export function extractAudio(data:any):string {
  const r=data.result||data.data||data
  const media=(r.medias||r.formats||[]).find((m:any)=>/^(mp3|m4a|aac|audio)$|audio\//i.test(String(m.extension||m.type||m.mimeType||m.format||"")))
  return webUrl(r.audio?.url||r.mp3?.url||r.audio_url||r.audioUrl||media?.url||(typeof r.audio==="string"?r.audio:"")||(typeof r.mp3==="string"?r.mp3:"")||(/\.(mp3|m4a|aac)(?:[?#]|$)/i.test(r.url||"")?r.url:""))
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
  if(preview&&!title)throw new ProviderError("A song title is needed to find a full audio file.",400)
  const full=await resolveYoutube(preview?title:url,"audio",title)
  return {...full,downloadUrl:download?full.downloadUrl:undefined}
}

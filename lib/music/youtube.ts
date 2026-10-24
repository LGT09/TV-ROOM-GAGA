import "server-only"
import { providerJson, ProviderError, webUrl } from "../providers/http"
import { mediaFetch, allowedMediaUrl } from "../providers/media-url"
import { seal } from "../library/tokens"

const base="https://nayan-video-downloader.vercel.app"
const cache=new Map<string,{until:number;value:any}>()
const pending=new Map<string,Promise<any>>()
export function youtubeUrl(input:string) {
  try {
    const u=new URL(input)
    if(!["https:","http:"].includes(u.protocol))return ""
    const host=u.hostname.replace(/^(www|m|music)\./,"")
    const id=host==="youtu.be"?u.pathname.split("/")[1]:host==="youtube.com"?(u.searchParams.get("v")||u.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/)?.[1]):""
    return id&&/^[\w-]{11}$/.test(id)?`https://www.youtube.com/watch?v=${id}`:""
  }catch{return ""}
}
export function youtubeItems(data:any):any[] {
  const rows=data?.items||data?.results||data?.result||data?.data?.results||data?.data||[]
  if(!Array.isArray(rows))return []
  return rows.flatMap(v=>{
    const url=youtubeUrl(v.url||v.link||`https://youtu.be/${v.videoId||v.id||""}`)
    if(!url)return []
    return [{id:new URL(url).searchParams.get("v"),title:typeof v.title==="string"?v.title:v.title?.text||v.name||"YouTube video",
      thumbnail:webUrl(v.thumbnail||v.thumbnailUrl||v.thumbnails?.[0]?.url),duration:v.duration||v.length||"",
      author:typeof v.author==="string"?v.author:v.author?.name||v.channel?.name||v.channel||"",url}]
  })
}
export async function youtubeSearch(input:string) {
  const term=input.trim()
  if(!term||term.length>500)throw new ProviderError("Enter a song title, artist or YouTube video link.",400)
  const url=youtubeUrl(term)
  if(/^https?:\/\//i.test(term)&&!url)throw new ProviderError("Enter a valid YouTube video link.",400)
  if(url) {
    const id=new URL(url).searchParams.get("v")!
    let title="YouTube video"
    try{title=(await providerJson(`https://www.youtube.com/oembed?${new URLSearchParams({url,format:"json"})}`,4000)).title||title}catch{}
    return [{id,url,title,thumbnail:`https://i.ytimg.com/vi/${id}/hqdefault.jpg`,author:"",duration:""}]
  }
  for(const param of ["q","query"]) {
    try{const items=youtubeItems(await providerJson(`${base}/ytsearch?${new URLSearchParams({[param]:term})}`,6000));if(items.length)return items}catch{}
  }
  throw new ProviderError("YouTube search is temporarily unavailable. Try a direct video link.",502)
}
export function youtubeFiles(data:any,kind:"audio"|"video"):string[] {
  const r=data?.result||data?.data||data
  if(!r||typeof r!=="object")return []
  // Never mistake a watch page or a chart preview for a full media file.
  const values=kind==="audio"
    ?[r.audio?.url,r.mp3?.url,r.audio_url,r.audioUrl,typeof r.audio==="string"?r.audio:"",typeof r.mp3==="string"?r.mp3:"",r.download,r.downloadUrl,r.download_url,r.dl_url,r.dl]
    :[r.video_hd,r.video?.url,r.mp4?.url,typeof r.video==="string"?r.video:"",r.video_url,r.download,r.downloadUrl,r.download_url,r.dl_url,r.dl]
  for(const m of [...(Array.isArray(r.medias)?r.medias:[]),...(Array.isArray(r.formats)?r.formats:[])]) {
    const type=String(m.mimeType||m.type||m.extension||m.format||"")
    if(kind==="audio"?/audio|mp3|m4a|aac|ogg/i.test(type):/video|mp4|webm/i.test(type))values.push(m.url||m.downloadUrl)
  }
  if(r.url&&!youtubeUrl(r.url))values.push(r.url)
  return [...new Set(values.map(v=>typeof v==="string"?webUrl(v):"").filter(Boolean))].filter(url=>{
    try { const u=allowedMediaUrl(url);return !/(^|\.)mzstatic\.com$|(^|\.)itunes\.apple\.com$/.test(u.hostname) }catch{return false}
  })
}
async function verify(url:string,kind:"audio"|"video") {
  const response=await mediaFetch(url,{Range:"bytes=0-1023"},7000)
  const type=response.headers.get("content-type")||""
  const reader=response.body?.getReader()
  let bytes:Uint8Array|undefined
  const deadline=setTimeout(()=>{void reader?.cancel()},4000)
  try{bytes=(await reader?.read())?.value}finally{clearTimeout(deadline);await reader?.cancel()}
  const prefix=bytes?Buffer.from(bytes.subarray(0,48)).toString("ascii").trimStart():""
  if(!bytes?.length||/html|json|text\//i.test(type)||/^[<{]/.test(prefix))throw new Error("Not a media file")
  if(kind==="audio"&&!/audio\/|application\/octet-stream|video\/(mp4|webm)/i.test(type))throw new Error("No audio stream")
  if(kind==="video"&&!/video\/|application\/octet-stream/i.test(type))throw new Error("No video stream")
  return {url,format:kind==="video"?(/webm/i.test(type)?"WEBM":"MP4"):/webm/i.test(type)?"WEBM":/mp4|m4a/i.test(type)?"M4A":/aac/i.test(type)?"AAC":"MP3"}
}
export async function resolveYoutube(input:string,kind:"audio"|"video",title="",quality="720p") {
  const source=youtubeUrl(input)
  const query=source?"":input.trim()
  if(!source&&!query)throw new ProviderError("Enter a YouTube link or song title.",400)
  if(!source&&/^https?:\/\//i.test(query))throw new ProviderError("Unsupported YouTube link.",400)
  const key=`${source||query}:${kind}:${quality}`
  let full=cache.get(key)?.until!>Date.now()?cache.get(key)!.value:undefined
  if(!full) {
    let job=pending.get(key)
    if(!job){
      job=(async()=>{
        const params=new URLSearchParams({apikey:"knight",...(source?{url:source}:{query})})
        if(source&&kind==="audio")params.set("type","mp3")
        if(source&&kind==="video")params.set("format",quality)
        const endpoint=source?(kind==="audio"?"download":"download/ytmp4"):(kind==="audio"?"ytmp3":"ytmp4")
        const urls=[`https://knightbotapi.stream/api/${endpoint}?${params}`]
        if(source)urls.push(...["ytdown","alldown"].map(action=>`${base}/${action}?${new URLSearchParams({url:source})}`))
        const attempts=urls.map(async target=>{
          const data=await providerJson(target,12000)
          const files=youtubeFiles(data,kind)
          if(!files.length)throw new Error("No full file")
          const media=await Promise.any(files.map(url=>verify(url,kind)))
          return {...media,title:String(data.result?.title||data.data?.title||data.title||title||"YouTube media")}
        })
        if(query)attempts.push((async()=>{
          const match=(await youtubeSearch(query))[0]
          const data=await providerJson(`${base}/ytdown?${new URLSearchParams({url:match.url})}`,12000)
          const files=youtubeFiles(data,kind)
          if(!files.length)throw new Error("No full file")
          return {...await Promise.any(files.map(url=>verify(url,kind))),title:match.title}
        })())
        try{return await Promise.any(attempts)}catch{throw new ProviderError(`Full ${kind} is temporarily unavailable from the media services. Retry or choose another video.`,502)}
      })().then(value=>{if(cache.size>80)cache.delete(cache.keys().next().value!);cache.set(key,{until:Date.now()+60000,value});return value}).finally(()=>pending.delete(key))
      pending.set(key,job)
    }
    full=await job
  }
  const token=seal("media",{url:full.url,title:full.title,kind,format:full.format},21600)
  const playUrl=`/api/media?key=${token}`
  return {success:true,title:full.title,format:full.format,quality,isPreview:false,playUrl,audioUrl:kind==="audio"?playUrl:undefined,downloadUrl:`${playUrl}&download=1`}
}

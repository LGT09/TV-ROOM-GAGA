import "server-only"
import { providerJson, ProviderError, webUrl } from "../providers/http"
import { mediaFetch, allowedMediaUrl } from "../providers/media-url"
import { seal } from "../library/tokens"
import { preferPrimary } from "../providers/fallback"
import { fileSize } from "../media-info"

const base="https://nayan-video-downloader.vercel.app"
const cache=new Map<string,{until:number;value:any}>()
const pending=new Map<string,Promise<any>>()
const searchCache=new Map<string,{until:number;value:any[]}>()
const searchPending=new Map<string,Promise<any[]>>()
export function youtubePlaylist(input:string) {
  try {
    const u=new URL(input)
    if(!["https:","http:"].includes(u.protocol)||!["youtube.com","www.youtube.com","m.youtube.com","music.youtube.com"].includes(u.hostname))return ""
    const id=u.searchParams.get("list")||""
    return /^[\w-]{10,200}$/.test(id)?`https://www.youtube.com/playlist?list=${id}`:""
  }catch{return ""}
}
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
  const rows=data?.items||data?.results||data?.videos||data?.data?.results||data?.data?.videos||data?.result?.videos||data?.result||data?.data||[]
  if(!Array.isArray(rows))return []
  return rows.flatMap(v=>{
    const url=youtubeUrl(v.url||v.link||`https://youtu.be/${v.videoId||v.id||""}`)
    if(!url)return []
    return [{id:new URL(url).searchParams.get("v"),title:typeof v.title==="string"?v.title:v.title?.text||v.name||"YouTube video",
      thumbnail:webUrl(v.thumbnail||v.thumbnailUrl||v.thumbnails?.[0]?.url),duration:v.duration||v.length||"",
      author:typeof v.author==="string"?v.author:v.author?.name||v.channel?.name||v.channel||"",url}]
  })
}
async function search(input:string) {
  const term=input.trim()
  if(!term||term.length>500)throw new ProviderError("Enter a song title, artist or YouTube video link.",400)
  const url=youtubeUrl(term)
  const playlist=youtubePlaylist(term)
  if(playlist) {
    const items=youtubeItems(await providerJson(`${base}/ytsearch/playlist?${new URLSearchParams({url:playlist})}`,9000))
    if(items.length)return items.slice(0,100)
    throw new ProviderError("This playlist has no accessible videos.",404)
  }
  if(/^https?:\/\//i.test(term)&&!url)throw new ProviderError("Enter a valid YouTube video link.",400)
  for(const param of ["q","query"]) {
    try{
      const items=youtubeItems(await providerJson(`${base}/ytsearch?${new URLSearchParams({[param]:url||term})}`,6000))
      const matches=url?items.filter(item=>item.url===url):items
      if(matches.length)return matches
    }catch{}
  }
  throw new ProviderError("YouTube search is temporarily unavailable. Try a direct video link.",502)
}
export async function youtubeSearch(input:string):Promise<any[]> {
  const key=input.trim()
  const hit=searchCache.get(key)
  if(hit&&hit.until>Date.now())return hit.value
  if(searchPending.has(key))return searchPending.get(key)!
  const job=search(key).then(value=>{
    if(searchCache.size>=60)searchCache.delete(searchCache.keys().next().value!)
    searchCache.set(key,{until:Date.now()+120000,value})
    return value
  }).finally(()=>searchPending.delete(key))
  searchPending.set(key,job)
  return job
}
export function youtubeFiles(data:any,kind:"audio"|"video"):string[] {
  const r=data?.result||data?.data||data
  if(!r||typeof r!=="object")return []
  // Never mistake a watch page or a chart preview for a full media file.
  const values=kind==="audio"
    ?[r.audio?.url,r.mp3?.url,r.audio_url,r.audioUrl,typeof r.audio==="string"?r.audio:"",typeof r.mp3==="string"?r.mp3:"",r.download,r.downloadUrl,r.download_url,r.dl_url,r.dl]
    :[r.video_hd,r.video?.url,r.mp4?.url,typeof r.video==="string"?r.video:"",r.video_url,r.download,r.downloadUrl,r.download_url,r.dl_url,r.dl]
  for(const m of [...(Array.isArray(r.medias)?r.medias:[]),...(Array.isArray(r.formats)?r.formats:[])]) {
    const type=String(m.type||"")
    const mime=String(m.mimeType||m.extension||m.ext||m.format||"")
    // Adaptive video-only tracks are silent, and must not be offered as complete videos.
    if(/video_only|audio_only/.test(type)&&!(kind==="audio"&&type==="audio_only"))continue
    if(kind==="audio"?/^audio/.test(type)||/^audio\//.test(mime)||/^(mp3|m4a|aac|ogg)$/.test(mime):
      !/^audio/.test(type)&&m.hasAudio!==false&&(/video|mp4|webm/i.test(type+" "+mime)))values.push(m.url||m.downloadUrl)
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
  return {url,sizeBytes:fileSize(response.headers),format:kind==="video"?(/webm/i.test(type)?"WEBM":"MP4"):/webm/i.test(type)?"WEBM":/mp4|m4a/i.test(type)?"M4A":/aac/i.test(type)?"AAC":"MP3"}
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
         const from=async(target:string,fallbackTitle=title)=>{
           const data=await providerJson(target,9000)
          const files=youtubeFiles(data,kind)
          if(!files.length)throw new Error("No full file")
          const checks=await Promise.allSettled(files.slice(0,6).map(url=>verify(url,kind)))
          const info=data.result||data.data||data
          const choices=checks.flatMap(check=>{
            if(check.status!=="fulfilled")return []
            const media=check.value
            const file=[...(Array.isArray(info.formats)?info.formats:[]),...(Array.isArray(info.medias)?info.medias:[])].find(item=>(item.url||item.downloadUrl)===media.url)
            const declared=String(file?.quality||file?.resolution||file?.label||info.quality||"")
            const returnedQuality=declared.match(/(\d{3,4})(?:p|\b)/)?.[1]
            const bitrate=declared.match(/(\d+)\s*k(?:b(?:p?s)?)?/i)?.[1]
            return [{...media,quality:kind==="video"?(returnedQuality?`${returnedQuality}p`:"Auto"):bitrate?`${bitrate} kbps`:"Original quality"}]
          })
          if(!choices.length)throw new Error("No verified full files")
          const selected=choices.find(choice=>choice.quality===quality)||choices[0]
          return {...selected,choices,title:String(info.title||data.title||fallbackTitle||"YouTube media")}
         }
         const match=source?Promise.resolve({url:source,title}):youtubeSearch(query).then(items=>items[0])
         const primary=["ytdown","youtube","alldown"].map(action=>async()=>{
           const item=await match
           return from(`${base}/${action}?${new URLSearchParams({url:item.url,quality})}`,item.title)
         })
         try{return await preferPrimary(primary,[()=>from(`https://knightbotapi.stream/api/${endpoint}?${params}`)],1200)}
         catch{throw new ProviderError(`Full ${kind} is temporarily unavailable from the media services. Retry or choose another video.`,502)}
      })().then(value=>{if(cache.size>80)cache.delete(cache.keys().next().value!);cache.set(key,{until:Date.now()+60000,value});return value}).finally(()=>pending.delete(key))
      pending.set(key,job)
    }
    full=await job
  }
  const token=seal("media",{url:full.url,title:full.title,kind,format:full.format},21600)
  const playUrl=`/api/media?key=${token}`
  const choices=(full.choices||[full]).map((choice:any)=>{
    const link=`/api/media?key=${seal("media",{url:choice.url,title:full.title,kind,format:choice.format},21600)}`
    return {format:choice.format,quality:choice.quality,sizeBytes:choice.sizeBytes,playUrl:link,downloadUrl:`${link}&download=1`}
  })
  return {success:true,title:full.title,format:full.format,quality:full.quality||"Auto",sizeBytes:full.sizeBytes,choices,isPreview:false,playUrl,audioUrl:kind==="audio"?playUrl:undefined,downloadUrl:`${playUrl}&download=1`}
}

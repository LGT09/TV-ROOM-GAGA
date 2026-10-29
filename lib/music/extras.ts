import "server-only"
import { youtubeUrl } from "./youtube"
import { ProviderError } from "../providers/http"
import { sidecarZip } from "./zip"
export type SongExtrasInput={title:string;artist:string;url:string}
const cache=new Map<string,{until:number;value:Awaited<ReturnType<typeof build>>}>()
const pending=new Map<string,Promise<Awaited<ReturnType<typeof build>>>>()
let lyricsTail:Promise<unknown>=Promise.resolve(),lyricsQueued=0,blockedUntil=0
const normalized=(s:string)=>s.toLowerCase().replace(/[^\p{L}\p{N}]/gu,"")
export function songIdentity(input:SongExtrasInput){
  let title=input.title.replace(/\[[^\]]*\]|\([^)]*(?:official|audio|video|lyrics|visualizer|hd|4k)[^)]*\)/gi,"").trim()
  let artist=input.artist.replace(/\s*(?:VEVO|-\s*Topic)$/i,"").trim()
  const split=title.split(/\s+[-–—]\s+/)
  if(split.length===2){artist=split[0].trim();title=split[1].trim()}
  return {title,artist}
}
async function lyricsFor(title:string,artist:string) {
  if(!artist||lyricsQueued>=5||Date.now()<blockedUntil)return null
  lyricsQueued++
  const job=lyricsTail.catch(()=>{}).then(async()=>{
    if(Date.now()<blockedUntil)return null
    const response=await fetch(`https://lrclib.net/api/get?${new URLSearchParams({track_name:title,artist_name:artist})}`,{
      headers:{"User-Agent":"TVRoomGaga/1.0 (https://traxxiontech.com)","Accept":"application/json"},signal:AbortSignal.timeout(5000),redirect:"error",
    })
    if(response.status===429||response.status===503){
      const retry=response.headers.get("retry-after")||"60"
      const seconds=Number(retry)
      blockedUntil=Number.isFinite(seconds)?Date.now()+Math.max(1,seconds)*1000:Math.max(Date.now()+1000,Date.parse(retry)||Date.now()+60000)
      return null
    }
    if(!response.ok)return null
    const text=await response.text()
    if(text.length>500000)return null
    const record=JSON.parse(text)
    return normalized(record.trackName||"")===normalized(title)&&normalized(record.artistName||"")===normalized(artist)?record:null
  }).catch(()=>null).finally(()=>{lyricsQueued--})
  lyricsTail=job.then(()=>new Promise(done=>setTimeout(done,250)))
  return job
}
async function artwork(url:string) {
  const videoId=new URL(url).searchParams.get("v")
  try{
    // Fixed host and validated video ID: never proxy arbitrary image URLs.
    const response=await fetch(`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,{signal:AbortSignal.timeout(5000),redirect:"error"})
    if(!response.ok||!/image\/jpeg/i.test(response.headers.get("content-type")||""))return null
    const reader=response.body?.getReader()
    if(!reader)return null
    const chunks:Uint8Array[]=[];let size=0
    try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>2000000)return null;chunks.push(value)}}finally{await reader.cancel().catch(()=>{})}
    return size?Buffer.concat(chunks):null
  }catch{return null}
}
async function build(input:SongExtrasInput){
  const identity=songIdentity(input)
  const [lyrics,cover]=await Promise.all([lyricsFor(identity.title,identity.artist),artwork(input.url)])
  const files:{name:string;data:Buffer}[]=[]
  const metadata={title:identity.title,artist:identity.artist,suppliedTitle:input.title,suppliedArtistOrUploader:input.artist,
    creditsVerified:!!lyrics,album:lyrics?.albumName||null,durationSeconds:lyrics?.duration||null,
    artworkType:cover?"Video thumbnail (not verified album artwork)":null,lyricsSource:lyrics?"LRCLIB":null,
    lyricsStatus:lyrics?.instrumental?"Instrumental":lyrics?.plainLyrics||lyrics?.syncedLyrics?"Available":"Unavailable: no verified lyrics match or service unavailable"}
  files.push({name:"artist-and-track.json",data:Buffer.from(JSON.stringify(metadata,null,2))})
  if(cover)files.push({name:"cover.jpg",data:cover})
  if(lyrics?.plainLyrics)files.push({name:"lyrics.txt",data:Buffer.from(lyrics.plainLyrics)})
  if(lyrics?.syncedLyrics)files.push({name:"lyrics.lrc",data:Buffer.from(lyrics.syncedLyrics)})
  const notes=["TV ROOM GAGA song extras","Audio is downloaded separately, in its native format. These files are not embedded audio tags.",
    cover?"cover.jpg is the music video's thumbnail, not verified album art.":"Cover art could not be retrieved.",
    `Lyrics: ${metadata.lyricsStatus}. Credits are verified only when an exact title/artist lyrics record matches.`,
    "No artist biography, release date or lyrics are invented. Respect copyright and use only where authorized."]
  files.push({name:"README.txt",data:Buffer.from(notes.join("\n"))})
  return {bytes:sidecarZip(files),files:files.map(f=>({name:f.name,sizeBytes:f.data.length})),lyricsStatus:metadata.lyricsStatus,title:identity.title}
}
export function prepareSongExtras(input:SongExtrasInput){
  const url=youtubeUrl(input.url)
  if(!url||!input.title.trim())throw new ProviderError("Select a YouTube song with a title.",400)
  input={title:input.title.slice(0,200),artist:input.artist.slice(0,200),url}
  const key=JSON.stringify(input),hit=cache.get(key)
  if(hit&&hit.until>Date.now())return Promise.resolve(hit.value)
  if(pending.has(key))return pending.get(key)!
  const job=build(input).then(value=>{if(cache.size>=30)cache.delete(cache.keys().next().value!);cache.set(key,{until:Date.now()+300000,value});return value}).finally(()=>pending.delete(key))
  pending.set(key,job);return job
}

import "server-only"
import type { Channel } from "./iptv"
import { publicStreamFetch } from "./public-stream"

export type ChannelHealth = { id:string; active:boolean; latencyMs:number; checkedAt:number }
const cache=new Map<string,ChannelHealth>()
const pending=new Map<string,Promise<ChannelHealth>>()

async function responds(url:string) {
  let response:Response|undefined
  let reader:ReadableStreamDefaultReader<Uint8Array>|undefined
  let timer:ReturnType<typeof setTimeout>|undefined
  try {
    response=(await publicStreamFetch(url,/\.m3u8(?:[?#]|$)/i.test(url)?{}:{Range:"bytes=0-1023"},2500)).response
    const type=response.headers.get("content-type")||""
    if(/html|json/i.test(type))return false
    reader=response.body?.getReader()
    if(!reader)return false
    const first=await Promise.race([
      reader.read(),
      new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error("No stream data")),1200)}),
    ])
    if(!first.value?.length)return false
    return /^(video\/|audio\/|application\/(?:octet-stream|vnd\.apple\.mpegurl|x-mpegurl|dash\+xml))/i.test(type) ||
      new TextDecoder().decode(first.value).trimStart().startsWith("#EXTM3U")
  } catch { return false }
  finally { clearTimeout(timer); if(reader)await reader.cancel().catch(()=>{});else await response?.body?.cancel().catch(()=>{}) }
}
export async function checkChannel(channel:Channel):Promise<ChannelHealth> {
  const hit=cache.get(channel.id)
  if(hit&&Date.now()-hit.checkedAt<60000)return hit
  if(pending.has(channel.id))return pending.get(channel.id)!
  const job=(async()=>{
    const started=Date.now()
    // Bound each check, trying two independently listed streams concurrently.
    const active=await Promise.any(channel.streams.slice(0,2).map(async stream=>{
      if(!await responds(stream.url))throw new Error("Unavailable")
      return true
    })).catch(()=>false)
    const result={id:channel.id,active,latencyMs:Date.now()-started,checkedAt:Date.now()}
    if(cache.size>=2000)cache.delete(cache.keys().next().value!)
    cache.set(channel.id,result)
    return result
  })().finally(()=>pending.delete(channel.id))
  pending.set(channel.id,job)
  return job
}

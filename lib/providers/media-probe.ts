import "server-only"
import { mediaFetch } from "./media-url"
import { fileSize } from "../media-info"

/** Validate a short media response, never buffer the full film. */
export async function probeMedia(url:string) {
  const response=await mediaFetch(url,{Range:"bytes=0-1023"},3500)
  const type=response.headers.get("content-type")||""
  const reader=response.body?.getReader()
  let timer:ReturnType<typeof setTimeout>|undefined
  try{
    if(!reader||/html|json/i.test(type))throw new Error("Not media")
    const chunk=await Promise.race([reader.read(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error("Empty media")),1200)})])
    const bytes=chunk.value
    if(!bytes?.length)throw new Error("Empty media")
    const prefix=Buffer.from(bytes.subarray(0,64)).toString("ascii").trimStart()
    if(/^\{/.test(prefix)||prefix.startsWith("<")&&!/application\/dash\+xml/i.test(type))throw new Error("Not media")
    const recognized=/^(video\/|audio\/|application\/(?:octet-stream|vnd\.apple\.mpegurl|x-mpegurl|dash\+xml))/i.test(type)
    const signature=prefix.startsWith("#EXTM3U")||prefix.startsWith("ID3")||prefix.slice(4,8)==="ftyp"||(bytes[0]===0x1a&&bytes[1]===0x45&&bytes[2]===0xdf&&bytes[3]===0xa3)
    if(!recognized&&!signature)throw new Error("Unrecognized media")
    return {sizeBytes:fileSize(response.headers),type}
  }finally{clearTimeout(timer);await reader?.cancel().catch(()=>{})}
}

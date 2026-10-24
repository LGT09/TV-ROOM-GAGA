import { NextResponse } from "next/server"
import { seal, unseal } from "@/lib/library/tokens"
import { publicStreamFetch, publicStreamUrl, manifestText } from "@/lib/providers/public-stream"
import { ProviderError } from "@/lib/providers/http"
export const dynamic="force-dynamic"
export const runtime="nodejs"
type StreamToken={url:string;hls?:boolean}
export async function GET(request:Request){
  try{
    const p=new URL(request.url).searchParams
    const token=unseal<StreamToken>(p.get("key")||"","tv-stream")
    const range=request.headers.get("range")
    if(range&&!/^bytes=(\d+-\d*|-\d+)$/.test(range))throw new ProviderError("Invalid byte range.",416)
    const {response,url}=await publicStreamFetch(token.url,range?{Range:range}:{})
    const type=response.headers.get("content-type")||"application/octet-stream"
    if(/text\/html|application\/json/i.test(type)){await response.body?.cancel();throw new ProviderError("This channel did not return a playable stream.")}
    const headers=new Headers({"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Type":type})
    if(token.hls||/mpegurl/i.test(type)||/\.m3u8(?:[?#]|$)/i.test(url)){
      const text=await manifestText(response)
      const child=(relative:string,hls=false)=>{
        const target=publicStreamUrl(new URL(relative,url).href).href
        const playlist=hls||/\.m3u8(?:[?#]|$)/i.test(target)
        return `/api/tv-stream?key=${seal("tv-stream",{url:target,hls:playlist},21600)}${playlist?"&format=hls":""}`
      }
      let variant=false
      const result=text.split(/\r?\n/).map(line=>{
        if(!line.trim())return line
        if(!line.startsWith("#")){const result=child(line.trim(),variant);variant=false;return result}
        if(line.startsWith("#EXT-X-STREAM-INF:"))variant=true
        return line.replace(/URI="([^"]+)"/g,(_all,relative)=>`URI="${child(relative,/^#EXT-X-(MEDIA|I-FRAME-STREAM-INF):/.test(line))}"`)
      }).join("\n")
      headers.set("Content-Type","application/vnd.apple.mpegurl")
      return new Response(result,{headers})
    }
    for(const name of ["Content-Range","Accept-Ranges"]){const value=response.headers.get(name);if(value)headers.set(name,value)}
    return new Response(response.body,{status:response.status,headers})
  }catch(e){return NextResponse.json({error:e instanceof ProviderError?e.message:"This channel could not be loaded. Try another source."},{status:e instanceof ProviderError?e.status:502})}
}

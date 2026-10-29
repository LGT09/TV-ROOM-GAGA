import { NextResponse } from "next/server"
import { prepareSongExtras, type SongExtrasInput } from "@/lib/music/extras"
import { seal,unseal } from "@/lib/library/tokens"
import { ProviderError } from "@/lib/providers/http"
export const dynamic="force-dynamic"
export const runtime="nodejs"
export const maxDuration=60
export async function POST(request:Request){
  try{
    const origin=request.headers.get("origin")
    const host=request.headers.get("host")||new URL(request.url).host
    if(!origin||!/^https?:$/.test(new URL(origin).protocol)||new URL(origin).host!==host)return NextResponse.json({error:"Invalid origin."},{status:403})
    const text=await request.text()
    if(text.length>4000)throw new ProviderError("Request too large.",400)
    const input=JSON.parse(text)
    if(!["title","artist","url"].every(key=>typeof input[key]==="string"))throw new ProviderError("Invalid song.",400)
    const data=await prepareSongExtras(input)
    const key=seal("music-extras",{title:input.title.slice(0,200),artist:input.artist.slice(0,200),url:input.url.slice(0,500)},3600)
    return NextResponse.json({success:true,files:data.files,lyricsStatus:data.lyricsStatus,sizeBytes:data.bytes.length,downloadUrl:`/api/music-extras?key=${key}`},{headers:{"Cache-Control":"private, no-store"}})
  }catch(e){return NextResponse.json({success:false,error:e instanceof ProviderError?e.message:"Song extras could not be prepared."},{status:e instanceof ProviderError?e.status:502})}
}
export async function GET(request:Request){
  try{
    const input=unseal<SongExtrasInput>(new URL(request.url).searchParams.get("key")||"","music-extras")
    const data=await prepareSongExtras(input)
    const name=(data.title||"song").replace(/[^\w. -]/g,"_").slice(0,100)
    return new Response(new Uint8Array(data.bytes),{headers:{"Content-Type":"application/zip","Content-Disposition":`attachment; filename="${name}-extras.zip"`,"Content-Length":String(data.bytes.length),"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}})
  }catch(e){return NextResponse.json({error:e instanceof ProviderError?e.message:"Song extras link is unavailable. Prepare it again."},{status:e instanceof ProviderError?e.status:502})}
}

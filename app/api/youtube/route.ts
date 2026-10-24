import { NextResponse } from "next/server"
import { youtubeSearch, resolveYoutube } from "@/lib/music/youtube"
import { ProviderError } from "@/lib/providers/http"
export const runtime="nodejs"
export const dynamic="force-dynamic"
export const maxDuration=60
export async function GET(request:Request) {
  const p=new URL(request.url).searchParams
  try {
    const action=p.get("action")||"search"
    const input=(p.get("url")||p.get("query")||p.get("q")||(p.get("videoId")?`https://youtu.be/${p.get("videoId")}`:"")).slice(0,2000)
    if(action==="search"||action==="trending")return NextResponse.json({success:true,items:await youtubeSearch(input||"popular music videos")})
    if(action==="download"||action==="video-details"){
      if(action==="video-details")return NextResponse.json({success:true,...(await youtubeSearch(input))[0]})
      const quality=p.get("quality")||"720p"
      if(!["360p","480p","720p","1080p"].includes(quality))throw new ProviderError("Unsupported quality.",400)
      return NextResponse.json(await resolveYoutube(input,["mp3","audio"].includes(p.get("format")||"")?"audio":"video","",quality))
    }
    throw new ProviderError("Unsupported YouTube action.",400)
  }catch(e){return NextResponse.json({success:false,items:[],error:e instanceof ProviderError?e.message:"YouTube media is temporarily unavailable."},{status:e instanceof ProviderError?e.status:502})}
}

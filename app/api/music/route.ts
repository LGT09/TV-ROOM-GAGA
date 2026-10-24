import { NextResponse } from "next/server"
import { musicList, musicFile } from "@/lib/music/service"
import { ProviderError } from "@/lib/providers/http"
export const dynamic="force-dynamic"
export async function GET(request:Request) {
  const p=new URL(request.url).searchParams
  try{
    const action=p.get("action")||"latest"
    if(["latest","trending","search"].includes(action))return NextResponse.json(await musicList(action==="search"?(p.get("query")||"").slice(0,200):"",action==="trending"),{headers:{"Cache-Control":"private, max-age=30"}})
    if(["get-audio","download-mp3"].includes(action))return NextResponse.json(await musicFile((p.get("url")||"").slice(0,2500),(p.get("title")||"").slice(0,200),action==="download-mp3",p.get("full")==="1"))
    throw new ProviderError("Unsupported music action.",400)
  }catch(e){return NextResponse.json({success:false,results:[],error:e instanceof ProviderError?e.message:"Music is temporarily unavailable. Please retry."},{status:e instanceof ProviderError?e.status:502})}
}

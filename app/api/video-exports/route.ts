import { NextResponse } from "next/server"
import { startVideoExport, videoExportStatus } from "@/lib/video-exports"
import { ProviderError } from "@/lib/providers/http"

export const dynamic="force-dynamic"
export const maxDuration=60
function failure(error:unknown) {
  return NextResponse.json({error:error instanceof ProviderError?error.message:"Video processing could not be reached. Try again later."},{status:error instanceof ProviderError?error.status:502,headers:{"Cache-Control":"private, no-store"}})
}
export async function POST(request:Request) {
  try {
    const origin=request.headers.get("origin")
    if(!origin||new URL(origin).host!==request.headers.get("host"))throw new ProviderError("Start video processing from this website.",403)
    if(Number(request.headers.get("content-length")||0)>20000)throw new ProviderError("Request too large.",413)
    const text=await request.text()
    if(text.length>20000)throw new ProviderError("Request too large.",413)
    const body=JSON.parse(text)
    if(body.confirmed!==true)throw new ProviderError("Confirm video processing before submitting.",400)
    return NextResponse.json(await startVideoExport(String(body.key||"")),{status:202,headers:{"Cache-Control":"private, no-store"}})
  }catch(error){return failure(error)}
}
export async function GET(request:Request) {
  try{return NextResponse.json(await videoExportStatus(new URL(request.url).searchParams.get("key")||""),{headers:{"Cache-Control":"private, no-store"}})}
  catch(error){return failure(error)}
}

import { NextResponse } from "next/server"
import { libraryDetail, libraryList, libraryStream } from "@/lib/library/service"
import { ProviderError } from "@/lib/providers/http"

export const dynamic = "force-dynamic"
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams
  const action = p.get("action") || "list"
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const result = action === "list" ? await libraryList(p) :
      action === "detail" ? await libraryDetail(p.get("key") || "") :
      action === "stream" ? await Promise.race([libraryStream(p.get("key") || "", p), new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new ProviderError("The alternate connections took too long. Please retry shortly.", 504)), 22000)
      })]) : null
    if (!result) return NextResponse.json({ success: false, error: "Unknown library action." }, { status: 400 })
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } })
  } catch (e) {
    return NextResponse.json({ success: false, items: [], sources: [], error: e instanceof ProviderError ? e.message : "The request could not be completed. Please retry shortly." }, { status: e instanceof ProviderError ? e.status : 502 })
  } finally { if(timer)clearTimeout(timer) }
}

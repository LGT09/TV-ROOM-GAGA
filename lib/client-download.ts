import { readApiJson } from "./client-json"
import { queueVideoExport } from "./client-video-exports"

/** Stream into the browser's download manager, not into a multi-gigabyte JavaScript Blob. */
export async function saveMediaFile(input:string,filename?:string,signal?:AbortSignal) {
  if(typeof navigator!=="undefined"&&!navigator.onLine)throw new Error("You are offline. Reconnect to download this file.")
  const url=new URL(input,window.location.origin)
  if(url.origin!==window.location.origin||url.pathname!=="/api/media")throw new Error("Prepare a secure download from the library first.")
  url.searchParams.set("download","1")
  const response=await fetch(url.href,{method:"HEAD",cache:"no-store",signal:signal||AbortSignal.timeout(18000)})
  if(!response.ok||/json|html|text\//i.test(response.headers.get("content-type")||"")){
    throw new Error(response.status===400?"This download link expired. Refresh the sources and try again.":"The file could not be reached. Try another quality or refresh the sources.")
  }
  if(signal?.aborted)throw new DOMException("Cancelled","AbortError")
  if(response.headers.get("X-TVRoom-Media-Kind")==="video"&&response.headers.get("X-TVRoom-Watermark")!=="permanent"&&response.headers.get("X-TVRoom-Download-Mode")!=="original"){
    await queueVideoExport(url,filename,signal)
    return "queued" as const
  }
  const link=document.createElement("a")
  link.href=url.href
  link.download=filename||""
  document.body.appendChild(link)
  link.click()
  link.remove()
  return "downloaded" as const
}

export async function resolveMovieDownload(title:string,quality="720p",signal?:AbortSignal) {
  const options={cache:"no-store" as const,signal:signal||AbortSignal.timeout(30000)}
  const found=await readApiJson(await fetch(`/api/movie-download?${new URLSearchParams({action:"search",query:title})}`,options))
  const clean=(value:string)=>value.toLowerCase().replace(/[^\p{L}\p{N}]/gu,"")
  const movie=found.results?.find((item:{title:string})=>clean(item.title)===clean(title))
  if(!movie)throw new Error("Select the matching title in Movies & series to download it.")
  const data=await readApiJson(await fetch(`/api/movie-download?${new URLSearchParams({action:"download",key:movie.key||movie.id,quality})}`,options))
  if(!data.downloadUrl)throw new Error(data.error||"No downloadable file was returned.")
  return data
}

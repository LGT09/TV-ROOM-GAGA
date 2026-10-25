import { readApiJson } from "./client-json"

export type VideoExport={id:string;key?:string;mediaKey:string;title:string;status:string;created:number;downloadUrl?:string;message?:string}
const storageKey="tvroom.video-exports.v1"
const eventName="tvroom:video-exports"
export function savedVideoExports():VideoExport[] {
  try {
    const data=JSON.parse(localStorage.getItem(storageKey)||"[]")
    return Array.isArray(data)?data.filter(item=>item&&typeof item.id==="string"&&Date.now()-item.created<23*3600000).slice(0,10):[]
  }catch{return []}
}
function store(items:VideoExport[]) {
  localStorage.setItem(storageKey,JSON.stringify(items.slice(0,10)))
  window.dispatchEvent(new Event(eventName))
}
export function watchVideoExports(callback:()=>void) {
  window.addEventListener(eventName,callback);window.addEventListener("storage",callback)
  return ()=>{window.removeEventListener(eventName,callback);window.removeEventListener("storage",callback)}
}
export function removeVideoExport(id:string) {store(savedVideoExports().filter(item=>item.id!==id))}
function update(id:string,patch:Partial<VideoExport>) {store(savedVideoExports().map(item=>item.id===id?{...item,...patch}:item))}
export async function queueVideoExport(url:URL,title?:string,signal?:AbortSignal) {
  const mediaKey=url.searchParams.get("key")||""
  if(savedVideoExports().some(item=>item.mediaKey===mediaKey&&!["failed","unknown"].includes(item.status)))return
  if(savedVideoExports().filter(item=>!["done","failed","unknown"].includes(item.status)).length>=3)throw new Error("Three videos are already processing. Wait for one to finish.")
  if(!window.confirm("Prepare a video with TV ROOM GAGA permanently embedded? The video will be sent to the background processor and may take several minutes. Use only videos you are authorized to process."))
    throw new Error("Video processing was not started.")
  const item:VideoExport={id:crypto.randomUUID(),mediaKey,title:title||"Watermarked video",status:"submitting",created:Date.now()}
  store([item,...savedVideoExports()])
  try{
    const response=await fetch("/api/video-exports",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({key:mediaKey,confirmed:true}),signal:signal||AbortSignal.timeout(55000)})
    if(!response.ok){
      const data=await response.json().catch(()=>({}))
      update(item.id,{status:"failed",message:data.error||"The processor rejected this request. No file was substituted."})
      throw new Error(data.error||"Video processing could not start.")
    }
    const data=await readApiJson(response)
    if(!data.key)throw new Error("No processing confirmation was received.")
    update(item.id,{key:data.key,title:data.title,status:"queued"})
  }catch(error){
    if(savedVideoExports().find(job=>job.id===item.id)?.status!=="failed")update(item.id,{status:"unknown",message:"Submission was not confirmed. A render may still be running; check the processing account before submitting again."})
    throw error
  }
}
export async function refreshVideoExport(item:VideoExport) {
  if(!item.key)return
  try {
    const data=await readApiJson(await fetch(`/api/video-exports?key=${encodeURIComponent(item.key)}`,{cache:"no-store",signal:AbortSignal.timeout(20000)}))
    update(item.id,{status:data.status,downloadUrl:data.downloadUrl,message:data.message})
  }catch(error){update(item.id,{message:error instanceof Error?error.message:"Could not check progress. Reconnect and try again."})}
}

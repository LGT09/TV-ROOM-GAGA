import "server-only"
import { ReplitConnectors } from "@replit/connectors-sdk"
import { ProviderError } from "./providers/http"
import { allowedMediaUrl } from "./providers/media-url"
import { seal, unseal } from "./library/tokens"

type Media = { url:string; kind:string; title?:string; format?:string; branded?:boolean }
type Job = { id:string; title:string }
const pending=new Map<string,{expires:number;promise:Promise<{key:string;title:string}>}>()
let windowStart=Date.now(), submissions=0

async function shotstack(path:string,body?:unknown) {
  const options={method:body?"POST":"GET",headers:{"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{})}
  let response:Response
  try {
    response=process.env.SHOTSTACK_API_KEY
      ?await fetch(`https://api.shotstack.io${path}`,{...options,headers:{...options.headers,"x-api-key":process.env.SHOTSTACK_API_KEY},signal:AbortSignal.timeout(25000),cache:"no-store"})
      :await new ReplitConnectors().proxy("shotstack",path,options)
  } catch { throw new ProviderError("Video processing is unavailable. Check the server’s Shotstack connection.",503) }
  const data=await response.json().catch(()=>null)
  if(!response.ok||!data?.success) {
    if(response.status===401||response.status===403)throw new ProviderError("Video processing is not authorized. Check the server’s Shotstack connection.",503)
    if(response.status===402)throw new ProviderError("The video-processing account needs credits before this video can be rendered.",503)
    if(response.status===429)throw new ProviderError("Video processing is busy. Try again shortly.",429)
    throw new ProviderError("The processor could not accept this video. The source may be inaccessible or account limits may apply.",502)
  }
  return data.response
}

export function watermarkEdit(url:string,width:number,height:number) {
  const scale=Math.min(1,1920/width,1920/height)
  const w=Math.max(2,Math.round(width*scale/2)*2),h=Math.max(2,Math.round(height*scale/2)*2)
  return {
    timeline:{tracks:[
      {clips:[{asset:{type:"rich-text",text:"TV ROOM GAGA",font:{family:"Open Sans",size:Math.max(14,Math.round(w*.022)),weight:700,color:"#FFFFFF"},stroke:{width:1,color:"#000000"},shadow:{offsetX:1,offsetY:2,blur:3,color:"#000000",opacity:.85}},start:0,length:"alias://source",position:"topRight",offset:{x:-.025,y:-.035},width:Math.round(w*.36),height:Math.max(40,Math.round(h*.10))}]},
      {clips:[{alias:"source",asset:{type:"video",src:url,volume:1},start:0,length:"auto",fit:"contain"}]}
    ]},
    output:{format:"mp4",size:{width:w,height:h},quality:"high"}
  }
}

export async function startVideoExport(mediaKey:string) {
  const media=unseal<Media>(mediaKey,"media")
  if(media.kind!=="video"||media.branded)throw new ProviderError("Choose an original video file to prepare a watermarked download.",400)
  if(media.format==="HLS"||media.format==="segment"||/\.m3u8(?:[?#]|$)/i.test(media.url))throw new ProviderError("Live/adaptive streams cannot be exported here. Choose a downloadable video file.",400)
  const url=allowedMediaUrl(media.url).href
  for(const [key,value] of pending)if(value.expires<Date.now())pending.delete(key)
  const existing=pending.get(mediaKey)
  if(existing)return existing.promise
  if(Date.now()-windowStart>3600000){windowStart=Date.now();submissions=0}
  // Defence in depth, not a durable account-wide billing quota.
  if(submissions>=10||pending.size>=50)throw new ProviderError("The video-processing limit was reached. Try again later.",429)
  submissions++
  const promise=(async()=>{
    const probe=await shotstack(`/edit/v1/probe/${encodeURIComponent(url)}`)
    const metadata=probe?.metadata||probe
    const streams=metadata?.streams||[]
    const video=streams.find((stream:{codec_type?:string})=>stream.codec_type==="video")
    const duration=Number(metadata?.format?.duration||video?.duration)
    const width=Number(video?.width),height=Number(video?.height)
    if(!width||!height||!Number.isFinite(duration)||duration<=0||duration>21600)throw new ProviderError("This video could not be inspected, or exceeds the six-hour export limit.",400)
    const render=await shotstack("/edit/v1/render",watermarkEdit(url,width,height))
    if(!/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(render?.id||""))throw new ProviderError("The processor did not return a valid render job.",502)
    const title=media.title||"TV Room video"
    return {key:seal("video-export",{id:render.id,title},86400),title}
  })()
  pending.set(mediaKey,{expires:Date.now()+86400000,promise})
  promise.catch(()=>pending.delete(mediaKey))
  return promise
}

export async function videoExportStatus(key:string) {
  const job=unseal<Job>(key,"video-export")
  const result=await shotstack(`/edit/v1/render/${job.id}?data=false`)
  if(result.status==="failed")return {status:"failed",message:"Video processing failed. The source may have expired, blocked processing, or exceeded account limits. No unwatermarked file was substituted."}
  if(result.status!=="done")return {status:String(result.status||"queued")}
  // Only accept the processor’s render-result locations, never arbitrary S3 buckets.
  const url=new URL(result.url)
  if(url.protocol!=="https:"||url.port||!/^shotstack-api-v1-output(?:-[a-z0-9-]+)?\.s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com$/i.test(url.hostname))throw new ProviderError("The processed file location could not be verified.",502)
  return {status:"done",downloadUrl:`/api/media?key=${seal("media",{url:url.href,kind:"video",format:"MP4",title:job.title,branded:true},3600)}&download=1`}
}

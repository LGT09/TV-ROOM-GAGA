import "server-only"
import { lookup } from "node:dns/promises"
import { request } from "node:https"
import { isIP } from "node:net"
import { Readable } from "node:stream"
import { ProviderError, BROWSER_USER_AGENT } from "./http"

export function isPublicIp(address:string):boolean {
  if(isIP(address)===4){
    const [a,b,c]=address.split(".").map(Number)
    return !(a===0||a===10||a===127||a>=224||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===168||b===0||b===2))||(a===100&&b>=64&&b<=127)||(a===198&&(b===18||b===19||b===51&&c===100))||(a===203&&b===0&&c===113))
  }
  return isIP(address)===6&&/^[23][\da-f]{3}:/i.test(address)&&!/^2001:(db8|0):/i.test(address)
}
export function publicStreamUrl(input:string){
  const url=new URL(input)
  if(url.protocol!=="https:"||url.username||url.password||url.port||url.hostname.endsWith(".local")||url.hostname==="localhost")throw new ProviderError("This stream address is not permitted.",400)
  return url
}
/** Pin the checked public IP into TLS lookup, including after every redirect. */
export async function publicStreamFetch(input:string,headers:Record<string,string>={},timeout=15000):Promise<{response:Response;url:string}>{
  let url=publicStreamUrl(input)
  for(let redirects=0;redirects<5;redirects++){
    const hostname=url.hostname.replace(/^\[|\]$/g,"")
    const addresses=isIP(hostname)?[{address:hostname,family:isIP(hostname)}]:await lookup(hostname,{all:true,verbatim:true})
    if(!addresses.length||addresses.some(a=>!isPublicIp(a.address)))throw new ProviderError("This stream address is not permitted.",400)
    const address=addresses.find(a=>a.family===4)||addresses[0]
    const response=await new Promise<Response>((resolve,reject)=>{
      const upstream=request(url,{
        headers:{"User-Agent":BROWSER_USER_AGENT,"Accept-Encoding":"identity",...headers},
        lookup:((_host:string,options:any,callback:any)=>options?.all?callback(null,[address]):callback(null,address.address,address.family)) as any,
      },incoming=>{
        clearTimeout(connectionTimer)
        const h=new Headers()
        for(const [key,value]of Object.entries(incoming.headers))if(value)h.set(key,Array.isArray(value)?value.join(", "):String(value))
        const status=incoming.statusCode||502
        resolve(new Response([204,304].includes(status)?null:Readable.toWeb(incoming) as ReadableStream,{status,headers:h}))
      })
      const connectionTimer=setTimeout(()=>upstream.destroy(new Error("Stream connection timed out")),timeout)
      upstream.setTimeout(15000,()=>upstream.destroy(new Error("Stream connection timed out")))
      upstream.on("error",error=>{clearTimeout(connectionTimer);reject(error)})
      upstream.end()
    })
    if(response.status>=300&&response.status<400){
      const location=response.headers.get("location")
      await response.body?.cancel()
      if(!location)throw new ProviderError("Stream redirect is unavailable.")
      url=publicStreamUrl(new URL(location,url).href);continue
    }
    if(!response.ok){await response.body?.cancel();throw new ProviderError("This stream is offline or unavailable in this region. Try another source.")}
    return {response,url:url.href}
  }
  throw new ProviderError("Too many stream redirects.")
}
export async function manifestText(response:Response){
  const reader=response.body?.getReader(),chunks:Uint8Array[]=[]
  if(!reader)throw new ProviderError("Empty stream manifest.")
  let bytes=0
  while(true){
    const {value,done}=await reader.read()
    if(done)break
    bytes+=value.byteLength
    if(bytes>1_000_000){await reader.cancel();throw new ProviderError("Stream manifest is too large.")}
    chunks.push(value)
  }
  const text=Buffer.concat(chunks).toString("utf8")
  if(!text.trimStart().startsWith("#EXTM3U"))throw new ProviderError("Invalid stream manifest.")
  return text
}

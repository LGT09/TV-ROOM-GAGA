import { webUrl, ProviderError, BROWSER_USER_AGENT } from "./http"

// Not an open URL proxy: only public provider/CDN namespaces used by the app.
const suffixes = ["aoneroom.com", "hakunaymatata.com", "dramaboxdb.com", "omegatech.app", "mzstatic.com", "itunes.apple.com", "archive.org", "sinhalasub.lk", "image.tmdb.org", "googlevideo.com", "nayan-video-downloader.vercel.app", "savetube.vip", "vidsnap.app", "tiktokcdn.com", "tiktokcdn-us.com", "tiktokv.com", "muscdn.com", "fbcdn.net", "cdninstagram.com"]
export function allowedMediaUrl(input: string) {
  const value = webUrl(input)
  if (!value) throw new ProviderError("Invalid media URL.", 400)
  const u = new URL(value)
  // The API emits legacy HTTP links for this verified HTTPS-capable relay.
  if(u.protocol==="http:"&&u.hostname==="stream.omegatech.app")u.protocol="https:"
  const renderOutput=/^shotstack-api-v1-output(?:-[a-z0-9-]+)?\.s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com$/i.test(u.hostname)
  if (u.protocol !== "https:" || u.port || (!renderOutput&&!suffixes.some(h => u.hostname === h || u.hostname.endsWith(`.${h}`)))) throw new ProviderError("This media host cannot be relayed securely. Try another source.", 400)
  return u
}
export async function mediaFetch(input: string, headers: Record<string, string> = {}, timeout=15000) {
  let url = allowedMediaUrl(input)
  for (let i = 0; i < 4; i++) {
    const controller=new AbortController()
    const timer=setTimeout(()=>controller.abort(),timeout)
    let response:Response
    try{
      response=await fetch(url,{headers:{"User-Agent":BROWSER_USER_AGENT,...headers},redirect:"manual",signal:controller.signal,cache:"no-store"})
    }finally{clearTimeout(timer)}
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location")
      await response.body?.cancel()
      if (!location) throw new ProviderError("Media redirect has no location.")
      url = allowedMediaUrl(new URL(location, url).href)
      continue
    }
    if (!response.ok) throw new ProviderError(`Media host returned HTTP ${response.status}.`)
    return response
  }
  throw new ProviderError("Too many media redirects.")
}

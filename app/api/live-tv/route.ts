import { NextResponse } from "next/server"
import { getChannels } from "@/lib/providers/iptv"
import { integer } from "@/lib/providers/http"
import { countryInfo } from "@/lib/countries"
import { seal } from "@/lib/library/tokens"
import { checkChannel } from "@/lib/providers/channel-health"

export const dynamic = "force-dynamic"
export const maxDuration = 30
let healthBatches=0
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams
  const action = p.get("action") || p.get("path") || "channels"
  try {
    const { channels, source, warnings } = await getChannels()
    if(action==="ping"){
      const ids=[...new Set((p.get("ids")||p.get("channelId")||"").split(",").filter(Boolean))]
      if(!ids.length||ids.length>6)return NextResponse.json({success:false,error:"Check between one and six catalogue channels at a time."},{status:400})
      if(healthBatches>=2)return NextResponse.json({success:false,error:"Channel checks are busy. Please retry shortly."},{status:429,headers:{"Retry-After":"3"}})
      const selected=ids.map(id=>channels.find(channel=>channel.id===id))
      if(selected.some(channel=>!channel))return NextResponse.json({success:false,error:"Channel not found."},{status:404})
      healthBatches++
      try{
        const results=await Promise.all(selected.map(channel=>checkChannel(channel!)))
        return NextResponse.json({success:true,results,note:"A responding stream is not a guarantee of playback in your region."},{headers:{"Cache-Control":"private, no-store"}})
      }finally{healthBatches--}
    }
    const categories = [...new Set(channels.flatMap(c => c.categories))].sort()
    const countries = [...new Set(channels.map(c => c.country))].sort()
    const q = (p.get("q") || p.get("query") || "").trim().toLowerCase()
    const category = (p.get("category") || "").toLowerCase()
    const country = (p.get("country") || "").toUpperCase()
    const filtered = channels.filter(c => (!q || `${c.name} ${c.categories.join(" ")} ${c.country} ${countryInfo(c.country).name}`.toLowerCase().includes(q)) &&
      (!category || category === "all" || c.categories.some(v => v.toLowerCase() === category)) &&
      (!country || country === "ALL" || c.country.toUpperCase() === country))
    if (action === "stream") {
      const channel = channels.find(c => c.id === p.get("channelId"))
      if (!channel) return NextResponse.json({ success: false, error: "Channel not found." }, { status: 404 })
      const streams=channel.streams.map(stream=>({...stream,url:`/api/tv-stream?key=${seal("tv-stream",{url:stream.url,hls:/\.m3u8(?:[?#]|$)/i.test(stream.url)},21600)}${/\.m3u8(?:[?#]|$)/i.test(stream.url)?"&format=hls":""}`}))
      return NextResponse.json({ success: true, channel:{...channel,streamUrl:streams[0]?.url,streams}, streamUrl:streams[0]?.url, streams })
    }
    if (action === "categories") return NextResponse.json({ success: true, categories, data: categories })
    if (action === "countries") return NextResponse.json({ success: true, countries, data: countries })
    if (action === "status") return NextResponse.json({ success: true, total: channels.length, source, warnings, note: "Stream URLs are listed by upstream directories; availability is checked by the player, not inferred from the catalogue." })
    if (action === "home" || action === "onnow") {
      const onnow = filtered.slice(0, 50).map(c => ({ ...c, channel_name: c.name, title: c.name, thumbnail: c.logo, stream_url: c.streamUrl, url: c.streamUrl }))
      return NextResponse.json({ success: true, data: onnow, banners: onnow.slice(0, 5), onnow, categories, source, warnings })
    }
    if (!["channels", "search"].includes(action)) return NextResponse.json({ success: false, error: "Unknown live TV action." }, { status: 400 })
    const offset = integer(p.get("offset"), 0, 100000)
    const limit = Math.max(1, integer(p.get("limit"), 100, 500))
    const data = filtered.slice(offset, offset + limit)
    return NextResponse.json({ success: true, channels: data, results: data, data, categories, countries, totalChannels: filtered.length, total: filtered.length, offset, limit, source, warnings,
      note: "HTTPS streams only. A listed stream may be offline, geo-restricted or blocked by browser CORS policies." })
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "Live TV unavailable.", channels: [], results: [] }, { status: 502 })
  }
}

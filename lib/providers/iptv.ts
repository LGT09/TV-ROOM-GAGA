import "server-only"
import { providerJson, webUrl } from "./http"

export interface Channel {
  id: string; name: string; category: string; categories: string[]; country: string
  logo: string; streamUrl: string; streams: { url: string; quality: string }[]; hasStream: boolean
}
interface Catalogue { channels: Channel[]; source: string; warnings: string[] }
let cache: { expires: number; data: Catalogue } | undefined
let pending: Promise<Catalogue> | undefined
const OMEGA = "https://api.omegatech.app/api/movie/Iptv"
const list = (data: any): any[] => Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : Array.isArray(data?.results) ? data.results : []
const secureStream = (value: unknown) => { const url = webUrl(value); return url.startsWith("https://") ? url : "" }

export function parseM3u(text: string): Channel[] {
  const results: Channel[] = []
  let info: { id: string; name: string; logo: string; category: string } | undefined
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith("#EXTINF:")) {
      const attr = (name: string) => line.match(new RegExp(`${name}="([^"]*)"`))?.[1] || ""
      info = { id: attr("tvg-id").split("@")[0], logo: attr("tvg-logo"), category: attr("group-title").split(";")[0].toLowerCase() || "general", name: line.slice(line.indexOf(",") + 1).trim() }
    } else if (info && line && !line.startsWith("#")) {
      const url = secureStream(line.trim())
      if (url && info.name) results.push({
        ...info, id: info.id || `m3u-${results.length}`, categories: [info.category], country: info.id.match(/\.([a-z]{2})(?:$|@)/i)?.[1].toUpperCase() || "GLOBAL",
        logo: webUrl(info.logo), streamUrl: url, streams: [{ url, quality: info.name.match(/\((\d+p)\)/)?.[1] || "Auto" }], hasStream: true,
      })
      info = undefined
    }
  }
  return results
}

async function playlist() {
  const response = await fetch("https://iptv-org.github.io/iptv/index.m3u", { signal: AbortSignal.timeout(18000), cache: "no-store", redirect: "error" })
  if (!response.ok) throw new Error(`Public playlist returned ${response.status}`)
  const text = await response.text()
  if (!text.startsWith("#EXTM3U")) throw new Error("Public playlist format has changed")
  return parseM3u(text)
}

export async function getChannels(): Promise<Catalogue> {
  if (cache && cache.expires > Date.now()) return cache.data
  if (pending) return pending
  pending = (async () => {
    const [omega, m3u] = await Promise.allSettled([
      Promise.all([providerJson(`${OMEGA}?action=channels`), providerJson(`${OMEGA}?action=streams`)]),
      playlist(),
    ])
    const warnings: string[] = []
    const map = new Map<string, Channel>()
    const streamsById = new Map<string, any[]>()
    const streamsByTitle = new Map<string, any[]>()
    if (omega.status === "fulfilled") {
      const [rawChannels, rawStreams] = omega.value.map(list)
      for (const s of rawStreams) {
        const id = String(s.channel || "").split("@")[0]
        if (id) streamsById.set(id, [...(streamsById.get(id) || []), s])
        const title = String(s.title || "").trim().toLowerCase()
        if (title) streamsByTitle.set(title, [...(streamsByTitle.get(title) || []), s])
      }
      for (const c of rawChannels) {
        if (!c?.name || c.is_nsfw || c.closed || c.replaced_by) continue
        const id = String(c.id || c.name)
        const streams = (streamsById.get(id) || streamsByTitle.get(c.name.trim().toLowerCase()) || [])
          .map(s => ({ url: secureStream(s.url), quality: String(s.quality || "Auto") })).filter(s => s.url)
        const own = secureStream(c.url || c.stream_url)
        if (own && !streams.some(s => s.url === own)) streams.push({ url: own, quality: "Auto" })
        streams.sort((a, b) => (parseInt(b.quality) || 0) - (parseInt(a.quality) || 0))
        if (!streams.length) continue
        const categories = Array.isArray(c.categories) && c.categories.length ? c.categories : ["general"]
        map.set(id, { id, name: c.name, country: c.country || "GLOBAL", category: categories[0], categories, logo: webUrl(c.logo || c.posterUrl), streamUrl: streams[0].url, streams, hasStream: true })
      }
    } else warnings.push("One TV directory is unavailable. An alternate channel directory is in use.")
    if (m3u.status === "fulfilled") {
      for (const c of m3u.value) {
        const existing = map.get(c.id)
        if (existing) {
          if (!existing.logo) existing.logo = c.logo
          for (const s of c.streams) if (!existing.streams.some(e => e.url === s.url)) existing.streams.push(s)
        } else map.set(c.id, c)
      }
    } else warnings.push("One TV directory is unavailable. An alternate channel directory is in use.")
    const channels = [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
    if (!channels.length) throw new Error("Both live TV directories are unavailable. Please retry later.")
    const data = { channels, source: [omega.status === "fulfilled" ? "OmegaTech IPTV" : "", m3u.status === "fulfilled" ? "iptv-org" : ""].filter(Boolean).join(" + "), warnings }
    cache = { expires: Date.now() + 300000, data }
    return data
  })().finally(() => { pending = undefined })
  return pending
}

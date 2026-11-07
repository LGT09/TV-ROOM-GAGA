import "server-only"

import { createHash } from "node:crypto"
import { BROWSER_USER_AGENT, ProviderError } from "./http"

const API = "https://drkamran-apis.onrender.com"
const SINHALASUB_HOSTS = new Set(["sinhalasub.lk", "www.sinhalasub.lk"])

export type KamranMovieResult = {
  subjectId: string
  detailPath: string
  title: string
  cover: string
  genre: string
  imdbRatingValue: string
  description: string
  releaseDate: string
  sourceUrl: string
  subjectType: string
}

export type KamranDownloadPage = { quality: string; size: string; url: string }

function apiKey(name: "KAMRAN_DOWNLOAD_API_KEY" | "KAMRAN_SEARCH_API_KEY") {
  const value = process.env[name]?.trim()
  if (!value) throw new ProviderError("Movie fallback service is not configured.", 503)
  return value
}

async function kamranJson(url: URL, timeout = 9000) {
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": BROWSER_USER_AGENT },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(timeout),
  }).catch((error: any) => {
    throw new ProviderError(error?.name === "TimeoutError" ? "A movie fallback timed out." : "A movie fallback is unavailable.")
  })
  const text = await response.text()
  if (text.length > 8_000_000) throw new ProviderError("Movie fallback response is too large.")
  let data: any
  try { data = JSON.parse(text) } catch { throw new ProviderError("Movie fallback returned an invalid response.") }
  if (!response.ok || data?.success === false || data?.status === false) {
    throw new ProviderError("A movie fallback could not complete the request.", response.status >= 400 ? response.status : 502)
  }
  return data
}

function rowsOf(data: any): any[] {
  const candidates = [data?.results, data?.data?.results, data?.data?.items, data?.items, data?.result?.results, data?.data]
  return candidates.find(Array.isArray) || []
}

export function safeKamranTitleUrl(input: unknown) {
  if (typeof input !== "string" || input.length > 2048) return ""
  try {
    const url = new URL(input)
    if (url.protocol !== "https:" || !SINHALASUB_HOSTS.has(url.hostname) || url.username || url.password || url.port) return ""
    if (!/^\/(?:movies|tvshows)\/[a-z0-9-]+\/?$/i.test(url.pathname)) return ""
    url.hash = ""
    return url.href
  } catch { return "" }
}

export function safeKamranDownloadPage(input: unknown) {
  if (typeof input !== "string" || input.length > 2048) return ""
  try {
    const url = new URL(input)
    if (url.protocol !== "https:" || !SINHALASUB_HOSTS.has(url.hostname) || url.username || url.password || url.port) return ""
    if (!/^\/links\/[a-z0-9_-]+\/?$/i.test(url.pathname)) return ""
    url.hash = ""
    return url.href
  } catch { return "" }
}

export function kamranSubjectId(sourceUrl: string) {
  const normalized = new URL(sourceUrl).origin.toLowerCase() + new URL(sourceUrl).pathname.replace(/\/+$/, "").toLowerCase()
  const digest = createHash("sha256").update(normalized).digest("hex").slice(0, 16)
  const id = BigInt(`0x${digest}`) % BigInt("9000000000000000000") + BigInt("1000000000000000000")
  return String(id)
}

export function normalizedKamranSearchRows(data: any): KamranMovieResult[] {
  return rowsOf(data).flatMap((item: any) => {
    const title = String(item?.title || item?.name || "").trim().slice(0, 180)
    const sourceUrl = safeKamranTitleUrl(item?.url || item?.link || item?.detailUrl || item?.detail_url)
    if (!title || !sourceUrl) return []
    const year = String(item?.year || title.match(/\b(?:19|20)\d{2}\b/)?.[0] || "")
    const type = /series|tv|show/i.test(String(item?.type || "")) || /\/tvshows\//i.test(sourceUrl) ? "series" : "movie"
    return [{
      subjectId: kamranSubjectId(sourceUrl),
      detailPath: "",
      title,
      cover: String(item?.poster || item?.cover?.url || item?.cover || ""),
      genre: String(item?.genre || item?.genres || ""),
      imdbRatingValue: String(item?.imdbRatingValue || item?.imdbRating || item?.rating || ""),
      description: String(item?.description || item?.overview || ""),
      releaseDate: year,
      sourceUrl,
      subjectType: type,
    }]
  })
}

export async function searchKamranSinhalasub(query: string, page: number) {
  const url = new URL(`${API}/api/search/sinhalasub`)
  url.searchParams.set("q", query.slice(0, 120))
  url.searchParams.set("page", String(page))
  url.searchParams.set("key", apiKey("KAMRAN_SEARCH_API_KEY"))
  const raw = await kamranJson(url, 8000)
  const pager = raw?.pagination || raw?.pager || raw?.data?.pagination || {}
  return {
    items: normalizedKamranSearchRows(raw),
    hasMore: Boolean(raw?.hasMore ?? pager?.hasMore),
    nextPage: Number(raw?.nextPage || pager?.nextPage) || null,
  }
}

function downloadRows(data: any): any[] {
  const values = [data?.downloads, data?.data?.downloads, data?.result?.downloads, data?.data?.results, data?.results, data?.data?.qualities]
  return values.flatMap(value => Array.isArray(value) ? value : [])
}

export function kamranDownloadPages(responses: any[]): KamranDownloadPage[] {
  const found = new Map<string, KamranDownloadPage>()
  for (const response of responses) {
    const payload = response?.data || response?.result || response
    const rows = downloadRows(response)
    for (const row of rows) {
      const url = safeKamranDownloadPage(row?.url || row?.link || row?.downloadUrl || row?.download_url)
      if (!url || found.has(url)) continue
      found.set(url, {
        quality: String(row?.quality || row?.resolution || row?.label || "Download").slice(0, 60),
        size: String(row?.size || "").slice(0, 40),
        url,
      })
    }
    for (const key of ["downloadPageLink", "directDownloadUrl", "download_url", "downloadUrl"]) {
      const url = safeKamranDownloadPage(payload?.[key])
      if (url && !found.has(url)) found.set(url, { quality: String(payload?.quality || "Download").slice(0, 60), size: String(payload?.size || "").slice(0, 40), url })
    }
  }
  return [...found.values()]
}

export async function kamranMovieDownloads(sourceUrl: string) {
  const safeUrl = safeKamranTitleUrl(sourceUrl)
  if (!safeUrl) throw new ProviderError("The movie page is not from a supported catalogue.", 400)
  const key = apiKey("KAMRAN_DOWNLOAD_API_KEY")
  const endpoints = ["sinhalasub", "movie", "cinesubz"]
  const responses = await Promise.allSettled(endpoints.map(async name => {
    const url = new URL(`${API}/api/download/${name}`)
    url.searchParams.set("url", safeUrl)
    url.searchParams.set("key", key)
    return kamranJson(url, 12000)
  }))
  const successful = responses.flatMap(result => result.status === "fulfilled" ? [result.value] : [])
  const pages = kamranDownloadPages(successful)
  if (!pages.length) throw new ProviderError("The movie providers returned no downloadable link pages.", 502)
  return pages
}


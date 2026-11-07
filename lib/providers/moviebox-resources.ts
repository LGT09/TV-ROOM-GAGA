type SourceKind = "stream" | "download"

function nestedUrls(value: unknown): string[] {
  if (typeof value === "string") return [value]
  if (Array.isArray(value)) return value.flatMap(nestedUrls)
  if (!value || typeof value !== "object") return []
  const record = value as Record<string, unknown>
  return [
    "url", "proxyUrl", "streamUrl", "stream_url", "downloadUrl", "download_url",
    "directUrl", "direct_url", "videoUrl", "video_url", "fileUrl", "file_url",
    "originalStreamUrl", "original_stream_url", "originalDownloadUrl", "original_download_url",
    "playUrl", "play_url",
    "bestQualityUrl", "best_quality_url", "hls", "dash", "src",
  ].flatMap(key => nestedUrls(record[key]))
}

export function movieResourcePayload(raw: any, subjectId?: string) {
  const containers = [
    raw,
    raw?.data,
    raw?.data?.data,
    raw?.result,
    raw?.data?.result,
    raw?.data?.raw,
    raw?.resource,
    raw?.data?.resource,
  ].filter(value => value && typeof value === "object")

  for (const container of containers) {
    if (container.qualities?.length || container.sources?.length ||
        container.availableStreams?.length || container.streams?.length ||
        container.proxyStream || container.proxyDownload ||
        container.bestQualityUrl || container.best_quality_url || container.hls || container.dash) return container
  }
  for (const container of containers) {
    for (const key of ["results", "items"]) {
      const items = container[key]
      if (!Array.isArray(items)) continue
      const item = subjectId
        ? items.find((candidate: any) => String(candidate?.subjectId || candidate?.subject_id || candidate?.id || "") === subjectId)
        : items[0]
      if (item && (item.qualities?.length || item.sources?.length ||
          item.availableStreams?.length || item.streams?.length ||
          item.proxyStream || item.proxyDownload || item.streamUrl || item.downloadUrl ||
          item.bestQualityUrl || item.best_quality_url || item.hls || item.dash)) return item
    }
  }
  return containers[0] || raw || {}
}

export function movieSearchResponses(rawResponses: any[]) {
  const payloads = rawResponses.map(raw => {
    const candidates = [raw?.data?.data, raw?.data, raw?.result, raw]
    return candidates.find(value => Array.isArray(value?.results) || Array.isArray(value?.items)) || raw
  })
  const itemsById = new Map<string, any>()
  for (const payload of payloads) {
    const rows = Array.isArray(payload?.results) ? payload.results : Array.isArray(payload?.items) ? payload.items : []
    for (const item of rows) {
      const id = String(item?.subjectId || item?.subject_id || item?.id || "")
      if (!id) continue
      const existing = itemsById.get(id) || {}
      itemsById.set(id, {
        ...existing,
        ...item,
        cover: item.cover || existing.cover,
        poster: item.poster || existing.poster,
        detailPath: item.detailPath || item.detail_path || item.slug || existing.detailPath,
      })
    }
  }
  return {
    payloads,
    items: [...itemsById.values()],
    payload: payloads.find(value => Array.isArray(value?.results) || Array.isArray(value?.items)) || payloads[0] || {},
  }
}

export function mergeMovieResourceResponses(rawResponses: any[], subjectId: string) {
  const records: any[] = []
  const subtitles: any[] = []
  const seen = new Set<string>()
  for (const raw of rawResponses) {
    const payload = movieResourcePayload(raw, subjectId)
    for (const key of ["qualities", "sources", "availableStreams", "streams"]) {
      if (Array.isArray(payload?.[key])) records.push(...payload[key])
    }
    if (movieSourceCandidates(payload, "stream").length || movieSourceCandidates(payload, "download").length) records.push(payload)
    const captions = payload?.proxySubtitles || payload?.subtitles || []
    if (Array.isArray(captions)) subtitles.push(...captions)
    else if (captions && typeof captions === "object") subtitles.push(...Object.values(captions))
  }
  const sources = records.filter(record => {
    const key = JSON.stringify({
      stream: movieSourceCandidates(record, "stream"),
      download: movieSourceCandidates(record, "download"),
      quality: record?.quality || record?.resolution || "",
    })
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  return sources.length
    ? { qualities: sources, subtitles, proxySubtitles: subtitles }
    : rawResponses[0] || {}
}

export function movieSourceCandidates(item: any, kind: SourceKind): string[] {
  const keys = kind === "stream"
    ? ["originalStreamUrl", "original_stream_url", "directStreamUrl", "directUrl", "streamUrl", "stream_url", "proxyStream", "playUrl", "play_url", "videoUrl", "video_url", "url"]
    : ["originalDownloadUrl", "original_download_url", "directDownloadUrl", "directUrl", "downloadUrl", "download_url", "fileUrl", "file_url", "proxyDownload", "url", "originalStreamUrl", "streamUrl"]
  const allKeys = kind === "stream"
    ? [...keys, "bestQualityUrl", "best_quality_url", "direct_url", "hls", "dash"]
    : [...keys, "bestQualityUrl", "best_quality_url", "direct_url"]
  return [...new Set(allKeys.flatMap(key => nestedUrls(item?.[key])).filter(value => /^https?:\/\//i.test(value) || /^\/api\/media(?:\?|$)/.test(value)))]
}

export function movieLocalMediaPath(value: string, download = false) {
  if (!/^\/api\/media(?:\?|$)/.test(value)) return ""
  try {
    const url = new URL(value, "https://tvroom.invalid")
    if (url.origin !== "https://tvroom.invalid") return ""
    if (download) url.searchParams.set("download", "1")
    return `${url.pathname}${url.search}`
  } catch { return "" }
}

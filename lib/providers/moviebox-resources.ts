type SourceKind = "stream" | "download"

function nestedUrls(value: unknown): string[] {
  if (typeof value === "string") return [value]
  if (Array.isArray(value)) return value.flatMap(nestedUrls)
  if (!value || typeof value !== "object") return []
  const record = value as Record<string, unknown>
  return [
    "url", "proxyUrl", "streamUrl", "stream_url", "downloadUrl", "download_url",
    "directUrl", "direct_url", "videoUrl", "video_url", "fileUrl", "file_url",
    "playUrl", "play_url", "bestQualityUrl", "best_quality_url", "hls", "dash", "src",
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
        container.availableStreams?.length || container.proxyStream || container.proxyDownload ||
        container.bestQualityUrl || container.best_quality_url || container.hls || container.dash) return container
  }
  for (const container of containers) {
    for (const key of ["results", "items"]) {
      const items = container[key]
      if (!Array.isArray(items)) continue
      const item = subjectId
        ? items.find((candidate: any) => String(candidate?.subjectId || candidate?.id || "") === subjectId)
        : items[0]
      if (item && (item.qualities?.length || item.sources?.length ||
          item.proxyStream || item.proxyDownload || item.streamUrl || item.downloadUrl ||
          item.bestQualityUrl || item.best_quality_url || item.hls || item.dash)) return item
    }
  }
  return containers[0] || raw || {}
}

export function movieSourceCandidates(item: any, kind: SourceKind): string[] {
  const keys = kind === "stream"
    ? ["proxyStream", "directUrl", "directStreamUrl", "streamUrl", "playUrl", "videoUrl", "url"]
    : ["proxyDownload", "directDownloadUrl", "directUrl", "downloadUrl", "fileUrl", "url", "streamUrl"]
  const allKeys = kind === "stream"
    ? [...keys, "bestQualityUrl", "best_quality_url", "stream_url", "direct_url", "video_url", "hls", "dash"]
    : [...keys, "bestQualityUrl", "best_quality_url", "download_url", "direct_url", "file_url"]
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

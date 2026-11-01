import "server-only"

import { providerJson, ProviderError } from "./http"

const actions = new Set(["trend", "feeds", "live", "matches", "leagues", "info", "aggregate", "news", "match-detail"])

export async function sportJson(params: Record<string, string>) {
  const requested = params.action || "aggregate"
  if (!actions.has(requested)) throw new Error("Unknown sport action.")
  const action = requested === "trend" ? "aggregate" : requested === "feeds" ? "live" : requested === "match-detail" ? "stream" : requested
  const query: Record<string, string> = { action }
  for (const [key, value] of Object.entries(params)) {
    if (key === "action" || !/^(matchId|leagueId|status|date|page|perPage|season)$/.test(key)) continue
    if (value.length <= 120) query[key] = value
  }
  const url = new URL("https://api.omegatech.app/api/Sport/Sport")
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value)
  try {
    return await providerJson(url.href, 15000)
  } catch (error) {
    if (error instanceof ProviderError) throw error
    throw new ProviderError("Sport service is temporarily unavailable.")
  }
}

export function safeMatch(match: any) {
  if (!match || typeof match !== "object") return match
  const { playPath, playSources, proxyStream: _proxyStream, streams: _streams, highlights: _highlights, replays: _replays, ...rest } = match
  return { ...rest, proxyStream: typeof playPath === "string" ? playPath : "" }
}

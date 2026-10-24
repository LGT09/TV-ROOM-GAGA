import "server-only"

export class ProviderError extends Error {
  constructor(message: string, public status = 502) { super(message) }
}
export const BROWSER_USER_AGENT="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"

/** All callers use fixed provider hosts, never a user-supplied fetch target. */
export async function providerJson(url: string, timeout = 18000, headers: Record<string, string> = {}) {
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": BROWSER_USER_AGENT, ...headers },
    signal: AbortSignal.timeout(timeout),
    cache: "no-store",
    redirect: "error",
  }).catch((e) => {
    throw new ProviderError(e.name === "TimeoutError" || e.name === "AbortError"
      ? "The provider timed out. Please retry or choose another provider."
      : "The provider could not be reached.")
  })
  if (!response.ok) throw new ProviderError(`Provider returned HTTP ${response.status}. Try another provider.`)
  const text = await response.text()
  if (text.length > 20_000_000) throw new ProviderError("Provider response is too large.")
  let data: any
  try { data = JSON.parse(text) } catch { throw new ProviderError("Provider returned a page instead of JSON.") }
  if (data?.success === false || data?.status === false || data?.status === "error" || Number(data?.statusCode) >= 400) {
    const detail = typeof data?.message === "string" ? data.message : typeof data?.error === "string" ? data.error : "Request failed"
    throw new ProviderError(`Provider: ${detail.slice(0, 220)}`)
  }
  return data
}

export function integer(value: string | null, fallback = 1, max = 10000) {
  const n = Number(value)
  return value && Number.isInteger(n) && n >= 0 ? Math.min(n, max) : fallback
}

export function webUrl(value: unknown): string {
  if (typeof value !== "string") return ""
  try {
    const url = new URL(value)
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : ""
  } catch { return "" }
}

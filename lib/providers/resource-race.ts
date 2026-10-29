/** Keep searching after empty/broken matches; cap concurrent provider pipelines. */
export async function resourceRace<T, R>(items: T[], work: (item: T) => Promise<R>, concurrency = 6): Promise<R> {
  let next = 0
  let finished = false
  const worker = async (): Promise<R> => {
    while (!finished && next < items.length) {
      const item = items[next++]
      try { const result=await work(item);finished=true;return result } catch { /* Continue with the next compatible connection. */ }
    }
    throw new Error("No usable resources")
  }
  return Promise.any(Array.from({ length: Math.min(concurrency, items.length) }, worker))
}

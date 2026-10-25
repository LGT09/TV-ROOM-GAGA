import "server-only"

/** Prefer the new services, but hedge a slow response without starting unnecessary fallbacks. */
export async function preferPrimary<T>(primary: (() => Promise<T>)[], fallback: (() => Promise<T>)[], delay = 1200): Promise<T> {
  let finished = false
  let started = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const first = Promise.any(primary.map(work => Promise.resolve().then(work)))
  const second = new Promise<T>((resolve, reject) => {
    const start = () => {
      if (finished || started) return
      started = true
      Promise.any(fallback.map(work => Promise.resolve().then(work))).then(resolve, reject)
    }
    timer = setTimeout(start, delay)
    void first.catch(start)
  })
  try { return await Promise.any([first, second]) }
  finally { finished = true; clearTimeout(timer) }
}

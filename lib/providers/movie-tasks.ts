import "server-only"
import { providerJson, ProviderError, webUrl } from "./http"
import { normalizeProvider } from "./normalize"

export type MovieTask = { id: string; param: string; pollUrl?: string }
const taskFields = ["taskId", "task_id", "taskid", "jobId", "job_id"]
export function movieTask(value: any, depth = 0): MovieTask | undefined {
  if (!value || typeof value !== "object" || depth > 4 || Array.isArray(value)) return
  for (const param of taskFields) {
    const id = value[param]
    if ((typeof id === "string" || typeof id === "number") && String(id).length <= 500) {
      return { id: String(id), param, pollUrl: value.statusUrl || value.status_url || value.pollUrl || value.poll_url || value.taskUrl || value.links?.status }
    }
  }
  for (const key of ["task", "job", "data", "result"]) {
    if (["task","job"].includes(key) && value[key]?.id) return {id:String(value[key].id),param:key==="task"?"taskId":"jobId",pollUrl:value[key].statusUrl||value[key].pollUrl||value.statusUrl||value.status_url}
    const found = movieTask(value[key], depth + 1)
    if (found) return {...found,pollUrl:found.pollUrl||value.statusUrl||value.status_url||value.pollUrl||value.poll_url}
  }
}
const pending = new Map<string, { data: any; task?:MovieTask; expires: number }>()
export function safeTaskUrl(value: string, request: string) {
  const url = new URL(value, request)
  const origin = new URL(request).origin
  if (url.origin !== origin || url.protocol !== "https:" || url.username || url.password) throw new ProviderError("Invalid movie preparation response.")
  return url.href
}
/** Only repeat the documented download action or a same-origin status URL supplied by it. */
export async function movieTaskRequest(request: string) {
  const deadline = Date.now() + 11000
  let data = pending.get(request)
  let current = data && data.expires > Date.now() ? data.data : await providerJson(request, 6000)
  let lastTask = data && data.expires>Date.now()?data.task:undefined
  for (let count = 0; count < 5; count++) {
    if (normalizeProvider(current, "task").sources.length) { pending.delete(request); return current }
    const task = movieTask(current)||lastTask
    if (!task) { pending.delete(request); return current }
    lastTask=task
    const state = String(current.status || current.data?.status || current.result?.status || current.task?.status || current.job?.status || "").toLowerCase()
    const root=current.data||current.result||current
    if(/^(completed|complete|success|ready|finished|done)$/.test(state)&&webUrl(root.url||root.link)){pending.delete(request);return current}
    if (/^(failed|error|cancelled|canceled|expired|locked|paid)$/.test(state)) {
      pending.delete(request)
      throw new ProviderError("The movie preparation task failed or requires access that is unavailable.")
    }
    if (/^(completed|complete|finished|done)$/.test(state)) {
      pending.delete(request)
      throw new ProviderError("The completed task returned no playable movie file.")
    }
    if (pending.size >= 100) pending.delete(pending.keys().next().value!)
    pending.set(request, { data: current, task, expires: Date.now() + 120000 })
    if (count === 4 || Date.now() >= deadline) throw new ProviderError("The movie is still being prepared. Check progress in a moment.", 425)
    const next = new URL(request)
    next.searchParams.set(task.param, task.id)
    const target = task.pollUrl ? safeTaskUrl(task.pollUrl, request) : next.href
    await new Promise(resolve => setTimeout(resolve, Math.min(200 * 2 ** count, 1000)))
    current = await providerJson(target, Math.min(3000, Math.max(250, deadline - Date.now())))
  }
  return current
}

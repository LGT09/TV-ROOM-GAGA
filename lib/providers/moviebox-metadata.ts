export type MovieCastMember = {
  name: string
  character?: string
  profileUrl?: string
}

const CAST_KEYS = new Set([
  "cast", "actors", "performers", "stars", "castmembers", "cast_members",
  "actorlist", "actor_list", "acting",
])
const WRAPPER_KEYS = new Set(["data", "item", "subject", "result", "results", "credits", "details"])

function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : ""
}

function castRows(value: unknown): any[] {
  const queue: Array<{ value: any; depth: number }> = [{ value, depth: 0 }]
  const rows: any[] = []
  const seen = new Set<any>()

  while (queue.length && rows.length < 60) {
    const current = queue.shift()!
    const node = current.value
    if (!node || typeof node !== "object" || seen.has(node) || current.depth > 5) continue
    seen.add(node)

    if (Array.isArray(node)) {
      rows.push(...node.slice(0, 60 - rows.length))
      continue
    }

    for (const [key, child] of Object.entries(node)) {
      const normalizedKey = key.toLowerCase().replace(/[^a-z_]/g, "")
      if (CAST_KEYS.has(normalizedKey) && Array.isArray(child)) {
        rows.push(...child.slice(0, 60 - rows.length))
      } else if (CAST_KEYS.has(normalizedKey) && child && typeof child === "object") {
        queue.push({ value: child, depth: current.depth + 1 })
      } else if (WRAPPER_KEYS.has(normalizedKey) && child && typeof child === "object") {
        queue.push({ value: child, depth: current.depth + 1 })
      } else if (/^(staff|stafflist|staff_list)$/i.test(key) && Array.isArray(child)) {
        rows.push(...child.filter((person: any) => {
          const role = text(person?.role || person?.job || person?.type || person?.staffType || person?.staff_type)
          return /\b(actor|actress|cast|performer|star)\b/i.test(role)
        }).slice(0, 60 - rows.length))
      }
    }
  }

  return rows
}

export function normalizeMovieCast(value: unknown): MovieCastMember[] {
  const output: MovieCastMember[] = []
  const seen = new Set<string>()

  for (const person of castRows(value)) {
    const name = typeof person === "string"
      ? person.trim()
      : text(person?.name || person?.actorName || person?.actor_name || person?.nameEn || person?.name_en || person?.title)
    if (!name || name.length > 120) continue
    const credit = typeof person === "object" && person
      ? text(person.job || person.profession || person.department || person.role || person.staffType || person.staff_type || person.character || person.characterName || person.character_name)
      : ""
    if (/\b(director|producer|writer|screenwriter|editor|cinematographer|composer|showrunner)\b/i.test(credit)) continue
    const key = name.toLocaleLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    const character = typeof person === "object" && person
      ? text(person.character || person.characterName || person.character_name || person.roleName || person.role_name)
      : ""
    const image = typeof person === "object" && person
      ? text(person.profileUrl || person.profile_url || person.profilePath || person.profile_path || person.avatar || person.image || person.photo || person.cover?.url)
      : ""
    const profileUrl = image.startsWith("https://") ? image : undefined

    output.push({ name, ...(character && character.toLowerCase() !== name.toLowerCase() ? { character: character.slice(0, 120) } : {}), ...(profileUrl ? { profileUrl } : {}) })
    if (output.length >= 24) break
  }

  return output
}

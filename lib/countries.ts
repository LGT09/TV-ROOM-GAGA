const aliases: Record<string, string> = { UK: "GB", USA: "US", UAE: "AE", ZAF: "ZA", ZWE: "ZW" }
const names = new Intl.DisplayNames(["en"], { type: "region" })
export function countryInfo(value: string) {
  const input = String(value || "GLOBAL").trim()
  const code = aliases[input.toUpperCase()] || input.toUpperCase()
  if (!/^[A-Z]{2}$/.test(code)) return { code: input, name: /GLOBAL|INT|WORLD|UNDEFINED/i.test(code) ? "Worldwide" : input, flag: "" }
  let name = input
  try { name = names.of(code) || input } catch { /* Preserve unrecognized names. */ }
  return { code, name, flag: String.fromCodePoint(...[...code].map(c => c.charCodeAt(0) + 127397)) }
}

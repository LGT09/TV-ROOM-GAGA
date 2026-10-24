export const categories = [
  { id: "all", label: "All titles" },
  { id: "horror", label: "Horror" },
  { id: "kids", label: "Kids & family" },
  { id: "comedy", label: "Comedy" },
  { id: "african", label: "African movies" },
  { id: "black-bet", label: "Black movies & BET" },
  { id: "action", label: "Action" },
  { id: "sci-fi", label: "Sci-fi" },
  { id: "cartoons", label: "Cartoons" },
  { id: "romance", label: "Romance" },
  { id: "anime", label: "Anime" },
]
const patterns: Record<string, RegExp> = {
  horror: /horror/i, kids: /kids|family|children/i, comedy: /comedy/i,
  african: /africa|nollywood|nigeria|ghana|kenya|zimbabwe|south africa|naija/i,
  "black-bet": /black|bet\+?|african.american/i, action: /action/i,
  "sci-fi": /sci.?fi|science.?fiction/i, cartoons: /animation|cartoon/i,
  romance: /romance|romantic/i, anime: /anime/i,
}
export function inCategory(item: { genres?: string[] }, category: string) {
  return category === "all" || Boolean(patterns[category]?.test((item.genres || []).join(" ")))
}
export function normalizedTitle(title: string) {
  return title.toLowerCase().replace(/\[[^\]]*\]|\([^)]*\)|sinhala subtitles.*|season\s*\d+|s\d+\s*$/gi, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim()
}
export function sameTitle(a: {title:string;year?:string}, b: {title:string;year?:string}) {
  return normalizedTitle(a.title) === normalizedTitle(b.title) && (!a.year || !b.year || Math.abs(Number(a.year) - Number(b.year)) <= 1)
}

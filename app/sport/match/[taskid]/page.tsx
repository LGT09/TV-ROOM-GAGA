import type { Metadata } from "next"
import { SharedSportMatch } from "@/components/shared-sport-match"
import { sportJson } from "@/lib/providers/sport"

type Props = { params: Promise<{ taskid: string }> }
export const dynamic = "force-dynamic"
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { taskid } = await params
  let title = "Sports match | TV Room GAGA"
  let description = "Watch a shared sports match on TV Room GAGA."
  try {
    const result = await sportJson({ action: "match-detail", matchId: taskid })
    const match = result?.data?.match
    if (match) {
      const home = typeof match.home === "string" ? match.home : match.home?.name
      const away = typeof match.away === "string" ? match.away : match.away?.name
      title = `${home || "Home"} vs ${away || "Away"} | TV Room GAGA`
      description = `${match.league || "Sports"} · ${match.score || match.status || "Live match"}`
    }
  } catch {}
  return { title, description, openGraph: { title, description }, twitter: { card: "summary", title, description } }
}
export default async function SharedSportMatchPage({ params }: Props) {
  const { taskid } = await params
  return <SharedSportMatch matchId={taskid.slice(0, 100)} />
}

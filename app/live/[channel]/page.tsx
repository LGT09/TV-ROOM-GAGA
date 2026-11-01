import type { Metadata } from "next"
import { SharedLive } from "@/components/shared-live"

type Props = { params: Promise<{ channel: string }> }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { channel } = await params
  const title = "Live TV channel | TV Room GAGA"
  const description = "Watch a shared public television channel on TV Room GAGA."
  return { title, description, openGraph: { title, description }, twitter: { card: "summary", title, description } }
}
export default async function SharedLivePage({ params }: Props) {
  const { channel } = await params
  return <SharedLive channelId={channel.slice(0, 200)} />
}

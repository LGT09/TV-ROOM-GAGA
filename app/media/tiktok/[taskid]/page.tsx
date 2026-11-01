import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { unseal } from "@/lib/library/tokens"
import { SharedTikTok } from "@/components/shared-tiktok"

type Props = { params: Promise<{ taskid: string }> }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { taskid } = await params
  const title = "Shared TikTok media | TV Room GAGA"
  const description = "A shared media link from TV Room GAGA."
  return { title, description, openGraph: { title, description }, twitter: { card: "summary", title, description } }
}
export default async function SharedTikTokPage({ params }: Props) {
  const { taskid } = await params
  try {
    const share = unseal<{ url: string }>(taskid, "tiktok-share")
    const url = new URL(share.url)
    if (url.protocol !== "https:" || !/(^|\.)tiktok\.com$/i.test(url.hostname)) notFound()
    return <SharedTikTok sourceUrl={url.href} />
  } catch { notFound() }
}

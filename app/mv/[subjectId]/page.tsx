import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { AppLayout } from "@/components/app-layout"
import { MovieBoxTitle } from "@/components/moviebox-title"
import { movieDetail } from "@/lib/providers/moviebox"

type Props = { params: Promise<{ subjectId: string }> }
export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { subjectId } = await params
  if (!/^\d{5,32}$/.test(subjectId)) return { title: "Movie | TV Room GAGA" }
  try {
    const subject = await movieDetail(subjectId)
    const title = String(subject.title || "Movie")
    const description = String(subject.description || `${title} on TV Room GAGA.`).slice(0, 300)
    const image = subject.cover?.url || subject.cover
    return {
      title: `${title} | TV Room GAGA`,
      description,
      openGraph: { title, description, type: "video.movie", images: typeof image === "string" && image.startsWith("https://") ? [{ url: image }] : undefined },
      twitter: { card: "summary_large_image", title, description, images: typeof image === "string" && image.startsWith("https://") ? [image] : undefined },
    }
  } catch { return { title: "Movie | TV Room GAGA", description: "Watch a movie on TV Room GAGA." } }
}

export default async function MoviePage({ params }: Props) {
  const { subjectId } = await params
  if (!/^\d{5,32}$/.test(subjectId)) notFound()
  let title = "Movie"
  try { title = String((await movieDetail(subjectId)).title || title) } catch {}
  return <MovieBoxTitle subjectId={subjectId} initialTitle={title} />
}

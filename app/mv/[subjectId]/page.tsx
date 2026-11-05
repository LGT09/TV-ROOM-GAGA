import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { AppLayout } from "@/components/app-layout"
import { MovieBoxTitle } from "@/components/moviebox-title"
import { movieDetail } from "@/lib/providers/moviebox"
import { unseal } from "@/lib/library/tokens"

type Props = { params: Promise<{ subjectId: string }>; searchParams?: Promise<{ resource?: string | string[]; title?: string | string[]; detailPath?: string | string[] }> }
export const dynamic = "force-dynamic"

function resourceFromSearch(token: string | undefined, subjectId: string) {
  if (!token || token.length > 12000) return null
  try {
    const value = unseal<any>(token, "movie-resource")
    return String(value.subjectId) === subjectId ? value : null
  } catch { return null }
}

function movieMetadata(subject: any): Metadata {
  const title = String(subject.title || "Movie")
  const description = String(subject.description || `${title} on TV Room GAGA.`).slice(0, 300)
  const image = subject.cover?.url || subject.cover
  return {
    title: `${title} | TV Room GAGA`,
    description,
    openGraph: { title, description, type: "video.movie", images: typeof image === "string" && image.startsWith("https://") ? [{ url: image }] : undefined },
    twitter: { card: "summary_large_image", title, description, images: typeof image === "string" && image.startsWith("https://") ? [image] : undefined },
  }
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { subjectId } = await params
  if (!/^\d{5,32}$/.test(subjectId)) return { title: "Movie | TV Room GAGA" }
  const query = await searchParams
  const resourceToken = Array.isArray(query?.resource) ? query.resource[0] : query?.resource
  const resource = resourceFromSearch(resourceToken, subjectId)
  if (resource) return movieMetadata(resource)
  const titleParam = Array.isArray(query?.title) ? query.title[0] : query?.title
  if (titleParam) return movieMetadata({ title: String(titleParam).slice(0, 180) })
  try {
    return movieMetadata(await movieDetail(subjectId))
  } catch { return { title: "Movie | TV Room GAGA", description: "Watch a movie on TV Room GAGA." } }
}

export default async function MoviePage({ params, searchParams }: Props) {
  const { subjectId } = await params
  if (!/^\d{5,32}$/.test(subjectId)) notFound()
  const query = await searchParams
  const resourceKey = Array.isArray(query?.resource) ? query.resource[0] : query?.resource
  const resource = resourceFromSearch(resourceKey, subjectId)
  const titleParam = Array.isArray(query?.title) ? query.title[0] : query?.title
  const detailPathParam = Array.isArray(query?.detailPath) ? query.detailPath[0] : query?.detailPath
  const validDetailPath = typeof detailPathParam === "string" && /^[A-Za-z0-9_-]{1,250}$/.test(detailPathParam)
  let initialMovie = {
    subjectId, title: String(titleParam || "Movie").slice(0, 180), cover: "", genre: "", description: "",
    releaseDate: "", imdbRatingValue: "", detailPath: validDetailPath ? detailPathParam : "",
  }
  if (resource) {
    initialMovie = {
      subjectId,
      title: String(resource.title || "Movie"),
      cover: String(resource.cover || ""),
      genre: String(resource.genre || ""),
      description: String(resource.description || ""),
      releaseDate: String(resource.releaseDate || ""),
      imdbRatingValue: String(resource.imdbRatingValue || ""),
      detailPath: String(resource.detailPath || ""),
    }
  } else if (!validDetailPath) try {
      const subject = await movieDetail(subjectId)
      initialMovie = {
        subjectId,
        title: String(subject.title || initialMovie.title),
        cover: String(subject.cover?.url || subject.cover || ""),
        genre: String(subject.genre || ""),
        description: String(subject.description || ""),
        releaseDate: String(subject.releaseDate || ""),
        imdbRatingValue: String(subject.imdbRatingValue || ""),
        detailPath: String(subject.detailPath || ""),
      }
    } catch {}
  return <MovieBoxTitle subjectId={subjectId} initialTitle={initialMovie.title} initialMovie={initialMovie} resourceKey={resource ? resourceKey : undefined} />
}

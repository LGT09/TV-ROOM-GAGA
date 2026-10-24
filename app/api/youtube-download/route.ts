import { NextResponse } from "next/server"
import { POST as download } from "../download/route"

export async function POST(request: Request) {
  const response = await download(request)
  const data = await response.json()
  if (!response.ok || !data.success) return NextResponse.json(data, { status: response.status })
  return NextResponse.json({ ...data, author: "YouTube", downloadServices: data.links.map((l: any) => ({ name: l.label, url: l.url, quality: l.quality })), thumbnail: data.thumbnail || "", title: data.title || "YouTube media" })
}

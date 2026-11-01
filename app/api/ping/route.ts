export const dynamic = "force-dynamic"
export function GET() {
  return Response.json({ ok: true, timestamp: Date.now() }, { headers: { "Cache-Control": "no-store" } })
}

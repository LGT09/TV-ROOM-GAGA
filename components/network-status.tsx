"use client"
import { useEffect, useRef, useState } from "react"
import { Activity, Gauge, Wifi, WifiOff } from "lucide-react"

type NetworkConnection = EventTarget & { downlink?: number; effectiveType?: string }
export function NetworkStatus() {
  const [online,setOnline]=useState(true)
  const [speed,setSpeed]=useState("")
  const [ping,setPing]=useState<number|null>(null)
  const pinging=useRef(false)
  useEffect(() => {
    const connection = (navigator as Navigator & { connection?: NetworkConnection }).connection
    const update = () => {
      setOnline(navigator.onLine)
      const downlink = connection?.downlink
      setSpeed(typeof downlink === "number" && downlink > 0 ? `${downlink} Mbps` : connection?.effectiveType || "")
    }
    update()
    window.addEventListener("online", update)
    window.addEventListener("offline", update)
    connection?.addEventListener("change", update)
    const measure = async () => {
      if (!navigator.onLine || pinging.current) return
      pinging.current=true
      const start = performance.now()
      try {
        const response = await fetch("/api/ping", { cache: "no-store", signal: AbortSignal.timeout(3000) })
        if (!response.ok) throw new Error()
        setPing(Math.round(performance.now() - start))
      } catch { setPing(null) }
      finally { pinging.current=false }
    }
    void measure()
    const timer = window.setInterval(measure, 30000)
    return () => {
      window.removeEventListener("online", update)
      window.removeEventListener("offline", update)
      connection?.removeEventListener("change", update)
      window.clearInterval(timer)
    }
  }, [])
  return <div role="status" aria-live="polite" className={`relative z-30 flex min-h-8 flex-wrap items-center justify-center gap-x-4 gap-y-1 border-b px-3 py-1.5 text-[11px] ${online ? "border-border/70 bg-background/80 text-muted-foreground" : "border-destructive/30 bg-destructive/10 text-destructive"}`}>
    <span className="inline-flex items-center gap-1.5">{online ? <Wifi className="h-3.5 w-3.5 text-emerald-600" /> : <WifiOff className="h-3.5 w-3.5" />}{online ? "Online" : "Offline"}</span>
    {online && speed && <span className="inline-flex items-center gap-1.5"><Gauge className="h-3.5 w-3.5" />{speed}</span>}
    {online && <span className="inline-flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" />{ping === null ? "Ping checking" : `${ping} ms ping`}</span>}
    {!online && <span>Reconnect to play or download media.</span>}
  </div>
}

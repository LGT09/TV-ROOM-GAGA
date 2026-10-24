"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, Film, Music, Radio } from "lucide-react"

export default function SplashPage() {
  const router = useRouter()
  const [seconds, setSeconds] = useState(4)
  const [motionReduced, setMotionReduced] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const navigatedRef = useRef(false)

  useEffect(() => {
    setMotionReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    router.prefetch("/home")
    const startedAt = Date.now()
    const navigate = () => {
      if (navigatedRef.current) return
      navigatedRef.current = true
      router.replace("/home")
    }
    countdownRef.current = setInterval(() => {
      setSeconds(Math.max(0, 4 - Math.ceil((Date.now() - startedAt) / 1000)))
    }, 150)
    timerRef.current = setTimeout(navigate, 4000)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [router])
  const enter = () => {
    if (navigatedRef.current) return
    navigatedRef.current = true
    if (timerRef.current) clearTimeout(timerRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)
    router.push("/home")
  }

  return <main className="relative grid min-h-[100dvh] overflow-hidden px-4 py-8">
    <div className="ambient-orb ambient-orb-1" /><div className="ambient-orb ambient-orb-2" />
    <div className="relative z-10 m-auto w-full max-w-4xl">
    <div className={`glass-card splash-card overflow-hidden rounded-[2rem] p-5 sm:p-10 ${motionReduced ? "" : "splash-enter"}`}>
        <div className="grid items-center gap-7 sm:grid-cols-[1.05fr_.95fr] sm:gap-10">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.2em] text-primary"><span className="h-1.5 w-1.5 rounded-full bg-accent" /> TV Room GAGA</div>
            <h1 className="font-display text-4xl leading-[1.04] sm:text-6xl">A room for <span className="text-gradient">good stories.</span></h1>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">Movies, series, music, and live television—ready when you are. No account to create.</p>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {[{ icon: Film, label: "Movies & series" }, { icon: Music, label: "Music" }, { icon: Radio, label: "Live TV" }].map(({ icon: Icon, label }) => <span key={label} className="inline-flex items-center gap-1.5 rounded-full bg-muted/70 px-3 py-2"><Icon className="h-3.5 w-3.5 text-primary" />{label}</span>)}
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button onClick={enter} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-md transition-transform hover:-translate-y-0.5">Enter the room <ArrowRight className="h-4 w-4" /></button>
              <span className="text-xs text-muted-foreground" aria-live="polite">Opening in {seconds}s</span>
            </div>
            <Link href="/docs" className="inline-flex text-xs text-muted-foreground underline decoration-border underline-offset-4 hover:text-primary">Read the quick guide</Link>
          </div>
          <div className="relative mx-auto flex aspect-square w-full max-w-[330px] items-center justify-center">
            <div className="absolute inset-[8%] rotate-6 rounded-[2rem] border border-primary/15 bg-secondary/25" />
            <div className="absolute inset-[15%] -rotate-3 rounded-[2rem] border border-accent/20 bg-card/65 shadow-xl" />
            <div className="relative grid h-[68%] w-[68%] place-items-center overflow-hidden rounded-[2rem] bg-card shadow-2xl ring-1 ring-border/70">
              <img src="/tvroom-logo.png" alt="TV Room GAGA" className="h-full w-full object-cover" />
            </div>
            <span className="absolute right-[6%] top-[15%] h-3 w-3 rounded-full bg-accent" /><span className="absolute bottom-[15%] left-[8%] h-2 w-2 rounded-full bg-primary/50" />
          </div>
        </div>
      </div>
      <p className="mt-4 text-center text-[10px] tracking-wide text-muted-foreground">A small welcome, then straight to the good part.</p>
    </div>
  </main>
}

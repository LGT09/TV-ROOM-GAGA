"use client"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

type Phase = "video" | "logo"

export function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [isVisible, setIsVisible] = useState(true)
  const [phase, setPhase] = useState<Phase>("video")
  const videoRef = useRef<HTMLVideoElement>(null)

  const finish = () => {
    setIsVisible(false)
    setTimeout(onComplete, 500)
  }

  // Move from video phase to logo reveal
  const revealLogo = () => {
    setPhase("logo")
    // Hold the logo for a moment, then complete
    setTimeout(finish, 2600)
  }

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    // Safety timeout in case the video never fires 'ended' (autoplay blocked, etc.)
    const fallback = setTimeout(() => {
      if (phase === "video") revealLogo()
    }, 9000)

    const handleEnded = () => revealLogo()
    video.addEventListener("ended", handleEnded)

    // Attempt autoplay (muted so browsers allow it)
    video.play().catch(() => {
      // If autoplay is blocked, skip straight to the logo reveal
      clearTimeout(fallback)
      revealLogo()
    })

    return () => {
      clearTimeout(fallback)
      video.removeEventListener("ended", handleEnded)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-black"
        >
          {/* Skip button */}
          <button
            onClick={finish}
            className="absolute top-4 right-4 z-20 rounded-full border border-white/20 bg-black/40 px-4 py-2 text-xs font-medium tracking-wide text-white/80 backdrop-blur transition-colors hover:bg-white/10 hover:text-white sm:top-6 sm:right-6 sm:text-sm"
          >
            Skip intro
          </button>

          {/* Video phase */}
          <AnimatePresence>
            {phase === "video" && (
              <motion.div
                key="video"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <video
                  ref={videoRef}
                  className="h-full w-full object-cover"
                  muted
                  playsInline
                  autoPlay
                  preload="auto"
                >
                  <source src="/intro-splash.mp4" type="video/mp4" />
                </video>
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/40" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Logo reveal phase */}
          <AnimatePresence>
            {phase === "logo" && (
              <motion.div
                key="logo"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6 }}
                className="relative flex flex-col items-center justify-center px-6 text-center"
                style={{ perspective: "1000px" }}
              >
                <motion.div
                  initial={{ scale: 0.4, rotateY: -120, opacity: 0 }}
                  animate={{ scale: 1, rotateY: 0, opacity: 1 }}
                  transition={{ duration: 1, type: "spring", bounce: 0.35 }}
                  className="relative"
                  style={{ transformStyle: "preserve-3d" }}
                >
                  <div className="absolute inset-0 scale-110 bg-gradient-to-r from-red-500/40 via-yellow-500/30 to-red-500/40 blur-3xl" />
                  <img
                    src="/images/logo.png"
                    alt="TV Room GAGA"
                    className="relative h-40 w-40 object-contain drop-shadow-[0_0_50px_rgba(239,68,68,0.5)] sm:h-56 sm:w-56 md:h-64 md:w-64"
                  />
                </motion.div>

                <motion.h1
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.5, duration: 0.6 }}
                  className="mt-6 text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl"
                >
                  TV Room <span className="text-red-500">GAGA</span>
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.9, duration: 0.6 }}
                  className="mt-2 text-xs tracking-widest text-white/50 sm:text-sm"
                >
                  STREAMING WORLDWIDE
                </motion.p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

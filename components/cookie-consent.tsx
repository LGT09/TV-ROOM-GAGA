"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Cookie, AlertTriangle } from "lucide-react"

export function CookieConsent() {
  const [showConsent, setShowConsent] = useState(false)
  const [isBlocked, setIsBlocked] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
    const consent = localStorage.getItem("tv-room-cookie-consent")
    if (!consent) {
      setShowConsent(true)
    } else if (consent === "declined") {
      setIsBlocked(true)
    }
  }, [])

  const acceptCookies = () => {
    localStorage.setItem("tv-room-cookie-consent", "accepted")
    setShowConsent(false)
    setIsBlocked(false)
  }

  const declineCookies = () => {
    localStorage.setItem("tv-room-cookie-consent", "declined")
    setShowConsent(false)
    setIsBlocked(true)
  }

  if (!isMounted) return null

  if (isBlocked) {
    return (
      <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
        <Card className="max-w-md border-destructive/50 shadow-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-2xl">Access Denied</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <CardDescription className="text-base">
              TV Room requires cookies to function properly. Cookies are essential for storing your preferences,
              managing downloads, and providing a personalized experience.
            </CardDescription>
            <CardDescription className="text-base font-semibold">
              You must accept cookies to continue using TV Room.
            </CardDescription>
            <Button onClick={acceptCookies} className="w-full" size="lg">
              Accept Cookies & Continue
            </Button>
            <p className="text-xs text-muted-foreground">
              By accepting, you agree to our use of cookies for essential functionality, preferences, and download
              management.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!showConsent) return null

  return (
    <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="max-w-md border-primary/50 shadow-2xl">
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <Cookie className="h-6 w-6 text-primary" />
            <CardTitle className="text-xl">Cookie Consent Required</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <CardDescription className="text-base">
            TV Room uses cookies to enhance your experience, store your preferences, manage downloads, and track your
            media library. Cookies are essential for the website to function properly.
          </CardDescription>
          <div className="bg-muted p-3 rounded-lg">
            <p className="text-sm font-semibold mb-2">What we use cookies for:</p>
            <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
              <li>Storing your theme preferences</li>
              <li>Managing your downloads and media library</li>
              <li>Saving your playlists</li>
              <li>Remembering your settings</li>
            </ul>
          </div>
          <div className="flex flex-col gap-2">
            <Button onClick={acceptCookies} size="lg" className="w-full">
              Accept All Cookies
            </Button>
            <Button onClick={declineCookies} variant="outline" size="lg" className="w-full bg-transparent">
              Decline & Exit
            </Button>
          </div>
          <p className="text-xs text-center text-muted-foreground">
            Note: Declining cookies will prevent you from accessing TV Room.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

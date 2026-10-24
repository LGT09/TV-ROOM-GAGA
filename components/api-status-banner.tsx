"use client"

import { useEffect, useState } from "react"
import { AlertCircle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function ApiStatusBanner() {
  const [missingKeys, setMissingKeys] = useState<string[]>([])

  useEffect(() => {
    const checkApiStatus = async () => {
      try {
        const response = await fetch("/api/tmdb?action=movie-genres")
        if (!response.ok) {
          setMissingKeys(["TMDb API Key"])
        }
      } catch (error) {
        setMissingKeys(["TMDb API Key"])
      }
    }

    checkApiStatus()
  }, [])

  if (missingKeys.length === 0) {
    return null
  }

  return (
    <Alert variant="destructive" className="mb-6">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>API Configuration Required</AlertTitle>
      <AlertDescription>
        Please configure the following API keys in your environment variables: {missingKeys.join(", ")}.
        <br />
        Check the README.md file for setup instructions.
      </AlertDescription>
    </Alert>
  )
}

"use client"
import { useEffect,useState } from "react"
export function NetworkStatus() {
  const [offline,setOffline]=useState(false)
  useEffect(()=>{
    const update=()=>setOffline(!navigator.onLine)
    update()
    window.addEventListener("online",update)
    window.addEventListener("offline",update)
    return()=>{window.removeEventListener("online",update);window.removeEventListener("offline",update)}
  },[])
  return offline?<div role="status" className="relative z-20 border-b border-primary/20 bg-card px-4 py-3 text-center text-sm">You’re offline. Recent catalogue results may still be available. Reconnect to stream or download media.</div>:null
}

"use client"

import { Compass, Film, Home, Info, Menu, Music, Radio, Search, Wrench, FileText } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "./theme-toggle"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

const navigation = [
  { name: "Home", href: "/home", icon: Home }, { name: "Movies & series", href: "/movies", icon: Film },
  { name: "Discover", href: "/discover", icon: Compass }, { name: "Search", href: "/search", icon: Search },
  { name: "Music", href: "/music", icon: Music }, { name: "Live TV", href: "/live-tv", icon: Radio },
  { name: "Media tools", href: "/downloader", icon: Wrench }, { name: "About", href: "/about", icon: Info },
  { name: "Help & guide", href: "/docs", icon: FileText },
]

function Navigation({ close }: { close?: () => void }) {
  const pathname = usePathname()
  return <nav aria-label="Main navigation" className="space-y-1">
    {navigation.map(item => {
      const active = pathname === item.href
      return <Link key={item.href} href={item.href} onClick={close} className={cn("flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-medium transition-colors", active ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm" : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground")}>
        <item.icon className="h-4 w-4 shrink-0" /><span>{item.name}</span>
      </Link>
    })}
  </nav>
}

function Brand({ mobile = false }: { mobile?: boolean }) {
  return <Link href="/home" className="flex min-w-0 items-center gap-2.5">
    <span className={cn("block shrink-0 overflow-hidden rounded-xl bg-sidebar-accent ring-1 ring-sidebar-border", mobile ? "h-9 w-9" : "h-10 w-10")}>
      <img src="/tvroom-logo.png" alt="" className="h-full w-full object-cover" />
    </span>
    <span className="min-w-0"><span className="block truncate text-sm font-bold leading-tight text-sidebar-foreground">TV Room</span><span className="block truncate text-[9px] font-bold tracking-[.19em] text-sidebar-foreground/55">GAGA · PICTURE HOUSE</span></span>
  </Link>
}

export function AppSidebar() {
  return <>
    <aside className="app-sidebar sticky top-0 hidden h-[100dvh] w-[220px] shrink-0 flex-col border-r border-sidebar-border md:flex">
      <div className="flex h-full flex-col">
        <div className="border-b border-sidebar-border px-4 py-4"><Brand /></div>
        <div className="flex-1 overflow-y-auto p-3"><Navigation /></div>
        <div className="flex items-center justify-between border-t border-sidebar-border px-4 py-3"><span className="text-xs text-sidebar-foreground/65">Appearance</span><ThemeToggle /></div>
      </div>
    </aside>
    <div className="glass fixed inset-x-0 top-0 z-40 border-b border-border/70 md:hidden">
      <div className="flex h-14 items-center justify-between px-3">
        <Brand mobile />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Sheet>
            <SheetTrigger asChild><Button variant="ghost" size="icon" aria-label="Open navigation"><Menu className="h-5 w-5" /></Button></SheetTrigger>
            <SheetContent side="left" className="w-[min(84vw,300px)] border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
              <div className="border-b border-sidebar-border p-4"><Brand /></div>
              <div className="p-3"><Navigation /></div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </div>
  </>
}

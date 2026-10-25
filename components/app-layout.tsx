"use client"

import type React from "react"
import { AppSidebar } from "./app-sidebar"
import { AppFooter } from "./app-footer"
import { NetworkStatus } from "./network-status"

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh]">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="app-content relative min-h-[70dvh] flex-1 pt-14 md:pt-0">
          <NetworkStatus/>
          <div className="ambient-orb ambient-orb-1" />
          <div className="ambient-orb ambient-orb-2" />
          <div className="relative z-10 min-w-0">{children}</div>
        </main>
        <AppFooter />
      </div>
    </div>
  )
}

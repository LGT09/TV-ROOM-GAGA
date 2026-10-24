import Link from "next/link"
import { ExternalLink, Mail } from "lucide-react"

export function AppFooter() {
  return <footer className="mt-auto border-t border-border/70 bg-card/55">
    <div className="page-shell flex flex-col gap-4 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <p>TV Room GAGA · An entertainment room by Vincent Ganiza</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link href="/docs" className="hover:text-primary">Help &amp; guide</Link>
        <a href="https://traxxiontech.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-primary">Traxxion Tech <ExternalLink className="h-3 w-3" /></a>
        <a href="mailto:traxxiontech@gmail.com" className="inline-flex items-center gap-1 hover:text-primary"><Mail className="h-3 w-3" /> Contact</a>
      </div>
    </div>
  </footer>
}

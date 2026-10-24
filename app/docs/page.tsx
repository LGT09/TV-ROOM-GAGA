import Link from "next/link"
import { ArrowLeft, ArrowUpRight, Download, Film, Globe2, HardDrive, Search, TimerReset } from "lucide-react"
import { AppLayout } from "@/components/app-layout"

const guides = [
  { icon: Search, title: "Browse and filter", text: "Use the search box to find a title. Category and format filters narrow the current list. Choose 12, 24, or 36 items per page; Previous and Next move through results." },
  { icon: Film, title: "Series and episodes", text: "Open a title to load its available seasons and episode list. Season episode counts reflect returned metadata. If details are unavailable, the title view will say so rather than guessing." },
  { icon: Download, title: "Downloads and playback", text: "Playback uses sources available for the selected title. If a source fails, try another source or retry. A download appears only when a file link is available; a streaming playlist is not presented as a full movie download. Your browser and device decide where downloaded files are saved." },
  { icon: Globe2, title: "Country selection", text: "Open Live TV to choose a country from the channel directory. Channel availability and playback can differ by location and device." },
  { icon: HardDrive, title: "No account, browser storage", text: "TV Room GAGA does not require an account. Preferences and saved choices stay in browser storage on this device. Clearing site data or using another browser may remove or reset them." },
  { icon: TimerReset, title: "Slow or unavailable results", text: "A request can take longer when a source is busy. If the page shows a timeout, retry the request. A title, episode, or playback source may be unavailable; the interface reports what the service actually returns." },
]

export default function DocsPage() {
  return <AppLayout><article className="page-shell max-w-4xl space-y-7 py-5 pb-12 sm:py-9">
    <Link href="/home" className="inline-flex items-center gap-2 text-sm font-semibold text-primary"><ArrowLeft className="h-4 w-4" />Back to room</Link>
    <header className="border-b border-border/70 pb-5">
      <p className="text-xs font-bold uppercase tracking-[.2em] text-primary">A short field guide</p>
      <h1 className="mt-2 font-display text-3xl sm:text-5xl">How the room works</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">Simple controls for browsing, watching, listening, and using the tools on the device you already have.</p>
    </header>
    <div className="space-y-3">
      {guides.map(({ icon: Icon, title, text }, index) => <section key={title} className="glass-card flex gap-3 rounded-xl p-4 sm:gap-4 sm:p-5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span>
        <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">0{index + 1}</p><h2 className="mt-1 font-display text-xl">{title}</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{text}</p></div>
      </section>)}
    </div>
    <footer className="flex flex-col gap-3 rounded-xl bg-muted/60 p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">Built by Vincent Ganiza with Traxxion Tech.</p>
      <a href="https://traxxiontech.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-primary">Visit Traxxion Tech <ArrowUpRight className="h-4 w-4" /></a>
    </footer>
  </article></AppLayout>
}

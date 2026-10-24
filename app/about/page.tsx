import Link from "next/link"
import { AppLayout } from "@/components/app-layout"
import { Compass, Headphones, Radio, Film } from "lucide-react"

const offerings=[
  {icon:Film,title:"Film & series",copy:"Browse a compact movie library, choose a season and episode, and select an available quality."},
  {icon:Radio,title:"Public television",copy:"Browse publicly listed channels. Each station’s availability depends on its own stream."},
  {icon:Headphones,title:"Music & playlists",copy:"Search and play music, keep playlists, and use the existing download tools."},
]
export default function AboutPage(){
  return <AppLayout><main className="container mx-auto max-w-5xl px-4 py-10 md:py-16 pb-24 space-y-10">
    <header className="glass-card rounded-[2rem] p-7 md:p-12"><p className="text-xs uppercase tracking-[.25em] text-primary font-bold">About the picture house</p><h1 className="font-display text-4xl md:text-6xl mt-4">Good stories, one room.</h1><p className="text-lg text-muted-foreground leading-relaxed max-w-3xl mt-5">TV Room GAGA is a sign-in-free entertainment hub for discovering films, series, short dramas, music, and public live television. Browse without creating an account; playback and availability are determined by the services that supply each source.</p><Link href="/discover" className="inline-flex items-center gap-2 mt-7 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"><Compass className="h-4 w-4"/>Start discovering</Link></header>
    <section className="grid md:grid-cols-3 gap-4">{offerings.map(({icon:Icon,title,copy})=><article key={title} className="glass-card rounded-2xl p-6"><Icon className="h-6 w-6 text-primary"/><h2 className="font-display text-2xl mt-4">{title}</h2><p className="text-sm text-muted-foreground mt-2 leading-relaxed">{copy}</p></article>)}</section>
    <section className="glass rounded-2xl p-6 md:p-8"><h2 className="font-display text-2xl">A note on availability</h2><p className="mt-3 text-muted-foreground leading-relaxed">A catalogue entry does not guarantee that a playable or downloadable file is available. Please respect copyright, service terms, and local law when accessing or saving content. Visit the <a href="https://traxxiontech.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">creator’s website</a> to learn more about Traxxion Tech.</p></section>
  </main></AppLayout>
}

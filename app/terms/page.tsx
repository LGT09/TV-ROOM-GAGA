import { AppLayout } from "@/components/app-layout"
import { AlertTriangle, Copyright, Scale, Radio, Download } from "lucide-react"

const rules=[
  {icon:Scale,title:"Use the service lawfully",copy:"Use TV Room GAGA for lawful discovery and playback. You are responsible for following local law and any terms that apply to third-party content or services."},
  {icon:Copyright,title:"Respect ownership",copy:"Media, artwork, and broadcast streams remain the property of their respective owners. Do not copy, redistribute, or use material unless you have the rights or permission to do so."},
  {icon:Radio,title:"Third-party availability",copy:"Catalogues and public channel streams are supplied externally. Entries may be unavailable, region-limited, removed, or incompatible with your browser. No uptime or playback quality is promised."},
  {icon:Download,title:"Saving media",copy:"Download tools expose links supplied by external services. Only save material that you are authorized to download, and follow the source platform's rules."},
  {icon:AlertTriangle,title:"As available",copy:"The interface is provided as available, without a guarantee that any specific title, stream, or feature will remain accessible. Use at your own discretion."},
]
export default function TermsPage(){
 return <AppLayout><main className="container mx-auto max-w-4xl px-4 py-10 md:py-14 pb-24">
  <header className="mb-8"><p className="text-xs uppercase tracking-[.25em] text-primary font-bold">Before the show</p><h1 className="font-display text-4xl md:text-5xl mt-2">Terms of use</h1><p className="text-muted-foreground mt-3">A sign-in-free service for entertainment discovery.</p></header>
  <div className="space-y-4">{rules.map(({icon:Icon,title,copy})=><section key={title} className="glass-card rounded-2xl p-5 md:p-6 flex gap-4"><span className="shrink-0 w-10 h-10 rounded-xl bg-primary/10 text-primary grid place-items-center"><Icon className="h-5 w-5"/></span><div><h2 className="font-display text-xl">{title}</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{copy}</p></div></section>)}</div>
  <p className="text-xs text-muted-foreground mt-8">By using the app, you agree to use it responsibly and to respect third-party rights and terms.</p>
 </main></AppLayout>
}

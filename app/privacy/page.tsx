import { AppLayout } from "@/components/app-layout"
import { Eye, Database, Cookie, ShieldCheck } from "lucide-react"

const sections=[
  {icon:Eye,title:"No account required",copy:"TV Room GAGA does not ask you to register, sign in, or provide a profile. Avoid entering sensitive information into searches."},
  {icon:Database,title:"Local app data",copy:"Music playback, playlists, and download-manager state may be stored by the browser to support those features. Clearing site storage removes locally saved data."},
  {icon:Cookie,title:"Cookies and analytics",copy:"The app does not place a consent wall in front of its features. Hosting analytics may receive standard technical request information; browser settings can limit cookies and tracking."},
  {icon:Eye,title:"Advertising",copy:"This site uses Adcash to display advertising and help fund the service. Its advertising script may receive your IP address, browser/device information and page activity, and may use cookies or similar technologies. Ad formats, availability and tracking are controlled by the advertising service. Review Adcash’s privacy policy and your browser’s cookie and tracking settings."},
  {icon:ShieldCheck,title:"Third-party services",copy:"Search, playback, and download requests may be processed by external services. Their privacy policies and availability rules apply."},
]
export default function PrivacyPage(){
 return <AppLayout><main className="container mx-auto max-w-4xl px-4 py-10 md:py-14 pb-24">
  <header className="mb-8"><p className="text-xs uppercase tracking-[.25em] text-primary font-bold">The fine print</p><h1 className="font-display text-4xl md:text-5xl mt-2">Privacy, plainly.</h1><p className="text-muted-foreground mt-3">A short guide to how this sign-in-free entertainment interface works.</p></header>
  <div className="space-y-4">{sections.map(({icon:Icon,title,copy})=><section key={title} className="glass-card rounded-2xl p-5 md:p-6 flex gap-4"><span className="shrink-0 w-10 h-10 rounded-xl bg-primary/10 text-primary grid place-items-center"><Icon className="h-5 w-5"/></span><div><h2 className="font-display text-xl">{title}</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{copy}</p></div></section>)}</div>
  <p className="text-xs text-muted-foreground mt-8">This summary is informational and does not replace legal advice. Review the privacy policies of any external service you use, including <a href="https://adcash.com/privacy-policy/" target="_blank" rel="noopener noreferrer" className="underline">Adcash’s privacy policy</a>.</p>
 </main></AppLayout>
}

export function MediaWatermark({audio=false}:{audio?:boolean}) {
  return <span data-media-watermark className={audio ? "pointer-events-none select-none text-[10px] font-bold tracking-[.18em] text-muted-foreground" : "pointer-events-none select-none absolute right-3 top-3 z-20 rounded-md bg-black/25 px-2 py-1 text-[10px] sm:text-xs font-extrabold tracking-[.16em] text-white/75 drop-shadow-md"}>TV ROOM GAGA</span>
}

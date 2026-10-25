export function MediaWatermark({audio=false,inset}:{audio?:boolean;inset?:{top:number;right:number}}) {
  return <span data-media-watermark aria-hidden="true" style={audio?undefined:{textShadow:"0 1px 4px #000, 0 0 2px #000",...inset}} className={audio ? "pointer-events-none select-none text-[10px] font-bold tracking-[.18em] text-muted-foreground" : "pointer-events-none select-none absolute right-[4%] top-[5%] z-20 text-[10px] sm:text-sm font-extrabold tracking-[.12em] text-white/90"}>TV ROOM GAGA</span>
}

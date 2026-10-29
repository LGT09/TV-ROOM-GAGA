export function fileSize(headers:Headers):number|undefined {
  const range=headers.get("content-range")
  const raw=range?range.match(/\/(\d+)$/)?.[1]:headers.get("content-encoding")?undefined:headers.get("content-length")
  const value=Number(raw)
  return Number.isSafeInteger(value)&&value>0?value:undefined
}
export function formatFileSize(bytes?:number) {
  if(!bytes||!Number.isFinite(bytes)||bytes<=0)return "Size unavailable"
  if(bytes<1024)return `${bytes} B`
  const unit=Math.min(3,Math.floor(Math.log(bytes)/Math.log(1024)))
  return `${(bytes/1024**unit).toFixed(1)} ${["B","KB","MB","GB"][unit]}`
}

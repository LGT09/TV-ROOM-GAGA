const prefix="tvroom.catalogue.v1:"
const maxAge=30*60*1000
export function cachedCatalogue<T>(key:string):T|null {
  try {
    const saved=JSON.parse(localStorage.getItem(prefix+key)||"null")
    if(saved&&Date.now()-saved.at<maxAge)return saved.value
    localStorage.removeItem(prefix+key)
  }catch{/* Storage can be disabled or full. */}
  return null
}
export function rememberCatalogue(key:string,value:unknown) {
  try {
    const keys=Object.keys(localStorage).filter(key=>key.startsWith(prefix))
    if(keys.length>=8&&!keys.includes(prefix+key)){
      const oldest=keys.sort((a,b)=>JSON.parse(localStorage.getItem(a)||"{}").at-JSON.parse(localStorage.getItem(b)||"{}").at)[0]
      localStorage.removeItem(oldest)
    }
    localStorage.setItem(prefix+key,JSON.stringify({at:Date.now(),value}))
  }catch{/* Metadata caching is optional; never prevent normal browsing. */}
}

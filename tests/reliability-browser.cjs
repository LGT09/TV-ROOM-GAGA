// Deterministic UI checks: catalogue persistence, offline recovery, failed file checks,
// and a real browser download hand-off. This fixture is not a real playable movie.
const {chromium}=require("@playwright/test")
const assert=require("node:assert/strict")
;(async()=>{
 const browser=await chromium.launch({executablePath:"/repl/tools/bin/chromium",args:["--no-sandbox"]})
 try{
  const context=await browser.newContext({viewport:{width:390,height:844}})
  const page=await context.newPage()
  const errors=[]
  page.on("pageerror",e=>errors.push(e.message))
  const item={key:"fixture-title",title:"Reliability test film",year:"2026",type:"movie",poster:"",description:"Test fixture"}
  let lists=0,failFile=true
  await context.route("**/api/library?**",async route=>{
   const action=new URL(route.request().url()).searchParams.get("action")
   if(action==="list"){lists++;return route.fulfill({json:{success:true,items:[item],page:1,limit:12,hasNext:false}})}
   if(action==="detail")return route.fulfill({json:{success:true,item,seasons:[],episodes:[],audioTracks:[]}})
   return route.fulfill({json:{success:true,sources:[{url:"/api/media?key=fixture",downloadUrl:"/api/media?key=fixture&download=1",quality:"720p",label:"720p",format:"MP4"}],subtitles:[]}})
  })
  await context.route("**/api/media?**",route=>{
   if(failFile&&route.request().method()==="HEAD")return route.fulfill({status:502,contentType:"application/json",body:'{"error":"unavailable"}'})
   return route.fulfill({status:200,headers:{"Content-Type":"video/mp4","Content-Disposition":'attachment; filename="test.mp4"'},body:route.request().method()==="HEAD"?"":"fixture media"})
  })
  await page.goto(`https://${process.env.REPLIT_DEV_DOMAIN}/movies`,{waitUntil:"domcontentloaded"})
  const card=page.getByRole("button",{name:"Open Reliability test film",exact:true})
  await card.waitFor()
  assert.ok(await page.evaluate(()=>Object.keys(localStorage).some(key=>key.startsWith("tvroom.catalogue.v1:"))))
  const before=lists
  await context.setOffline(true)
  await page.getByRole("button",{name:"Search",exact:true}).click()
  await page.getByRole("alert").filter({hasText:"Showing recent catalogue results"}).waitFor()
  assert.equal(lists,before)
  assert.equal(await card.count(),1)
  await context.setOffline(false)
  await page.waitForFunction(()=>!document.querySelector('[role="alert"]'))
  assert.ok(lists>before)
  await card.click()
  const downloadButton=page.getByRole("button",{name:"Download 720p · MP4",exact:true})
  await downloadButton.waitFor()
  await downloadButton.click()
  await page.getByRole("alert").filter({hasText:"The file could not be reached"}).waitFor()
  failFile=false
  const transfer=page.waitForEvent("download")
  await downloadButton.click()
  const download=await transfer
  // Chromium's download navigation bypasses route fixtures on some versions.
  // The live-media test validates actual file headers/bytes; here verify the hand-off.
  assert.match(download.url(),/\/api\/media\?key=fixture/)
  await download.cancel()
  await page.getByRole("status").filter({hasText:"Sent to your browser"}).waitFor()
  assert.deepEqual(errors,[])
  console.log(JSON.stringify({offlineCachedCatalogue:true,onlineRecovery:true,failedFileVisible:true,browserDownload:true,pageErrors:errors}))
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1})

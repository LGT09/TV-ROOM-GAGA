const {chromium}=require("@playwright/test")
const assert=require("node:assert/strict")
const fs=require("node:fs")
const base=`https://${process.env.REPLIT_DEV_DOMAIN}`
;(async()=>{
 fs.mkdirSync("generated-artifacts",{recursive:true})
 const browser=await chromium.launch({executablePath:"/repl/tools/bin/chromium",args:["--no-sandbox"]})
 const context=await browser.newContext({viewport:{width:390,height:844}})
 const errors=[],flows=[]
 try{
  for(const reducedMotion of ["reduce","no-preference"]){
   const p=await context.newPage();p.on("pageerror",e=>errors.push(e.message));await p.emulateMedia({reducedMotion})
   await p.goto(base+"/",{waitUntil:"domcontentloaded"})
   await p.locator('img[src="/tvroom-logo.png"]').waitFor()
   await p.getByText(/Opening in/).waitFor()
   await p.waitForURL("**/home",{timeout:10000})
   flows.push({flow:`automatic splash (${reducedMotion})`,result:"passed"});await p.close()
  }
  const music=await context.newPage();music.on("pageerror",e=>errors.push(e.message))
  await music.goto(base+"/music")
  const play=music.getByRole("button",{name:/^Play /}).first()
  await play.waitFor({timeout:20000})
  assert.ok(await music.getByRole("button",{name:/Download full song/}).count()>0)
  assert.equal(await music.getByRole("button",{name:/Download full song/}).first().isEnabled(),true)
  await play.click()
  const audio=music.locator("audio")
  await audio.waitFor()
  await music.waitForTimeout(2500)
  const state=await audio.evaluate(v=>({time:v.currentTime,ready:v.readyState,error:v.error?.message||null,src:Boolean(v.currentSrc)}))
  assert.ok(state.time>0&&state.ready>=2,`Audio preview failed ${JSON.stringify(state)}`)
  await music.getByText(/^TV ROOM GAGA · Now/).waitFor()
  const downloadRequest=music.waitForRequest(r=>r.url().includes("/api/music?")&&r.url().includes("action=download-mp3"))
  await music.route("**/api/music?**",route=>{
   if(new URL(route.request().url()).searchParams.get("action")==="download-mp3")return route.fulfill({status:502,json:{error:"Full-song file is unavailable in this test."}})
   if(new URL(route.request().url()).searchParams.get("full")==="1")return route.fulfill({status:502,json:{error:"Full-song playback is unavailable in this test."}})
   return route.continue()
  })
  await music.getByRole("button",{name:/Download full song/}).first().click()
  const request=await downloadRequest
  assert.ok(new URL(request.url()).searchParams.get("title"))
  await music.getByRole("alert").filter({hasText:"Full-song file is unavailable in this test."}).waitFor()
  await music.getByRole("button",{name:"Play full song",exact:true}).first().click()
  await music.getByRole("alert").filter({hasText:"Full-song playback is unavailable in this test."}).waitFor()
  await music.screenshot({path:"generated-artifacts/music-mobile.png"})
  flows.push({flow:"real latest music, preview playback, download lookup and honest error",result:"passed",playback:state})
  const movie=await context.newPage();movie.on("pageerror",e=>errors.push(e.message))
  const item={key:"opaque-title",title:"Task playback check",poster:"",description:"Controlled integration fixture",type:"movie",year:"2026"}
  const streamQueries=[]
  await movie.route("**/api/library?**",route=>{
   const url=new URL(route.request().url()),action=url.searchParams.get("action")
   let data=action==="detail"?{item,seasons:[],episodes:[],audioTracks:[]}:{items:[item],page:1,limit:12,hasNext:false}
   if(action==="stream"){
    streamQueries.push(url.searchParams.get("retry"))
    if(streamQueries.length===1)return route.fulfill({status:425,json:{success:false,error:"The movie is still being prepared. Check progress in a moment."}})
    data={sources:[{url:"/api/media?key=opaque-file",downloadUrl:"/api/media?key=opaque-file&download=1",quality:"720p",label:"720p",format:"MP4"}],subtitles:[]}
   }
   return route.fulfill({json:{success:true,...data}})
  })
  await movie.goto(base+"/movies")
  await movie.getByRole("button",{name:"Open Task playback check"}).click()
  await movie.getByRole("button",{name:"Check progress"}).click()
  await movie.locator("video").waitFor()
  assert.deepEqual(streamQueries,["0","0"])
  await movie.locator("[data-media-watermark]").waitFor()
  assert.equal(await movie.getByRole("link",{name:"Open stream"}).count(),0)
  const text=await movie.locator("body").innerText()
  assert.ok(!text.includes("opaque-file")&&!/omegatech|MovieBox|https?:\/\//i.test(text))
  flows.push({flow:"task preparation/retry, private inline playback and watermark",result:"passed"})
  const tv=await context.newPage();await tv.goto(base+"/live-tv")
  await tv.getByRole("textbox",{name:"Search public channels"}).fill("Jazeera")
  await tv.getByRole("button",{name:"Search",exact:true}).click()
  const channel=tv.getByRole("button").filter({hasText:"Al Jazeera"}).first()
  await channel.waitFor({timeout:45000});await channel.click()
  await tv.locator("video").waitFor({timeout:20000})
  await tv.locator("[data-media-watermark]").waitFor()
  assert.equal(await tv.getByRole("link",{name:"Open stream"}).count(),0)
  await tv.screenshot({path:"generated-artifacts/tv-watermark-mobile.png"})
  flows.push({flow:"live TV shared watermark and no exposed stream link",result:"passed"})
  assert.deepEqual(errors,[])
  fs.writeFileSync("generated-artifacts/enhancement-results.json",JSON.stringify({flows,errors},null,2))
  console.log(JSON.stringify({flows,errors},null,2))
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1})

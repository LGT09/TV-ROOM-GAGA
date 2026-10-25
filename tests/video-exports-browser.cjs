// Uses one already-completed two-second verification render. Submission is
// mocked to avoid charging a new render on every UI regression test.
const {chromium}=require("@playwright/test")
const assert=require("node:assert/strict")
const fs=require("node:fs")
const ts=require("typescript")
const path=require("node:path")
function tokens(){
  const file=path.resolve("lib/library/tokens.ts"),module={exports:{}}
  const code=ts.transpileModule(fs.readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText
  new Function("require","module","exports",code)(id=>id==="server-only"?{}:id==="../providers/http"?{ProviderError:Error}:id.endsWith(".json")?require(path.resolve(path.dirname(file),id)):require(id),module,module.exports)
  return module.exports
}
;(async()=>{
 const {seal}=tokens()
 const id=process.env.VERIFY_RENDER_ID
 assert.ok(id,"Set VERIFY_RENDER_ID to a completed two-second test render; this test never submits paid work.")
 const jobKey=seal("video-export",{id,title:"Watermark verification"})
 const original=seal("media",{kind:"video",format:"MP4",title:"Watermark verification",url:`https://shotstack-api-v1-output.s3-ap-southeast-2.amazonaws.com/qa57qpwtb3/${id}.mp4`})
 const source=`/api/media?key=${original}&download=1`
 const browser=await chromium.launch({executablePath:"/repl/tools/bin/chromium",args:["--no-sandbox"]})
 try{
  const context=await browser.newContext({viewport:{width:390,height:844}})
  const page=await context.newPage(),errors=[]
  page.on("pageerror",error=>errors.push(error.message))
  page.on("dialog",dialog=>dialog.accept())
  const item={key:"verification-title",title:"Watermark verification",year:"2026",type:"movie",poster:"",description:"Verification fixture"}
  await context.route("**/api/library?**",route=>{
   const action=new URL(route.request().url()).searchParams.get("action")
   const json=action==="list"?{success:true,items:[item],page:1,limit:12,hasNext:false}
     :action==="detail"?{success:true,item,seasons:[],episodes:[],audioTracks:[]}
     :{success:true,sources:[{url:source,downloadUrl:source,quality:"720p",label:"720p",format:"MP4"}],subtitles:[]}
   return route.fulfill({json})
  })
  let submissions=0
  await context.route("**/api/video-exports",route=>{
   assert.equal(route.request().method(),"POST")
   assert.equal(route.request().postDataJSON().confirmed,true)
   submissions++
   return route.fulfill({status:202,json:{key:jobKey,title:item.title}})
  })
  await page.goto(`https://${process.env.REPLIT_DEV_DOMAIN}/movies`,{waitUntil:"domcontentloaded"})
  await page.getByRole("button",{name:"Open Watermark verification",exact:true}).click()
  await page.getByRole("button",{name:"Download 720p · MP4",exact:true}).click()
  const panel=page.getByRole("region",{name:"Watermarked videos"})
  await panel.getByRole("button",{name:"Save watermarked video",exact:true}).waitFor({timeout:45000})
  assert.equal(submissions,1)
  await page.reload({waitUntil:"domcontentloaded"})
  await panel.getByRole("button",{name:"Save watermarked video",exact:true}).waitFor()
  assert.equal(submissions,1,"Reload must not submit another paid job")
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("tvroom.video-exports.v1")))
  assert.equal(saved[0].status,"done")
  const file=await context.request.get(new URL(saved[0].downloadUrl,page.url()).href,{headers:{Range:"bytes=0-1023"}})
  assert.equal(file.status(),206)
  assert.equal(file.headers()["x-tvroom-watermark"],"permanent")
  assert.equal((await file.body()).length,1024)
  const downloadEvent=page.waitForEvent("download")
  await panel.getByRole("button",{name:"Save watermarked video",exact:true}).click()
  const download=await downloadEvent
  const savedPath=await download.path()
  assert.ok(fs.statSync(savedPath).size>10000,"Download contains the real rendered file, not JSON")
  for(const width of [320,768,1440]){
   await page.setViewportSize({width,height:900})
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
  }
  assert.deepEqual(errors,[])
  console.log(JSON.stringify({status:"passed",submissions,bytes:fs.statSync(savedPath).size,persistentQueue:true,watermarkedAttachment:true,pageErrors:errors}))
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1})

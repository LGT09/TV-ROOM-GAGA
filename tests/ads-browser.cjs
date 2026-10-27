const {chromium}=require("@playwright/test")
const assert=require("node:assert/strict")
;(async()=>{
 const browser=await chromium.launch({executablePath:"/repl/tools/bin/chromium",args:["--no-sandbox"]})
 try{
  // Do not generate ad clicks/impressions during automated interaction checks.
  const context=await browser.newContext({viewport:{width:390,height:844}})
  let requests=0
  await context.route("https://acscdn.com/script/aclib.js",route=>{
   requests++
   return route.fulfill({contentType:"text/javascript",body:"window.aclib={runAutoTag:function(options){window.__verifiedAdZones=(window.__verifiedAdZones||[]).concat(options.zoneId)}};"})
  })
  const page=await context.newPage(),errors=[]
  page.on("pageerror",error=>errors.push(error.message))
  await page.goto(`https://${process.env.REPLIT_DEV_DOMAIN}/privacy`,{waitUntil:"domcontentloaded"})
  await page.waitForFunction(()=>window.__verifiedAdZones?.length===1)
  assert.deepEqual(await page.evaluate(()=>window.__verifiedAdZones),["txhkagiska"])
  assert.equal(await page.locator("head #aclib").count(),1)
  assert.equal(await page.locator("head #adcash-auto-tag").count(),1)
  assert.equal(await page.locator("#aclib").getAttribute("src"),"https://acscdn.com/script/aclib.js")
  await page.getByRole("link",{name:"Help & guide",exact:true}).click()
  await page.waitForURL("**/docs")
  assert.equal(requests,1,"SPA navigation must not reload the ad library")
  assert.deepEqual(await page.evaluate(()=>window.__verifiedAdZones),["txhkagiska"])
  for(const width of [320,768,1440]){
   await page.setViewportSize({width,height:900})
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
  }
  assert.deepEqual(errors,[])
  const blocked=await browser.newContext()
  await blocked.route("https://acscdn.com/script/aclib.js",route=>route.abort())
  const blockedPage=await blocked.newPage(),blockedErrors=[]
  blockedPage.on("pageerror",error=>blockedErrors.push(error.message))
  await blockedPage.goto(`https://${process.env.REPLIT_DEV_DOMAIN}/privacy`,{waitUntil:"domcontentloaded"})
  await blockedPage.getByRole("heading",{name:"Privacy, plainly."}).waitFor()
  assert.deepEqual(blockedErrors,[])
  console.log(JSON.stringify({singleLibraryRequest:requests,zone:"txhkagiska",singleInitialization:true,blockedLibrarySafe:true,pageErrors:errors}))
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1})

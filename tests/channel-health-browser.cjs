const {chromium}=require("@playwright/test")
const assert=require("node:assert/strict")
;(async()=>{
  const browser=await chromium.launch({executablePath:"/repl/tools/bin/chromium",args:["--no-sandbox"]})
  try{
    const context=await browser.newContext({viewport:{width:390,height:844}})
    await context.route("https://acscdn.com/**",route=>route.abort())
    const page=await context.newPage(),errors=[]
    page.on("pageerror",error=>errors.push(error.message))
    let pings=0
    await page.route("**/api/live-tv?**",async route=>{
      const url=new URL(route.request().url())
      if(url.searchParams.get("action")==="ping"){
        pings++
        await new Promise(done=>setTimeout(done,150))
        return route.fulfill({json:{success:true,results:[{id:"one",active:true,latencyMs:125,checkedAt:Date.now()},{id:"two",active:false,latencyMs:2500,checkedAt:Date.now()}]}})
      }
      return route.fulfill({json:{success:true,channels:[{id:"one",name:"Active Test",country:"ZW",category:"general"},{id:"two",name:"Offline Test",country:"US",category:"news"}],totalChannels:2,categories:["general","news"],countries:["ZW","US"]}})
    })
    await page.goto(`https://${process.env.REPLIT_DEV_DOMAIN}/live-tv`,{waitUntil:"domcontentloaded"})
    await page.getByRole("button",{name:"Check channels",exact:true}).waitFor()
    await page.getByRole("button",{name:"Check channels",exact:true}).click()
    await page.getByText("Active · 125 ms",{exact:true}).waitFor()
    await page.getByText("Unavailable",{exact:true}).waitFor()
    assert.equal(pings,1)
    await page.getByRole("checkbox",{name:"Active only"}).check()
    await page.getByRole("button",{name:/Active Test/}).waitFor()
    assert.equal(await page.getByRole("button",{name:/Offline Test/}).count(),0)
    for(const width of [320,768,1440]){
      await page.setViewportSize({width,height:900})
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Overflow at ${width}`)
    }
    assert.deepEqual(errors,[])
    console.log(JSON.stringify({ping:true,activeOnly:true,responsive:[320,768,1440],pageErrors:errors}))
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1})

const { chromium } = require("@playwright/test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const baseURL = `https://${process.env.REPLIT_DEV_DOMAIN}`
;(async()=>{
  fs.mkdirSync("generated-artifacts",{recursive:true})
  const browser=await chromium.launch({executablePath:"/repl/tools/bin/chromium",headless:true,args:["--no-sandbox"]})
  const context=await browser.newContext({viewport:{width:1365,height:900},acceptDownloads:true})
  const page=await context.newPage(), errors=[], flows=[]
  page.on("pageerror",e=>errors.push(e.message))
  const cards=()=>page.locator('button.group[aria-label^="Open "]')
  try{
    if(!process.env.CHECK_TAIL){
    await page.goto(`${baseURL}/movies`,{waitUntil:"domcontentloaded"})
    await cards().first().waitFor({timeout:45000})
    assert.equal(await cards().count(),12)
    await page.getByLabel("Items per page").selectOption("24")
    await page.waitForFunction(()=>document.querySelectorAll('button.group[aria-label^="Open "]').length===24)
    const first=await cards().first().getAttribute("aria-label")
    await page.getByRole("button",{name:"Next page",exact:true}).click()
    await page.waitForFunction(first=>document.querySelector('button.group[aria-label^="Open "]')?.getAttribute("aria-label")!==first,first)
    const horrorResponse=page.waitForResponse(r=>r.url().includes("/api/library?")&&r.url().includes("category=horror"))
    await page.getByRole("button",{name:"Horror",exact:true}).click()
    await horrorResponse
    await page.getByRole("button",{name:"Horror",exact:true}).click()
    assert.equal(await page.getByRole("button",{name:"Horror",exact:true}).getAttribute("aria-pressed"),"true")
    assert.ok(!/provider index|advanced actions|omegatech|moviebox|sinhalasub/i.test(await page.locator("body").innerText()))
    flows.push({flow:"real library page sizes, pagination, category, active-filter repeat",result:"passed"})
    await page.goto(`${baseURL}/movies?q=Breaking+Bad`,{waitUntil:"domcontentloaded"})
    await cards().first().waitFor({timeout:45000})
    await cards().first().click()
    const seasons=page.getByLabel("Season",{exact:true})
    await seasons.waitFor({timeout:25000})
    assert.equal(await seasons.locator("option").count(),5)
    assert.equal(await page.getByRole("button",{name:/^Episode \d+ Ep \d+$/}).count(),7)
    await seasons.selectOption("5")
    assert.equal(await page.getByRole("button",{name:/^Episode \d+ Ep \d+$/}).count(),16)
    flows.push({flow:"real series seasons and episode counts",result:"passed"})
    await page.goto(`${baseURL}/movies?category=anime`,{waitUntil:"domcontentloaded"})
    await cards().first().waitFor({timeout:30000})
    await cards().first().click()
    await seasons.waitFor({timeout:25000})
    assert.ok(await seasons.locator("option").count()>0)
    assert.ok(await page.getByRole("button",{name:/^Episode \d+ Ep \d+$/}).count()>0)
    await page.screenshot({path:"generated-artifacts/anime-details.png"})
    flows.push({flow:"real anime seasons and episodes",result:"passed"})
    for(const route of ["/home","/movies","/music","/playlists","/download","/downloader","/live-tv","/docs","/about","/privacy","/terms","/search","/discover"]){
      await page.goto(baseURL+route,{waitUntil:"domcontentloaded"})
      await page.locator("main").first().waitFor()
      for(const width of [320,768,1440]){
        await page.setViewportSize({width,height:900})
        await page.waitForTimeout(100)
        const size=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}))
        assert.ok(size.scroll<=size.width+1,`${route} overflow at ${width}: ${JSON.stringify(size)}`)
      }
    }
    flows.push({flow:"13 routes at 320, 768 and 1440 pixels without horizontal page overflow",result:"passed"})
    await page.setViewportSize({width:390,height:844})
    await page.goto(`${baseURL}/live-tv`,{waitUntil:"domcontentloaded"})
    const countries=page.getByLabel("Country",{exact:true})
    await page.waitForFunction(()=>document.querySelector('select[aria-label="Country"]')?.options.length>10,{timeout:45000})
    const unitedStates=await countries.locator('option[value="US"]').innerText()
    assert.match(unitedStates,/🇺🇸 United States/)
    const countryResponse=page.waitForResponse(r=>r.url().includes("/api/live-tv?")&&r.url().includes("country=US"))
    await countries.selectOption("US")
    await countryResponse
    await countries.selectOption("")
    await page.getByRole("textbox",{name:"Search public channels"}).fill("Jazeera")
    await page.getByRole("button",{name:"Search",exact:true}).click()
    const channel=page.getByRole("button").filter({hasText:"Al Jazeera"}).first()
    await channel.waitFor({timeout:45000});await channel.click()
    await page.locator("video").waitFor({timeout:25000})
    const live=await page.locator("video").evaluate(async video=>{
      try{await video.play();await new Promise(r=>setTimeout(r,6500));return{width:video.videoWidth,currentTime:video.currentTime,error:video.error?.message||null}}
      catch(e){return{error:e.message}}
    })
    assert.ok(live.width>0&&live.currentTime>0,`HLS playback failed: ${JSON.stringify(live)}`)
    flows.push({flow:"live TV country names/flags and real HLS playback",result:"passed",playback:live})
    await page.screenshot({path:"generated-artifacts/live-tv-mobile.png"})
    }
    const splash=await context.newPage()
    await splash.goto(baseURL,{waitUntil:"domcontentloaded"})
    await splash.getByRole("button",{name:/Enter the room/i}).waitFor({timeout:10000})
    await splash.close()
    await page.goto(`${baseURL}/docs`)
    assert.ok(await page.locator('a[href="https://traxxiontech.com"]').count()>0)
    flows.push({flow:"welcome splash, public documentation and creator link",result:"passed"})
    const fixture=await context.newPage()
    const film={key:"test-title",title:"Download transfer check",poster:"",description:"Controlled test data.",year:"2026",type:"movie"}
    await fixture.route("**/api/library?**",async route=>{
      const action=new URL(route.request().url()).searchParams.get("action")||"list"
      const data=action==="list"?{items:[film],page:1,limit:12,hasNext:false}:
        action==="detail"?{item:film,seasons:[],episodes:[],audioTracks:[]}:
        {sources:[{url:"/transfer-fixture.mp4",downloadUrl:"/transfer-fixture.mp4?download=1",quality:"720p",label:"720p",format:"MP4"}],subtitles:[]}
      await route.fulfill({json:{success:true,...data}})
    })
    await fixture.goto(`${baseURL}/movies`)
    await fixture.getByRole("button",{name:"Open Download transfer check"}).click()
    await fixture.getByRole("button",{name:"Play movie",exact:true}).click()
    const downloadLink=fixture.getByRole("link",{name:/Download 720p/})
    assert.equal(await downloadLink.getAttribute("href"),"/transfer-fixture.mp4?download=1")
    assert.equal(await downloadLink.getAttribute("download"),"")
    await fixture.close()
    flows.push({flow:"direct download action renders from returned source (controlled fixture; transfer/ranges tested separately)",result:"passed"})
    assert.deepEqual(errors,[])
    fs.writeFileSync("generated-artifacts/browser-results.json",JSON.stringify({flows,errors},null,2))
    console.log(JSON.stringify({flows,errors},null,2))
  }catch(e){await page.screenshot({path:"generated-artifacts/browser-failure.png"});fs.writeFileSync("generated-artifacts/browser-failure.txt",await page.locator("body").innerText());throw e}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1})

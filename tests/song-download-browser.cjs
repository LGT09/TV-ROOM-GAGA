const {chromium}=require("@playwright/test")
const assert=require("node:assert/strict")
;(async()=>{
  const browser=await chromium.launch({executablePath:"/repl/tools/bin/chromium",args:["--no-sandbox"]})
  try{
    const context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true})
    // Chromium attachment navigations can bypass request fixtures. Observe the
    // native handoff without downloading a fake token's server error as a file.
    await context.addInitScript(()=>{
      window.__downloadHandoffs=[]
      document.addEventListener("click",event=>{
        const anchor=event.target.closest?.("a[download]")
        if(anchor&&/\/api\/(?:media|music-extras)\?/.test(anchor.href)){event.preventDefault();window.__downloadHandoffs.push(anchor.href)}
      },true)
    })
    await context.route("https://acscdn.com/**",route=>route.abort())
    const page=await context.newPage(),errors=[]
    page.on("pageerror",error=>errors.push(error.message))
    const song={trackId:"example",trackName:"Example Song",artistName:"Example Artist",videoId:"YQHsXMglC9A",isPreview:false}
    await page.route("**/api/music?**",route=>{
      const action=new URL(route.request().url()).searchParams.get("action")
      return route.fulfill({json:action==="download-mp3"?{success:true,downloadUrl:"/api/media?key=one",choices:[
        {quality:"128 kbps",format:"MP3",sizeBytes:5242880,downloadUrl:"/api/media?key=one"},
        {quality:"256 kbps",format:"MP3",sizeBytes:10485760,downloadUrl:"/api/media?key=two"},
      ]}:{results:[song]}})
    })
    await page.route("**/api/music-extras",route=>route.fulfill({json:{success:true,downloadUrl:"/api/music-extras?key=extras",sizeBytes:1024,lyricsStatus:"Available",files:[{name:"cover.jpg",sizeBytes:500},{name:"artist-and-track.json",sizeBytes:100},{name:"lyrics.txt",sizeBytes:100},{name:"lyrics.lrc",sizeBytes:100}]}}))
    await page.route("**/api/music-extras?**",route=>route.fulfill({contentType:"application/zip",headers:{"Content-Disposition":'attachment; filename="song-extras.zip"'},body:"Browser download fixture"}))
    await page.route("**/api/media?**",route=>route.fulfill({contentType:"audio/mpeg",headers:{"X-TVRoom-Media-Kind":"audio","X-TVRoom-File-Size":"10485760","Content-Disposition":'attachment; filename="song.mp3"'},body:route.request().method()==="HEAD"?"":"Browser audio fixture"}))
    await page.goto(`https://${process.env.REPLIT_DEV_DOMAIN}/music`,{waitUntil:"domcontentloaded"})
    await page.getByRole("button",{name:"Download full song Example Song",exact:true}).click()
    await page.getByRole("dialog").waitFor()
    await page.getByRole("combobox",{name:"Download quality"}).selectOption("1")
    assert.match(await page.getByRole("combobox",{name:"Download quality"}).inputValue(),/1/)
    await page.getByText("lyrics.lrc · 100 B",{exact:true}).waitFor()
    await page.getByRole("button",{name:"Download audio",exact:true}).click()
    await page.waitForFunction(()=>window.__downloadHandoffs.length===1)
    assert.match((await page.evaluate(()=>window.__downloadHandoffs))[0],/key=two/)
    await page.getByRole("button",{name:"Save extras ZIP",exact:true}).click()
    assert.match((await page.evaluate(()=>window.__downloadHandoffs))[1],/music-extras\?key=extras/)
    for(const width of [320,768,1440]){
      await page.setViewportSize({width,height:900})
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Overflow at ${width}`)
    }
    assert.deepEqual(errors,[])
    console.log(JSON.stringify({nativeQualityChoices:2,sizeVisible:true,audioHandoff:true,extrasHandoff:true,responsive:[320,768,1440],pageErrors:errors}))
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1})

const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const ts = require("typescript")

function sandbox(overrides = {}, fetcher = async () => new Response("data", { headers: { "content-type": "video/mp4" } }), env = { SESSION_SECRET: "unit-test-fixture-not-a-real-secret" }) {
  const cache = new Map()
  function load(file) {
    file = path.resolve(file)
    if (file.endsWith(".json.ts")) return JSON.parse(fs.readFileSync(file.slice(0,-3),"utf8"))
    if (overrides[file]) return overrides[file]
    if (cache.has(file)) return cache.get(file)
    const module = { exports: {} }
    cache.set(file, module.exports)
    const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
    const req = id => id === "server-only" ? {} : id === "next/server" ? { NextResponse: { json: (data, options) => Response.json(data, options) } } :
      id.startsWith("@/") ? load(id.slice(2) + ".ts") : id.startsWith(".") ? load(path.resolve(path.dirname(file), id + ".ts")) : overrides[id] || require(id)
    new Function("require", "module", "exports", "process", "fetch", code)(req, module, module.exports, { env }, fetcher)
    return module.exports
  }
  return load
}
const base = (id = "moviebox") => ({ id: "1234567890123456789", title: "Example", poster: "https://pbcdn.aoneroom.com/poster.jpg", year: "2023", description: "A film.", type: "movie", detailPath: "example-slug", url: "", provider: id, genres: ["Horror"] })
const response = (items = [], sources = []) => ({ items, sources, subtitles: [], seasons: [], episodes: [], audioTracks: [] })

test("song trending, discovery and searches use Nayan without substituting chart previews", async()=>{
  const calls=[]
  const load=sandbox({},async input=>{
    const url=new URL(String(input));calls.push(url)
    assert.equal(url.hostname,"nayan-video-downloader.vercel.app")
    assert.equal(url.pathname,"/ytsearch")
    return Response.json({results:[{id:"YQHsXMglC9A",title:"Adele - Hello",url:"https://www.youtube.com/watch?v=YQHsXMglC9A",author:"Adele"}]})
  })
  const {musicList}=load("lib/music/service.ts")
  for(const [query,trending] of [["",true],["",false],["Adele",false],["https://youtu.be/YQHsXMglC9A",false]]){
    const result=await musicList(query,trending)
    assert.equal(result.results.length,1)
    assert.equal(result.results[0].isPreview,false)
    assert.match(result.results[0].previewUrl,/youtube\.com/)
  }
  assert.equal(calls.length,4)
  const failing=sandbox({},async()=>{throw new Error("Connection down")})("lib/music/service.ts")
  await assert.rejects(()=>failing.musicList("missing"),/search is temporarily unavailable/)
})
test("original movie download mode reaches the browser without changing media bytes",async()=>{
  const load=sandbox({},async()=>new Response("original movie bytes",{headers:{"Content-Type":"video/mp4"}}))
  const {seal}=load("lib/library/tokens.ts")
  const key=seal("media",{url:"https://cdn.hakunaymatata.com/movie.mp4",kind:"video",downloadMode:"original",title:"Movie"})
  const result=await load("app/api/media/route.ts").GET(new Request(`https://app.example/api/media?key=${key}&download=1`))
  assert.equal(result.headers.get("X-TVRoom-Download-Mode"),"original")
  assert.equal(result.headers.get("X-TVRoom-Watermark"),null)
  assert.equal(await result.text(),"original movie bytes")
})

test("watermarked exports retain full duration, audio and portrait aspect ratio", () => {
  const {watermarkEdit}=sandbox()("lib/video-exports.ts")
  const edit=watermarkEdit("https://cdn.hakunaymatata.com/source.mp4",1080,1920)
  assert.deepEqual(edit.output.size,{width:1080,height:1920})
  const [watermark,video]=edit.timeline.tracks.map(track=>track.clips[0])
  assert.equal(watermark.asset.text,"TV ROOM GAGA")
  assert.equal(watermark.length,"alias://source")
  assert.equal(video.length,"auto")
  assert.equal(video.asset.volume,1)
  assert.equal(edit.output.format,"mp4")
})
test("background export validates source keys, deduplicates renders and conceals job identifiers", async () => {
  const calls=[]
  const sdk={ReplitConnectors:class{async proxy(connector,path,options){
    calls.push({path,options})
    return Response.json({success:true,response:path.includes("/probe/")?{metadata:{format:{duration:"12"},streams:[{codec_type:"video",width:1280,height:720}]}}:{id:"12345678-1234-1234-1234-123456789012"}})
  }}}
  const load=sandbox({"@replit/connectors-sdk":sdk})
  const {seal}=load("lib/library/tokens.ts")
  const {startVideoExport}=load("lib/video-exports.ts")
  const mediaKey=seal("media",{url:"https://cdn.hakunaymatata.com/source.mp4",kind:"video",title:"Test film"})
  const [first,second]=await Promise.all([startVideoExport(mediaKey),startVideoExport(mediaKey)])
  assert.equal(first.key,second.key)
  assert.equal(first.title,"Test film")
  assert.ok(!first.key.includes("12345678"))
  assert.equal(calls.filter(call=>call.path==="/edit/v1/render").length,1)
  await assert.rejects(()=>startVideoExport(seal("media",{url:"https://cdn.hakunaymatata.com/live.m3u8",kind:"video",format:"HLS"})),/adaptive/)
  await assert.rejects(()=>startVideoExport(seal("media",{url:"https://cdn.hakunaymatata.com/file.mp3",kind:"audio"})),/original video/)
  await assert.rejects(()=>startVideoExport(seal("media",{url:"https://evil.example/movie.mp4",kind:"video"})),/host/)
})
test("render status only offers a processed attachment after done and validates output bucket", async () => {
  let result={status:"rendering"}
  const sdk={ReplitConnectors:class{async proxy(){return Response.json({success:true,response:result})}}}
  const load=sandbox({"@replit/connectors-sdk":sdk})
  const {seal,unseal}=load("lib/library/tokens.ts")
  const {videoExportStatus}=load("lib/video-exports.ts")
  const key=seal("video-export",{id:"12345678-1234-1234-1234-123456789012",title:"Test"})
  assert.deepEqual(await videoExportStatus(key),{status:"rendering"})
  result={status:"failed"}
  assert.equal((await videoExportStatus(key)).downloadUrl,undefined)
  result={status:"done",url:"https://untrusted-bucket.s3.amazonaws.com/video.mp4"}
  await assert.rejects(()=>videoExportStatus(key),/verified/)
  result={status:"done",url:"https://shotstack-api-v1-output.s3-ap-southeast-2.amazonaws.com/video.mp4"}
  const done=await videoExportStatus(key)
  const media=unseal(new URL(done.downloadUrl,"https://app.example").searchParams.get("key"),"media")
  assert.equal(media.branded,true)
  assert.equal(media.kind,"video")
  assert.equal(done.status,"done")
})
test("render submissions reject cross-origin and unconfirmed requests", async () => {
  const {POST}=sandbox()("app/api/video-exports/route.ts")
  const bad=await POST(new Request("https://app.example/api/video-exports",{method:"POST",headers:{host:"app.example",origin:"https://evil.example"},body:"{}"}))
  assert.equal(bad.status,403)
  const unconfirmed=await POST(new Request("https://app.example/api/video-exports",{method:"POST",headers:{host:"app.example",origin:"https://app.example"},body:"{}"}))
  assert.equal(unconfirmed.status,400)
})

test("title keys conceal integration data, authenticate changes and enforce purpose/expiry", () => {
  const { seal, unseal } = sandbox()("lib/library/tokens.ts")
  const value = { provider: "private-integration", id: "huge-id", url: "https://example.com/private" }
  const token = seal("item", value)
  assert.ok(!token.includes("private-integration"))
  assert.deepEqual(unseal(token, "item"), value)
  assert.throws(() => unseal(token, "media"), /invalid or expired/)
  assert.throws(() => unseal(token.slice(0, -3) + "abc", "item"), /invalid or expired/)
  assert.throws(() => unseal(seal("item", value, -1), "item"), /invalid or expired/)
})
test("build-scoped signing works across function instances without SESSION_SECRET", () => {
  const first=sandbox({},undefined,{})("lib/library/tokens.ts")
  const second=sandbox({},undefined,{})("lib/library/tokens.ts")
  const token=first.seal("media",{url:"https://cdn.aoneroom.com/file"})
  assert.equal(second.unseal(token,"media").url,"https://cdn.aoneroom.com/file")
  assert.throws(()=>second.unseal(token+"tamper","media"),/invalid or expired/)
})
test("YouTube links normalize safely, and media files exclude previews and watch pages", () => {
  const youtube=sandbox()("lib/music/youtube.ts")
  assert.equal(youtube.youtubeUrl("https://youtu.be/YQHsXMglC9A?t=30"),"https://www.youtube.com/watch?v=YQHsXMglC9A")
  assert.equal(youtube.youtubeUrl("https://youtube.com.evil.test/watch?v=YQHsXMglC9A"),"")
  assert.equal(youtube.youtubeUrl("https://www.youtube.com/shorts/YQHsXMglC9A"),"https://www.youtube.com/watch?v=YQHsXMglC9A")
  assert.deepEqual(youtube.youtubeFiles({result:{url:"https://youtube.com/watch?v=YQHsXMglC9A",download:"https://cdn403.savetube.vip/full.mp3"}},"audio"),["https://cdn403.savetube.vip/full.mp3"])
  assert.deepEqual(youtube.youtubeFiles({result:{audio:"https://audio-ssl.itunes.apple.com/AudioPreview/song.m4a"}},"audio"),[])
})
test("client HTML errors have readable messages instead of JSON parser exceptions",async()=>{
  const {readApiJson}=sandbox()("lib/client-json.ts")
  await assert.rejects(()=>readApiJson(new Response("<!DOCTYPE html>bad gateway",{status:502})),/server returned a page/i)
  assert.deepEqual(await readApiJson(Response.json({success:true})),{success:true})
})
test("category metadata is inherited and merged across duplicate section entries", () => {
  const { normalizeProvider } = sandbox()("lib/providers/normalize.ts")
  const data = normalizeProvider({ sections: [{ section: "Banner", items: [{ id: "1", title: "One" }] }, { section: "Horror Movies", items: [{ id: "1", title: "One" }] }] }, "moviebox")
  assert.equal(data.items.length, 1)
  assert.ok(data.items[0].genres.includes("Horror Movies"))
})
test("genre/type metadata identifies anime while keeping anime films as films", () => {
  const { normalizeProvider } = sandbox()("lib/providers/normalize.ts")
  const series = normalizeProvider({ subject: { id: "1", title: "Animation", subjectType: 2, countryName: "Japan", genre: "Animation,Action" } }, "moviebox")
  const film = normalizeProvider({ subject: { id: "1", title: "Animation", subjectType: 1, countryName: "Japan", genre: "Animation,Action" } }, "moviebox")
  assert.equal(series.items[0].type, "anime")
  assert.equal(film.items[0].type, "movie")
  assert.ok(film.items[0].genres.includes("Anime"))
})
test("same-title fallback does not accept a sequel, remake year or unrelated title", () => {
  const { sameTitle } = sandbox()("lib/library/categories.ts")
  assert.ok(sameTitle({ title: "Example [English]", year: "2023" }, { title: "Example", year: "2023" }))
  assert.equal(sameTitle({ title: "Example", year: "2023" }, { title: "Example 2", year: "2023" }), false)
  assert.equal(sameTitle({ title: "Example", year: "2023" }, { title: "Example", year: "1990" }), false)
})
test("failed catalogue connection falls back; paging is bounded and public metadata hides routing", async () => {
  const calls = []
  const load = sandbox({ [path.resolve("lib/providers/service.ts")]: { runProvider: async id => {
    calls.push(id)
    if (id !== "moviebox") throw new Error("Unavailable")
    return response(Array.from({length:31}, (_, i) => ({ ...base(id), id:String(i), title:`Film ${i}` })))
  } } })
  const { libraryList } = load("lib/library/service.ts")
  const first = await libraryList(new URLSearchParams({ limit: "12" }))
  const second = await libraryList(new URLSearchParams({ limit: "12", page: "2" }))
  assert.equal(first.items.length, 12)
  assert.equal(second.items[0].title, "Film 12")
  assert.equal(first.hasNext, true)
  assert.ok(calls.includes("moviebox") && calls.includes("omega-MovieBox-pro"))
  assert.equal(calls[0],"omega-MovieBox-pro")
  assert.ok(!JSON.stringify(first).includes("omega-MovieBox") && !JSON.stringify(first).includes("aoneroom.com"))
  assert.ok(first.items[0].poster.startsWith("/api/media?key="))
})
test("stream fallback preserves film episode zero and supplies opaque file download routes", async () => {
  const calls = []
  const load = sandbox({ [path.resolve("lib/providers/service.ts")]: { runProvider: async (id, action, p) => {
    calls.push({id, action, season:p.get("season"), episode:p.get("episode")})
    if (id === "moviebox") throw new Error("Primary failed")
    return response([], [{ url: "https://cdn.hakunaymatata.com/example.mp4", download: "https://cdn.hakunaymatata.com/example.mp4", quality: "720p", label: "720p", format: "MP4" }])
  } } })
  const { publicItem, libraryStream } = load("lib/library/service.ts")
  const item = publicItem(base())
  const data = await libraryStream(item.key, new URLSearchParams({ season: "5", episode: "3" }))
  assert.equal(data.sources.length, 1)
  assert.ok(data.sources[0].downloadUrl.startsWith("/api/media?key="))
  assert.ok(data.sources[0].downloadUrl.endsWith("&download=1"))
  assert.ok(!JSON.stringify(data).includes("hakunaymatata.com"))
  assert.ok(calls.filter(c=>c.action==="stream").every(c=>c.season==="0"&&c.episode==="0"))
})
test("genre filters reject family films mislabeled by an upstream horror collection",async()=>{
  const load=sandbox({[path.resolve("lib/providers/service.ts")]:{runProvider:async(id,action,p)=>{
    const item={...base(id),id:p.get("id")||"1",genres:action==="detail"?["Animation","Comedy","Family"]:["Horror Movies"]}
    return response([item])
  }}})
  const {libraryList}=load("lib/library/service.ts")
  const list=await libraryList(new URLSearchParams({category:"horror"}))
  assert.equal(list.items.length,0)
})
test("series details enumerate the exact known episode counts without inventing seasons", async () => {
  const item={...base(),type:"series"}
  const load=sandbox({[path.resolve("lib/providers/service.ts")]:{runProvider:async (_id,action)=>({
    ...response(action==="detail"?[item]:[]),
    seasons:action==="resources"?[{season:1,episode_count:7},{season:2,episode_count:13}]:[],
  })}})
  const { publicItem, libraryDetail }=load("lib/library/service.ts")
  const details=await libraryDetail(publicItem(item).key)
  assert.equal(details.seasons.length,2)
  assert.equal(details.episodes.length,20)
  assert.equal(details.episodes.filter(e=>e.season===1).length,7)
  assert.equal(details.episodes.at(-1).episode,13)
})
test("media route forwards byte ranges and streams an attachment with a safe filename", async () => {
  let observed
  const load = sandbox({ [path.resolve("lib/providers/media-url.ts")]: {
    allowedMediaUrl: input => new URL(input),
    mediaFetch: async (_url, headers) => {
      observed = headers.Range
      return new Response("abc", { status:206, headers: { "content-type":"video/mp4", "content-range":"bytes 0-2/10", "accept-ranges":"bytes" } })
    },
  } })
  const { seal } = load("lib/library/tokens.ts")
  const { GET } = load("app/api/media/route.ts")
  const token = seal("media", { url:"https://cdn.hakunaymatata.com/film.mp4", title:'Title/"unsafe"', kind:"video" })
  const result = await GET(new Request(`https://app.test/api/media?key=${token}&download=1`, { headers: { range:"bytes=0-2" } }))
  assert.equal(result.status,206)
  assert.equal(observed,"bytes=0-2")
  assert.equal(result.headers.get("content-range"),"bytes 0-2/10")
  assert.match(result.headers.get("content-disposition"), /^attachment; filename="Title__unsafe_.mp4"$/)
  assert.equal(await result.text(),"abc")
})
test("HLS manifests rewrite child media requests and cannot be saved as full-film MP4", async () => {
  const load = sandbox({ [path.resolve("lib/providers/media-url.ts")]: {
    allowedMediaUrl: input => new URL(input),
    mediaFetch: async () => new Response("#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI=\"key.bin\"\n#EXTINF:10,\nsegment.ts\n", { headers: {"content-type":"application/vnd.apple.mpegurl"} }),
  } })
  const { seal } = load("lib/library/tokens.ts")
  const { GET } = load("app/api/media/route.ts")
  const token = seal("media", {url:"https://cdn.hakunaymatata.com/master.m3u8",kind:"video",format:"HLS"})
  const playback = await GET(new Request(`https://app.test/api/media?key=${token}`))
  const text = await playback.text()
  assert.ok(text.includes('/api/media?key='))
  assert.ok(!text.includes("segment.ts") && !text.includes("key.bin"))
  const download = await GET(new Request(`https://app.test/api/media?key=${token}&download=1`))
  assert.equal(download.status,400)
})
test("country labels use full names and flags instead of ISO codes", () => {
  const { countryInfo } = sandbox()("lib/countries.ts")
  assert.equal(countryInfo("ZW").name,"Zimbabwe")
  assert.equal(countryInfo("US").name,"United States")
  assert.equal(countryInfo("GB").flag,"🇬🇧")
  assert.equal(countryInfo("GLOBAL").name,"Worldwide")
})
test("search normalizes task-only titles and direct file references without exposing them",()=>{
  const load=sandbox()
  const {normalizeProvider}=load("lib/providers/normalize.ts")
  const result=normalizeProvider({results:[{title:"Queued film",task_id:"task-123",downloadUrl:"https://cdn.aoneroom.com/media.mp4"}]},"omega-MovieBox-pro")
  assert.equal(result.items[0].id,"task-123")
  assert.equal(result.items[0].taskParam,"task_id")
  const publicFilm=load("lib/library/service.ts").publicItem(result.items[0])
  assert.ok(!JSON.stringify(publicFilm).includes("task-123"))
  assert.ok(!JSON.stringify(publicFilm).includes("aoneroom"))
})
test("default native search forwards keyword and task download preserves original task parameter",async()=>{
  const original=sandbox()("lib/providers/http.ts"),calls=[]
  const load=sandbox({[path.resolve("lib/providers/http.ts")]:{...original,providerJson:async url=>{
    calls.push(new URL(url));return {results:[{title:"Example",task_id:"task-123"}]}
  }}})
  const {runProvider}=load("lib/providers/service.ts")
  await runProvider("omega-MovieBox-pro","search",new URLSearchParams({q:"Example"}))
  assert.equal(calls[0].searchParams.get("keyword"),"Example")
  await runProvider("omega-MovieBox-pro","stream",new URLSearchParams({id:"task-123",task_id:"task-123"}))
  assert.equal(calls[1].searchParams.get("action"),"download")
  assert.equal(calls[1].searchParams.get("task_id"),"task-123")
  assert.equal(calls[1].searchParams.has("subjectId"),false)
})
test("movie preparation follows supplied status URL and retains task ID when a poll omits it",async()=>{
  const original=sandbox()("lib/providers/http.ts"),calls=[]
  const load=sandbox({[path.resolve("lib/providers/http.ts")]:{...original,providerJson:async url=>{
    calls.push(url)
    return calls.length===1?{status:"queued",task_id:"job-1",status_url:"https://api.omegatech.app/api/status?task_id=job-1"}:
      calls.length===2?{status:"processing"}:{status:"completed",downloadUrl:"https://cdn.aoneroom.com/film.mp4"}
  }}})
  const result=await load("lib/providers/movie-tasks.ts").movieTaskRequest("https://api.omegatech.app/api/movie/MovieBox-pro?action=download&subjectId=123")
  assert.equal(result.status,"completed")
  assert.equal(calls.length,3)
  assert.ok(calls.slice(1).every(url=>url.includes("task_id=job-1")))
})
test("movie task polling rejects cross-origin, credential and private-address targets",()=>{
  const {safeTaskUrl}=sandbox()("lib/providers/movie-tasks.ts")
  for(const bad of ["http://127.0.0.1/","https://evil.example/status","https://user:password@api.omegatech.app/status"])
    assert.throws(()=>safeTaskUrl(bad,"https://api.omegatech.app/api/movie/MovieBox-pro"))
})
test("retry resumes an existing movie task instead of creating a duplicate job",async()=>{
  const original=sandbox()("lib/providers/http.ts"),calls=[]
  const load=sandbox({[path.resolve("lib/providers/http.ts")]:{...original,providerJson:async url=>{
    calls.push(url)
    if(calls.length===1)return {status:"queued",taskId:"resume-1"}
    if(calls.length===2)throw new Error("Temporary network failure")
    return {status:"completed",downloadUrl:"https://cdn.aoneroom.com/done.mp4"}
  }}})
  const api=load("lib/providers/movie-tasks.ts"),url="https://api.omegatech.app/api/movie/MovieBox-pro?action=download&subjectId=resume"
  await assert.rejects(api.movieTaskRequest(url))
  await api.movieTaskRequest(url)
  assert.equal(calls.filter(call=>call===url).length,1)
  assert.ok(calls[2].includes("taskId=resume-1"))
})
test("search direct media URL can play without calling a task resolver",async()=>{
  let called=false
  const load=sandbox({[path.resolve("lib/providers/service.ts")]:{runProvider:async(_id,action)=>{if(action!=="search")called=true;throw new Error("Should not resolve")}}})
  const service=load("lib/library/service.ts")
  const result=await service.libraryStream(service.publicItem({...base(),mediaUrl:"https://cdn.aoneroom.com/direct.mp4"}).key,new URLSearchParams())
  assert.equal(result.sources.length,1)
  assert.equal(called,false)
})
test("music chart uses actual release dates, newest first and explicitly identifies previews",()=>{
  const {chartTracks}=sandbox()("lib/music/service.ts")
  const entry=(id,date)=>({id:{attributes:{"im:id":id}},"im:name":{label:"Track "+id},"im:artist":{label:"Artist"},"im:releaseDate":{label:date},
    link:[{attributes:{type:"audio/x-m4a",href:"https://audio-ssl.itunes.apple.com/sample.m4a"},"im:duration":{label:"30000"}}]})
  const tracks=chartTracks({feed:{entry:[entry("1","2020-01-01"),entry("2","2026-01-01")]}})
  assert.equal(tracks[0].trackId,"2")
  assert.equal(tracks[0].isPreview,true)
  assert.equal(tracks[0].trackTimeMillis,30000)
  assert.equal(chartTracks({feed:{entry:[entry("1","2020-01-01"),entry("2","2026-01-01")]}},false)[0].trackId,"1")
})
test("movie quality prefers original stream URL instead of failing gateway",()=>{
 const {normalizeProvider}=sandbox()("lib/providers/normalize.ts")
 const result=normalizeProvider({qualities:[{quality:"720p",streamUrl:"https://bad-gateway.example/stream",originalStreamUrl:"https://stream.omegatech.app/stream?id=123",downloadUrl:"https://stream.omegatech.app/download?id=123",format:"MP4"}]},"omega-MovieBox-pro")
 assert.equal(result.sources[0].url,"https://stream.omegatech.app/stream?id=123")
 assert.ok(!result.sources.some(source=>source.url.includes("bad-gateway")))
})
test("legacy movie relay links upgrade to verified HTTPS without allowing arbitrary HTTP",()=>{
 const {allowedMediaUrl}=sandbox()("lib/providers/media-url.ts")
 assert.equal(allowedMediaUrl("http://stream.omegatech.app/download?subjectId=123").protocol,"https:")
 assert.throws(()=>allowedMediaUrl("http://arbitrary.example/film.mp4"))
 assert.throws(()=>allowedMediaUrl("http://aoneroom.com/film.mp4"))
})
test("public provider requests use the compatible browser header",async()=>{
 let header=""
 const load=sandbox({},async(_url,options)=>{header=options.headers["User-Agent"];return new Response('{"success":true}')})
 await load("lib/providers/http.ts").providerJson("https://api.omegatech.app/api/movie/MovieBox-pro")
 assert.match(header,/Chrome\/.*Safari\//)
})
test("movie card name is searched before resolving the matched subject",async()=>{
 const calls=[]
 const load=sandbox({[path.resolve("lib/providers/service.ts")]:{runProvider:async(id,action,p)=>{
  calls.push({id,action,q:p.get("q"),subject:p.get("id")})
  return {items:action==="search"?[{...base(),provider:id,id:"matched-subject"}]:[],sources:action==="stream"?[{url:"https://stream.omegatech.app/stream?subjectId=matched-subject",quality:"720p",format:"MP4"}]:[],subtitles:[],seasons:[],episodes:[],audioTracks:[]}
 }}})
 const service=load("lib/library/service.ts")
 const result=await service.libraryStream(service.publicItem(base()).key,new URLSearchParams())
 assert.equal(calls[0].id,"omega-MovieBox-pro")
 assert.equal(calls[0].q,base().title)
 assert.equal(calls.find(call=>call.action==="stream").subject,"matched-subject")
 assert.ok(result.sources[0].downloadUrl)
})
test("media relay bounds connection time without aborting a long file body",async()=>{
 let signal
 const load=sandbox({},async(_url,options)=>{signal=options.signal;return new Response("video",{headers:{"content-type":"video/mp4"}})})
 const response=await load("lib/providers/media-url.ts").mediaFetch("https://stream.omegatech.app/stream",{},15)
 await new Promise(resolve=>setTimeout(resolve,40))
 assert.equal(signal.aborted,false)
 assert.equal(await response.text(),"video")
})
test("TV relay rejects private, reserved, link-local and mapped IP destinations",()=>{
 const {isPublicIp,publicStreamUrl}=sandbox()("lib/providers/public-stream.ts")
 for(const ip of ["127.0.0.1","10.0.0.1","169.254.169.254","172.16.1.1","192.168.0.1","100.64.0.1","::1","fc00::1","fe80::1","::ffff:127.0.0.1"])assert.equal(isPublicIp(ip),false,ip)
 for(const ip of ["8.8.8.8","1.1.1.1","2606:4700::1111"])assert.equal(isPublicIp(ip),true,ip)
 assert.throws(()=>publicStreamUrl("https://user:password@public.example/stream"))
 assert.throws(()=>publicStreamUrl("http://public.example/stream"))
})
test("TV HLS relay conceals origins and rewrites extensionless variants, keys and segments",async()=>{
 const helpers=sandbox()("lib/providers/public-stream.ts")
 const load=sandbox({[path.resolve("lib/providers/public-stream.ts")]:{...helpers,publicStreamFetch:async()=>({url:"https://public.example/redirected/master.m3u8",response:new Response('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=800000\nvariants/main\n#EXT-X-KEY:METHOD=AES-128,URI="key.bin"\n#EXTINF:6,\nsegment.ts',{headers:{"content-type":"application/vnd.apple.mpegurl"}})})}})
 const tokens=load("lib/library/tokens.ts"),key=tokens.seal("tv-stream",{url:"https://public.example/stream.m3u8",hls:true})
 const response=await load("app/api/tv-stream/route.ts").GET(new Request("https://app.test/api/tv-stream?key="+key))
 assert.equal(response.status,200)
 const manifest=await response.text()
 assert.ok(!manifest.includes("public.example"))
 const child=manifest.split("\n")[2]
 assert.ok(child.endsWith("&format=hls"))
 const target=tokens.unseal(new URL(child,"https://app.test").searchParams.get("key"),"tv-stream")
 assert.equal(target.url,"https://public.example/redirected/variants/main")
 assert.equal(target.hls,true)
})
test("Apple preview playback is not represented as full-song audio",async()=>{
  const load=sandbox(),result=await load("lib/music/service.ts").musicFile("https://audio-ssl.itunes.apple.com/AudioPreview/sample.m4a","Example",false)
  assert.equal(result.isPreview,true)
  assert.ok(result.audioUrl.startsWith("/api/media?key="))
  assert.equal(result.downloadUrl,undefined)
})
test("full-song request resolves the title instead of saving the Apple preview",async()=>{
  const original=sandbox()("lib/providers/http.ts"),calls=[]
  const load=sandbox({[path.resolve("lib/providers/http.ts")]:{...original,providerJson:async url=>{
    calls.push(url)
    if(url.includes("ytsearch"))return {results:[{id:"video-123",title:"Example Artist",url:"https://www.youtube.com/watch?v=video-123"}]}
    return {result:{audio:{url:"https://cdn.aoneroom.com/full-audio"}}}
  }}},async()=>new Response("audio",{headers:{"content-type":"audio/mp4"}}))
  const result=await load("lib/music/service.ts").musicFile("https://audio-ssl.itunes.apple.com/AudioPreview/sample.m4a","Example Artist",true)
  assert.ok(calls.some(url=>url.includes("ytsearch")))
  assert.equal(result.isPreview,false)
  assert.equal(result.format,"M4A")
  const decoded=load("lib/library/tokens.ts").unseal(new URL(result.downloadUrl,"https://app.test").searchParams.get("key"),"media")
  assert.equal(decoded.url,"https://cdn.aoneroom.com/full-audio")
  assert.equal(decoded.format,"M4A")
  const playback=await load("lib/music/service.ts").musicFile("https://audio-ssl.itunes.apple.com/AudioPreview/sample.m4a","Example Artist",false,true)
  assert.equal(playback.isPreview,false)
  assert.equal(playback.downloadUrl,undefined)
  assert.ok(playback.audioUrl.startsWith("/api/media?key="))
})

test("new media services are preferred, and fast success does not call the legacy fallback",async()=>{
  const {preferPrimary}=sandbox()("lib/providers/fallback.ts")
  let fallback=0
  assert.equal(await preferPrimary([async()=>"primary"],[async()=>{fallback++;return "old"}],5),"primary")
  await new Promise(resolve=>setTimeout(resolve,15))
  assert.equal(fallback,0)
  assert.equal(await preferPrimary([async()=>{throw new Error("down")}],[async()=>{fallback++;return "old"}],1000),"old")
  assert.equal(fallback,1)
})
test("a slow primary is hedged by a working legacy connection",async()=>{
  const {preferPrimary}=sandbox()("lib/providers/fallback.ts")
  assert.equal(await preferPrimary([()=>new Promise(()=>{})],[async()=>"fallback"],5),"fallback")
})
test("playlist links are validated and silent adaptive tracks are not complete videos",()=>{
  const youtube=sandbox()("lib/music/youtube.ts")
  assert.equal(youtube.youtubePlaylist("https://www.youtube.com/playlist?list=PLabcdefgh1234"),"https://www.youtube.com/playlist?list=PLabcdefgh1234")
  assert.equal(youtube.youtubePlaylist("https://youtube.com.evil.test/playlist?list=PLabcdefgh1234"),"")
  const data={data:{formats:[
    {type:"video_only",mimeType:"video/mp4",url:"https://cdn.aoneroom.com/silent"},
    {type:"audio",mimeType:"audio/mp4",url:"https://cdn.aoneroom.com/audio"},
    {type:"video_with_audio",mimeType:"video/mp4",url:"https://cdn.aoneroom.com/muxed"},
  ]}}
  assert.deepEqual(youtube.youtubeFiles(data,"video"),["https://cdn.aoneroom.com/muxed"])
  assert.deepEqual(youtube.youtubeFiles(data,"audio"),["https://cdn.aoneroom.com/audio"])
})
test("full-media resolver uses new Nayan endpoints before the old downloader",async()=>{
  const original=sandbox()("lib/providers/http.ts"),calls=[]
  const load=sandbox({[path.resolve("lib/providers/http.ts")]:{...original,providerJson:async url=>{
    calls.push(url)
    return {data:{title:"Full song",audio:"https://cdn.aoneroom.com/full"}}
  }}},async()=>new Response("audio",{headers:{"content-type":"audio/mpeg"}}))
  const result=await load("lib/music/youtube.ts").resolveYoutube("https://youtu.be/YQHsXMglC9A","audio")
  assert.equal(result.isPreview,false)
  assert.ok(calls.some(url=>url.includes("/ytdown?")))
  assert.ok(calls.some(url=>url.includes("/youtube?")))
  assert.ok(calls.every(url=>!url.includes("knightbotapi")))
})
test("media download falls back from a dead download URL and HEAD only probes one byte",async()=>{
  const calls=[]
  const load=sandbox({},async(url,options)=>{
    calls.push({url:String(url),range:options.headers.Range})
    if(String(url).includes("/dead"))return new Response("not found",{status:404})
    return new Response("v",{status:206,headers:{"content-type":"video/mp4","content-range":"bytes 0-0/1000"}})
  })
  const key=load("lib/library/tokens.ts").seal("media",{url:"https://cdn.aoneroom.com/dead",fallbacks:["https://cdn.aoneroom.com/file"],title:"Example",kind:"video"})
  const response=await load("app/api/media/route.ts").HEAD(new Request(`https://app.test/api/media?key=${key}&download=1`))
  assert.equal(response.status,206)
  assert.match(response.headers.get("content-disposition"),/attachment/)
  assert.equal(await response.text(),"")
  assert.equal(calls.length,2)
  assert.ok(calls.every(call=>call.range==="bytes=0-0"))
})
test("returned video quality is reported honestly instead of relabeling a lower resolution",async()=>{
  const original=sandbox()("lib/providers/http.ts")
  const load=sandbox({[path.resolve("lib/providers/http.ts")]:{...original,providerJson:async()=>({
    data:{title:"Example video",formats:[{type:"video_with_audio",mimeType:"video/mp4",quality:"360p",url:"https://cdn.aoneroom.com/muxed"}]},
  })}},async()=>new Response("video",{headers:{"content-type":"video/mp4"}}))
  const result=await load("lib/music/youtube.ts").resolveYoutube("https://youtu.be/YQHsXMglC9A","video","","1080p")
  assert.equal(result.quality,"360p")
  assert.equal(result.format,"MP4")
})

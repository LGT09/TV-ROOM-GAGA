const { chromium } = require("@playwright/test")
const assert = require("node:assert/strict")

;(async () => {
  const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] })
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
    await context.addInitScript(() => {
      HTMLMediaElement.prototype.play = function () {
        this.dispatchEvent(new Event("play"))
        return Promise.resolve()
      }
    })
    const page = await context.newPage()
    const errors = []
    page.on("pageerror", error => errors.push(error.message))

    await page.route("**/api/library?**", route => route.fulfill({ json: { success: true, items: [], page: 1, hasNext: false } }))
    await page.route("**/mock-song.mp3", route => route.fulfill({ status: 200, contentType: "audio/mpeg", body: Buffer.alloc(0) }))
    await page.route("**/api/music?**", route => {
      const action = new URL(route.request().url()).searchParams.get("action")
      return route.fulfill({ json: action === "get-audio"
        ? { success: true, audioUrl: "/mock-song.mp3", isPreview: false }
        : { results: [{ trackId: "song-1", trackName: "Example Song", artistName: "Example Artist", previewUrl: "https://www.youtube.com/watch?v=YQHsXMglC9A", videoId: "" }] } })
    })
    await page.route("**/api/youtube?**", route => route.fulfill({
      json: { success: true, items: [{ id: "YQHsXMglC9A", url: "https://www.youtube.com/watch?v=YQHsXMglC9A" }] },
    }))

    await page.goto(`https://${process.env.REPLIT_DEV_DOMAIN}/home`, { waitUntil: "domcontentloaded" })
    await page.getByRole("heading", { name: "Trending songs", exact: true }).waitFor()
    await page.getByRole("button", { name: "Watch music video for Example Song", exact: true }).first().click()
    const firstFrame = page.locator('iframe[title="Example Song music video"]')
    await firstFrame.waitFor()
    assert.equal(await firstFrame.getAttribute("src"), "https://www.youtube-nocookie.com/embed/YQHsXMglC9A?autoplay=1&rel=0")
    await page.getByRole("dialog").getByRole("button", { name: "Close" }).click()

    await page.getByRole("button", { name: "Play full song Example Song", exact: true }).click()
    await page.getByRole("button", { name: "Resume playback", exact: true }).waitFor()
    const videoButtons = page.getByRole("button", { name: "Watch music video for Example Song", exact: true })
    await videoButtons.last().click()
    await page.locator('iframe[title="Example Song music video"]').waitFor()
    assert.deepEqual(errors, [])
    console.log(JSON.stringify({ trendingVideoEmbed: true, nowPlayingVideoAction: true, errors }))
  } finally {
    await browser.close()
  }
})().catch(error => {
  console.error(error)
  process.exitCode = 1
})

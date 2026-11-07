const { chromium } = require("@playwright/test")
const assert = require("node:assert/strict")

;(async () => {
  const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] })
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const page = await context.newPage()
    const errors = []
    page.on("pageerror", error => errors.push(error.message))

    await page.goto(`https://${process.env.REPLIT_DEV_DOMAIN}/movies`, { waitUntil: "domcontentloaded" })
    await page.getByLabel("Search movies").fill("Avatar")
    const kamranCard = page.locator('a[href^="/mv/"][href*="resource="]').first()
    await kamranCard.waitFor({ timeout: 30000 })
    await kamranCard.click()
    await page.getByRole("heading", { name: "Download options", exact: true }).waitFor({ timeout: 40000 })

    const links = page.locator('a[href*="action=download-page"]')
    assert.ok(await links.count() > 0)
    assert.equal(await links.first().getAttribute("target"), "_blank")
    const text = await page.locator("body").innerText()
    assert.ok(!/sinhalasub\.lk|drkamran-apis|KAMRAN_/i.test(text))
    assert.deepEqual(errors, [])
    console.log(JSON.stringify({ searchFallbackCard: true, downloadPageOptions: await links.count(), providerDetailsHidden: true, errors }))
  } finally {
    await browser.close()
  }
})().catch(error => {
  console.error(error)
  process.exitCode = 1
})

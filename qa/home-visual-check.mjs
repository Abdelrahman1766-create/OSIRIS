import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const origin = 'http://127.0.0.1:5173/'
const runs = [
  { language: 'ru', width: 320, height: 850 },
  { language: 'ru', width: 375, height: 850 },
  { language: 'ru', width: 390, height: 850 },
  { language: 'ru', width: 430, height: 850 },
  { language: 'ru', width: 768, height: 900 },
  { language: 'ru', width: 1440, height: 900 },
  { language: 'ar', width: 390, height: 850 },
  { language: 'ar', width: 1440, height: 900 },
  { language: 'en', width: 1440, height: 900 },
]

for (const { language, width, height } of runs) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })
  await context.addInitScript((lang) => localStorage.setItem('royal-essence-language', lang), language)
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(origin, { waitUntil: 'domcontentloaded' })
  await page.locator('.home-hero-title').waitFor({ timeout: 15000 })
  await page.evaluate(() => document.fonts.ready)
  await page.locator('.home-hero-image').evaluate((image) => image.decode())
  await page.screenshot({ path: `qa/home-${language}-${width}-top.png` })
  if ((language === 'ru' && [320, 390, 1440].includes(width)) || (language === 'ar' && width === 390)) {
    for (const selector of ['.home-categories', '.home-finder', '.home-why', '.home-kazan', '.home-social', '.home-telegram']) {
      const section = page.locator(selector)
      await section.scrollIntoViewIfNeeded()
      await page.waitForTimeout(900)
      await section.screenshot({ path: `qa/home-${language}-${width}-${selector.slice(1)}.png` })
    }
  }
  const metrics = await page.evaluate(() => {
    const selectors = ['.site-header', '.home-hero-title', '.home-categories', '.home-category-grid', '.home-finder', '.home-why', '.home-kazan', '.home-social', '.home-telegram']
    return {
      viewport: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      direction: document.documentElement.dir,
      heroTitleWidth: document.querySelector('.home-hero-title')?.scrollWidth,
      sectionWidths: selectors.map((selector) => {
        const element = document.querySelector(selector)
        const rect = element?.getBoundingClientRect()
        return { selector, left: Math.round(rect?.left ?? 0), right: Math.round(rect?.right ?? 0), width: Math.round(rect?.width ?? 0) }
      }),
    }
  })
  process.stdout.write(JSON.stringify({ language, width, errors, ...metrics }) + '\n')
  await context.close()
}

await browser.close()

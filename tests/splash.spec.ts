import { expect, test } from '@playwright/test'

test.use({
  viewport: { width: 1024, height: 720 },
  launchOptions: {
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
  },
})

test('clicking the study runs the entry timeline and unloads the scene', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.splash-root')).toHaveClass(/is-ready/, { timeout: 10000 })
  await page.getByRole('button', { name: '画质：高' }).evaluate((button: HTMLButtonElement) => button.click())
  await expect(page.locator('.splash-root')).toHaveAttribute('data-quality', 'low')
  let target: { x: number; y: number } | undefined
  const candidates = [{ x: 512, y: 400 }, { x: 560, y: 400 }, { x: 464, y: 400 }, { x: 512, y: 448 }, { x: 560, y: 448 }, { x: 464, y: 448 }]
  for (const candidate of candidates) {
    await page.mouse.move(candidate.x, candidate.y)
    await page.waitForTimeout(50)
    if (await page.locator('.splash-ring').evaluate(element => element.classList.contains('is-on'))) {
      target = candidate
      break
    }
  }
  expect(target).toBeTruthy()
  await page.mouse.click(target!.x, target!.y)
  await expect(page.locator('.splash-root')).toHaveClass(/is-entering/)
  await expect(page.locator('.splash-root')).toHaveAttribute('data-timeline-ms', '4400')
  const started = Number(await page.locator('.splash-root').getAttribute('data-entered-at'))
  await expect(page.locator('.workspace')).toBeVisible({ timeout: 6000 })
  const elapsed = await page.evaluate(value => performance.now() - value, started)
  expect(elapsed).toBeGreaterThanOrEqual(4000)
  expect(elapsed).toBeLessThan(6300)
  await expect(page.locator('.splash-root')).toHaveCount(0)
  await expect(page.locator('canvas')).toHaveCount(0)
})

test('first desktop visit can skip and fully unloads WebGL', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.splash-root')).toBeVisible()
  const skip = page.getByRole('button', { name: '跳过动画' })
  await expect(skip).toBeVisible({ timeout: 4000 })
  await skip.evaluate((button: HTMLButtonElement) => button.click())
  await expect(page.locator('.workspace')).toBeVisible({ timeout: 5000 })
  await expect(page.locator('.splash-root')).toHaveCount(0)
  await expect(page.locator('canvas')).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('splash_seen'))).toBe('1')
})

test('a saved splash marker does not prevent the welcome scene from loading', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('splash_seen', '1'))
  await page.goto('/')
  await expect(page.locator('.splash-root')).toBeVisible()
})

test('refreshing the desktop page replays the welcome scene', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.splash-root')).toBeVisible()
  const skip = page.getByRole('button', { name: '跳过动画' })
  await expect(skip).toBeVisible({ timeout: 4000 })
  await skip.evaluate((button: HTMLButtonElement) => button.click())
  await expect(page.locator('.workspace')).toBeVisible()
  await page.reload()
  await expect(page.locator('.splash-root')).toBeVisible()
})

test('background music waits for interaction, fades for entry and keeps mute state', async ({ page }) => {
  const volumeLogs: number[] = []
  page.on('console', message => {
    if (message.type() !== 'log' || !message.text().startsWith('[bgm] volume =')) return
    volumeLogs.push(Number(message.text().split('=').at(-1)?.trim()))
  })
  await page.addInitScript(() => {
    const NativeAudio = window.Audio
    const records: HTMLAudioElement[] = []
    let playCalls = 0
    let pauseCalls = 0
    class TrackedAudio extends NativeAudio {
      constructor() {
        super()
        ;(this as any).__pauseCalls = 0
        records.push(this)
      }
      play() {
        playCalls += 1
        return Promise.resolve()
      }
      pause() {
        pauseCalls += 1
        ;(this as any).__pauseCalls += 1
        super.pause()
      }
    }
    Object.defineProperties(window, {
      Audio: { configurable: true, value: TrackedAudio },
      __splashAudioTest: {
        configurable: true,
        value: {
          records,
          get playCalls() { return playCalls },
          get pauseCalls() { return pauseCalls },
        },
      },
    })
  })
  await page.goto('/')
  await expect(page.locator('.splash-root')).toBeVisible()
  expect(await page.evaluate(() => (window as any).__splashAudioTest.playCalls)).toBe(0)

  await page.getByRole('button', { name: '画质：高' }).click()
  await expect.poll(() => page.evaluate(() => (window as any).__splashAudioTest.playCalls)).toBe(1)
  await expect.poll(() => page.evaluate(() => (window as any).__splashAudioTest.records.at(-1).volume)).toBeCloseTo(0.4, 1)

  const skip = page.getByRole('button', { name: '跳过动画' })
  await expect(skip).toBeVisible({ timeout: 4000 })
  await skip.click()
  await expect(page.locator('.workspace')).toBeVisible()
  await expect.poll(() => page.evaluate(() => (window as any).__splashAudioTest.records.at(-1).volume)).toBe(0)
  await expect.poll(() => page.evaluate(() => (window as any).__splashAudioTest.records.at(-1).paused)).toBeTruthy()
  expect(await page.evaluate(() => (window as any).__splashAudioTest.records.at(-1).__pauseCalls)).toBe(1)
  expect(await page.evaluate(() => (window as any).__splashAudioTest.records.at(-1).currentTime)).toBe(0)
  expect(await page.evaluate(() => (window as any).__splashAudioTest.records.at(-1).getAttribute('src'))).toBe('')
  expect(await page.evaluate(() => document.querySelector('audio'))).toBeNull()
  expect(volumeLogs.length).toBeGreaterThan(0)
  expect(volumeLogs.every(value => Number.isFinite(value) && value >= 0 && value <= 1)).toBeTruthy()
  expect(volumeLogs.at(-1)).toBe(0)

  await page.reload()
  const mute = page.getByRole('button', { name: '静音背景音乐' })
  await expect(mute).toBeVisible()
  await mute.click()
  expect(await page.evaluate(() => localStorage.getItem('splash_muted'))).toBe('1')
  await page.reload()
  await expect(page.getByRole('button', { name: '取消静音' })).toHaveText('🔇')
})

test('mobile viewports skip the splash without marking it seen', async ({ page }) => {
  const requests: string[] = []
  page.on('request', request => requests.push(request.url()))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.locator('.workspace')).toBeVisible()
  await expect(page.locator('.splash-root')).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('splash_seen'))).toBeNull()
  expect(requests.some(url => url.includes('/components/Splash/Splash3D') || url.includes('/components/Splash/scene'))).toBeFalsy()
  expect(requests.some(url => /three(?:\.module)?\.js/.test(url))).toBeFalsy()
})

test('missing WebGL falls back to the notes app', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null
      return original.call(this, type, ...args)
    }
  })
  await page.goto('/')
  await expect(page.locator('.workspace')).toBeVisible()
  await expect(page.locator('.splash-root')).toHaveCount(0)
})

test.describe('retina quality rendering', () => {
  test.use({ deviceScaleFactor: 2 })

  test('retina high quality switches to a pixel ratio cap of one', async ({ page }) => {
    await page.goto('/')
    const canvas = page.locator('.splash-stage canvas')
    await expect(canvas).toBeVisible()
    await expect(page.locator('.splash-root')).toHaveClass(/is-ready/, { timeout: 10000 })
    const highWidth = await canvas.evaluate((element: HTMLCanvasElement) => element.width)
    expect(highWidth).toBe(2048)
    await page.getByRole('button', { name: '画质：高' }).evaluate((button: HTMLButtonElement) => button.click())
    await expect(page.locator('.splash-root')).toHaveAttribute('data-quality', 'low')
    await expect.poll(() => canvas.evaluate((element: HTMLCanvasElement) => element.width)).toBe(1024)
  })
})

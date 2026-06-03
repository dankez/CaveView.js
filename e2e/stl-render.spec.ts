import { expect, test } from '@playwright/test';
import path from 'node:path';

type CanvasStats = {
  width: number;
  height: number;
  samples: number;
  nonDark: number;
  colorful: number;
  redDominant: number;
};

async function readCanvasStats(page: import('@playwright/test').Page): Promise<CanvasStats> {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error('Canvas not found');
    }

    const copy = document.createElement('canvas');
    copy.width = canvas.width;
    copy.height = canvas.height;

    const ctx = copy.getContext('2d');
    if (!ctx) {
      throw new Error('2D canvas context not available');
    }

    ctx.drawImage(canvas, 0, 0);
    const pixels = ctx.getImageData(0, 0, copy.width, copy.height).data;

    let nonDark = 0;
    let colorful = 0;
    let redDominant = 0;

    for (let i = 0; i < pixels.length; i += 16) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);

      if (r > 20 || g > 20 || b > 35) nonDark++;
      if (max - min > 24) colorful++;
      if (r > 55 && r > g * 1.25 && r > b * 1.25) redDominant++;
    }

    return {
      width: copy.width,
      height: copy.height,
      samples: pixels.length / 16,
      nonDark,
      colorful,
      redDominant,
    };
  });
}

async function toggleWallMode(page: import('@playwright/test').Page, label: RegExp): Promise<void> {
  const row = page.locator('.toggle-row').filter({ hasText: label }).first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  await row.locator('.switch').first().click();
}

async function clickStlViewMode(page: import('@playwright/test').Page, label: RegExp): Promise<CanvasStats> {
  const button = page.locator('button').filter({ hasText: label }).first();
  await expect(button).toBeVisible({ timeout: 30_000 });
  await button.click();
  await page.waitForTimeout(900);
  return readCanvasStats(page);
}

test.describe('STL cave wall rendering', () => {
  test('uses mesh wall controls and renders solid, custom color, height color, and render modes', async ({ page, isMobile }) => {
    test.skip(isMobile, 'STL wall controls are verified through the desktop sidebar.');

    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.route('https://ipapi.co/json/', route =>
      route.fulfill({ status: 200, body: JSON.stringify({ country_code: 'SK' }) }),
    );

    await page.goto('/');
    await page.setInputFiles(
      'input[type="file"][accept*=".stl"]',
      path.resolve(process.cwd(), 'test_model/scan.stl'),
    );

    await expect(page.locator('.viewer-shell').first()).toBeVisible({ timeout: 120_000 });
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 120_000 });
    await expect(page.getByText(/Zobraziť steny|Show walls/).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/VEĽKOSŤ BODOV|POINT SIZE/)).toHaveCount(0);
    await expect(page.getByText(/Plasticita stien|Wall relief/).first()).toBeVisible();
    await expect(page.getByText(/SELEKTÍVNE ZOBRAZENIE STL|STL SELECTIVE VIEW/).first()).toBeVisible();

    await page.waitForTimeout(3_000);
    const solidStats = await readCanvasStats(page);
    console.log('STL solid stats:', solidStats);
    expect(solidStats.nonDark).toBeGreaterThan(40);

    const floorStats = await clickStlViewMode(page, /Podlaha|Floor/);
    console.log('STL floor stats:', floorStats);
    expect(floorStats.nonDark).toBeGreaterThan(10);

    const ceilingStats = await clickStlViewMode(page, /Strop|Ceiling/);
    console.log('STL ceiling stats:', ceilingStats);
    expect(ceilingStats.nonDark).toBeGreaterThan(10);

    const sectionStats = await clickStlViewMode(page, /Rez|Cut/);
    console.log('STL section stats:', sectionStats);
    expect(sectionStats.nonDark).toBeGreaterThan(5);

    const allStats = await clickStlViewMode(page, /Všetko|All/);
    console.log('STL all stats:', allStats);
    expect(allStats.nonDark).toBeGreaterThan(40);

    const wallLabel = page.locator('.s-label').filter({ hasText: /Steny jaskyne|Cave Walls/ }).first();
    await expect(wallLabel).toBeVisible();
    const wallColorButton = wallLabel.locator('button[title]').first();
    await wallColorButton.click();
    const customColor = wallLabel.locator('input[type="color"]').first();
    await expect(customColor).toBeVisible();
    await customColor.evaluate((node) => {
      const input = node as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, '#ef4444');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await expect
      .poll(() => wallColorButton.evaluate(el => getComputedStyle(el).backgroundColor))
      .toBe('rgb(239, 68, 68)');
    await page.waitForTimeout(1_000);

    const customStats = await readCanvasStats(page);
    console.log('STL custom color stats:', customStats);
    expect(customStats.nonDark).toBeGreaterThan(40);

    await toggleWallMode(page, /Farebné podľa výšky|Color by height/);
    await page.waitForTimeout(1_500);
    const heightStats = await readCanvasStats(page);
    console.log('STL height color stats:', heightStats);
    expect(heightStats.nonDark).toBeGreaterThan(40);
    expect(heightStats.colorful).toBeGreaterThan(20);

    await toggleWallMode(page, /Farebné podľa výšky|Color by height/);
    await toggleWallMode(page, /Render model 3D|3D Render model/);
    await page.waitForTimeout(1_500);
    const renderStats = await readCanvasStats(page);
    console.log('STL textured render stats:', renderStats);
    expect(renderStats.nonDark).toBeGreaterThan(40);

    const criticalErrors = errors.filter(e =>
      !e.includes('THREE.WebGLRenderer') &&
      !e.includes('Context lost') &&
      !e.includes('Internal React error') &&
      !e.includes('ipapi.co') &&
      !e.includes('net::ERR_FAILED'),
    );
    expect(criticalErrors).toEqual([]);
  });
});

import { expect, test } from '@playwright/test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const packageJson = require('../package.json') as { version: string };

test.describe('Mobile welcome screen', () => {
  test('keeps upload and sample models visible without horizontal overflow', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Mobile welcome layout is verified on the mobile project.');

    await page.goto('/');

    await expect(page.locator('.welcome')).toBeVisible();
    await expect(page.getByRole('heading', { name: `LochViewer v${packageJson.version}` })).toBeVisible();
    await expect(page.locator('.welcome-version')).toContainText(`v${packageJson.version}`);
    await expect(page.locator('.dropzone')).toBeVisible();
    await expect(page.locator('.welcome-samples')).toBeVisible();

    for (const label of [/Simple/, /Scraps/, /LiDAR/, /TIFF/]) {
      await expect(page.getByRole('button', { name: label })).toBeVisible();
    }

    const metrics = await page.evaluate(() => {
      const welcome = document.querySelector('.welcome') as HTMLElement | null;
      const samples = document.querySelector('.welcome-samples') as HTMLElement | null;
      const sampleButtons = Array.from(document.querySelectorAll('.welcome-samples .btn-demo'));
      if (!welcome || !samples) throw new Error('Welcome samples not found');

      const samplesRect = samples.getBoundingClientRect();
      const buttons = sampleButtons.map((button) => {
        const rect = button.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
        };
      });

      return {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        documentScrollWidth: document.documentElement.scrollWidth,
        welcomeClientWidth: welcome.clientWidth,
        welcomeScrollWidth: welcome.scrollWidth,
        samplesTop: samplesRect.top,
        samplesBottom: samplesRect.bottom,
        buttons,
      };
    });

    expect(metrics.documentScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    expect(metrics.welcomeScrollWidth).toBeLessThanOrEqual(metrics.welcomeClientWidth + 1);
    expect(metrics.samplesTop).toBeGreaterThanOrEqual(0);
    expect(metrics.samplesBottom).toBeLessThanOrEqual(metrics.viewportHeight + 1);

    for (const button of metrics.buttons) {
      expect(button.left).toBeGreaterThanOrEqual(0);
      expect(button.right).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    }
  });
});

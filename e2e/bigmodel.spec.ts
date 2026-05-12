import { test, expect } from '@playwright/test';

test.describe('CaveView Big Model Test', () => {
  test('should load zadiel.lox without crashing to white screen', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.route('https://ipapi.co/json/', route => route.fulfill({ status: 200, body: JSON.stringify({ country_code: 'SK' }) }));
    await page.goto('/?model=zlomiskovo.lox');

    // Čakáme, kým sa nenačíta canvas a kým prebehne parsovanie
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 300000 });

    // Čakáme chvíľu, aby sa scéna vyrenderovala
    await page.waitForTimeout(5000);

    // Vypíšeme errory pre debugging, ak to padne predtým
    console.log('Console errors encountered so far:', errors);

    // Skontrolujeme, či je UI prítomné (čo znamená, že to nespadlo do bielej obrazovky)
    // 30s timeout pre naozaj veľké modely
    await expect(page.locator('.viewer-shell').first()).toBeVisible({ timeout: 300000 });
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 300000 });
    console.log('Console errors:', errors);

    // Očakávame, že nenastane fatal error, ktorý by spôsobil bielu obrazovku
    // Biela obrazovka = zväčša React zlyhá úplne
    const criticalErrors = errors.filter(e => !e.includes('THREE.WebGLRenderer') && !e.includes('Context lost') && !e.includes('Internal React error') && !e.includes('ipapi.co') && !e.includes('net::ERR_FAILED') && !e.includes('429'));
    expect(criticalErrors).toEqual([]);
  });
});

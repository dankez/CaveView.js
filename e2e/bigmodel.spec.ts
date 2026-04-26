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

    await page.goto('/');

    // Klikneme na tlačidlo veľkého modelu, ktoré má v texte 32MB nezávisle od jazyka
    const bigModelBtn = page.getByRole('button', { name: /32MB/i }).first();
    await bigModelBtn.click();

    // Čakáme, kým sa nenačíta canvas a kým prebehne parsovanie
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 60000 });

    // Čakáme chvíľu, aby sa scéna vyrenderovala
    await page.waitForTimeout(5000);

    // Vypíšeme errory pre debugging, ak to padne predtým
    console.log('Console errors encountered so far:', errors);

    // Skontrolujeme, či je UI prítomné (čo znamená, že to nespadlo do bielej obrazovky)
    // 30s timeout pre naozaj veľké modely
    await expect(page.locator('.topbar').first()).toBeVisible({ timeout: 30000 });
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 5000 });
    console.log('Console errors:', errors);

    // Očakávame, že nenastane fatal error, ktorý by spôsobil bielu obrazovku
    // Biela obrazovka = zväčša React zlyhá úplne
    const criticalErrors = errors.filter(e => !e.includes('THREE.WebGLRenderer') && !e.includes('Context lost') && !e.includes('Internal React error'));
    expect(criticalErrors).toEqual([]);
  });
});

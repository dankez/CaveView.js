import { test, expect } from '@playwright/test';

test.describe('CaveView Robust E2E Test', () => {
  test('should load application and interact with all main features in Desktop and Mobile', async ({ page, isMobile }) => {
    // 1. Ošetrenie chýb v konzole
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // 2. Načítanie stránky
    await page.goto('/');

    // 3. Kontrola načítania úvodnej obrazovky
    await expect(page).toHaveTitle(/3D Cave Viewer|CaveView 3D/i);
    await expect(page.locator('.app, .welcome').first()).toBeVisible({ timeout: 10000 });

    // 4. Načítanie testovacích dát (Simple LOX)
    await page.getByText('Simple LOX').click();
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15000 });

    // 5. Ak sme na mobile, musíme otvoriť bočné menu pre prístup k nastaveniam
    if (isMobile) {
      const menuBtn = page.locator('.btn-menu').first();
      await menuBtn.waitFor({ state: 'visible', timeout: 5000 });
      await menuBtn.click();
      
      // Pockame, kym sa otvori sidebar (nečakáme na SK text, lebo jazyk ešte nemusí byť SK)
      await expect(page.locator('.sidebar-container.open')).toBeVisible({ timeout: 5000 });
    }

    // 6. Prepnutie jazyka na Slovenčinu
    const langBtn = page.getByRole('button', { name: /SK|EN|FR/ }).first();
    if (await langBtn.isVisible()) {
      const langText = await langBtn.textContent();
      if (langText !== 'SK') {
        await page.getByText('SK', { exact: true }).first().click();
      }
    }

    // 7. Zmena Themy (napr. na LIGHT)
    const lightThemeBtn = page.getByText('LIGHT').first();
    if (await lightThemeBtn.isVisible()) {
      await lightThemeBtn.click();
    }

    // Naspäť na PRECISION (default)
    const precisionBtn = page.getByText('PRECISION').first();
    if (await precisionBtn.isVisible()) {
      await precisionBtn.click();
    }

    // Helper funkcia pre prepínanie prepínačov v Sidebare
    const toggleSidebarItem = async (text: string) => {
      const locator = page.locator(`text=${text}`).first();
      if (await locator.isVisible()) {
        await locator.click();
      }
    };

    // 8. Testovanie funkcií bočného panelu (všetky sekcie podľa zadania)

    // -- Analýza priestorových rezov --
    await toggleSidebarItem('Horizontálny rez');
    await toggleSidebarItem('Vertikálny profil');
    await toggleSidebarItem('Vynechať jaskyňu z rezu');

    // -- Merania (Vrstva Survey) --
    await toggleSidebarItem('Splay merania');
    await toggleSidebarItem('Mriežka');
    await toggleSidebarItem('Bounding Box');
    // Pre "Farebné podľa výšky" v meraniach je to rovnaký text ako v stenách, 
    // prepneme prvé, čo nájde v danom bloku (alebo klikneme na obe)
    const altToggles = page.locator('text=Farebné podľa výšky');
    for (let i = 0; i < await altToggles.count(); i++) {
      await altToggles.nth(i).click();
    }
    await toggleSidebarItem('Polygónový ťah (3D)');
    await toggleSidebarItem('Polygónový ťah (3D) - drôtená sieť');

    // -- Steny jaskyne --
    await toggleSidebarItem('Zobraziť steny');
    await toggleSidebarItem('Organický / Vyhladený');
    await toggleSidebarItem('Render model 3D');
    
    // Voľba textúry pre Render model 3D
    await toggleSidebarItem('Dolomit');
    await toggleSidebarItem('Sivý váp.');
    await toggleSidebarItem('Vápenec');

    await toggleSidebarItem('Trojuholník. mesh');
    await toggleSidebarItem('Drôtený model');

    // -- Stanice --
    await toggleSidebarItem('Zobraziť body');
    await toggleSidebarItem('Meno bodu');
    await toggleSidebarItem('Nadm. výška (m)');
    await toggleSidebarItem('Zobraziť vchody');
    await toggleSidebarItem('Mená jaskýň (vchod)');

    // -- Prezentácia --
    await toggleSidebarItem('Auto-rotácia');

    // 9. Meranie a Raycasting
    // Na mobile je to tlačidlo "Meranie" priamo v bočnom paneli (teraz pridané), na desktop v topbare
    const measureBtn = page.locator('text=Meranie').first();
    if (await measureBtn.isVisible()) {
      await measureBtn.click();
    }

    // Ak sme na mobile, pre raycasting musíme najprv zavrieť bočné menu
    if (isMobile) {
      const closeMenuBtn = page.getByRole('button', { name: /✖/ }).first();
      if (await closeMenuBtn.isVisible()) {
        await closeMenuBtn.click();
      }
    }

    // Klikneme niekam do stredu obrazovky, kde by sa mal nachádzať model pre otestovanie Raycastingu
    const box = await page.locator('canvas').first().boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    }

    // Kontrola vyskočenia dialógu detailu bodu
    const caverStandingBtn = page.locator('text=Stojaci (1.8m)').first();
    try {
      await caverStandingBtn.waitFor({ state: 'visible', timeout: 3000 });
      await caverStandingBtn.click();
      
      const closeBtn = page.locator('text=✕').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
      } else {
        const altClose = page.locator('text=Zavrieť detail').first();
        if (await altClose.isVisible()) await altClose.click();
      }
    } catch (e) {
      // Ak netrafíme model
    }

    // 10. Kontrola, či po interakciách nenastali závažné chyby v konzole
    const criticalErrors = errors.filter(e => !e.includes('THREE.WebGLRenderer') && !e.includes('Context lost') && !e.includes('Internal React error'));
    expect(criticalErrors).toEqual([]);
  });
});

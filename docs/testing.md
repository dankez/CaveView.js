# Testovanie v CaveView-modernized

Tento projekt používa moderný testovací stack na zabezpečenie stability a kvality kódu.

## 🧪 Typy testov

### 1. Unit Testy (Vitest)
Slúžia na testovanie čistej logiky, parserov a matematických transformácií. Sú veľmi rýchle.
- **Príkaz**: `npm run test`
- **Watch mód**: `npm run test:watch` (odporúčané počas vývoja - testy sa spustia po každej zmene súboru)
- **UI mód**: `npm run test:ui` (otvorí pekné grafické rozhranie v prehliadači)

### 2. End-to-End (E2E) Testy (Playwright)
Testujú aplikáciu ako celok v reálnom prehliadači (Chromium). Overujú, či sa scéna vykreslí a či funguje UI.
- **Príkaz**: `npm run test:e2e`

## 🚀 Automatizácia (Husky)
Nastavili sme **Husky**, ktorý automaticky spustí kontrolu pred každým commitom (`git commit`).
Ak testy alebo linting zlyhajú, commit nebude vytvorený, kým chybu neopravíte. To zaručuje, že do repozitára sa dostane len funkčný kód.

## 🛠 Ako pridať nový test
- **Unit testy**: Vytvorte súbor končiaci na `.test.ts` v priečinku `__tests__` pri príslušnom module.
- **E2E testy**: Pridajte nový `.spec.ts` súbor do priečinka `e2e/`.

## 📈 Pokrytie kódu
Ak chcete vidieť, ktoré časti kódu sú otestované, môžete použiť (po doinštalovaní coverage balíka):
- `npx vitest run --coverage`

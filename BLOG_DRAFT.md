# LochViewer: Keď jaskyne v prehliadači konečne nesekajú (ani po treťom pive) 🏔️🔦

Čaute bando! Všetci vieme, že kresliť jaskyne je drina, ale ukazovať ich ľuďom tak, aby si z toho nesedli na zadok len kvôli "modrej smrti" na obrazovke, je ešte väčšia výzva. Pôvodný CaveView bol fajn, ale ruku na srdce – občas mrzol častejšie ako pivo v bivaku v zime. 

Rozhodol som sa mu teda dať poriadny facelift a pod kapotu mu namontoval poriadne turbo s pomocou AI (môj nový kamoš, čo nikdy nespí). Výsledok sa volá **LochViewer (LV)** a tu je prehľad toho, prečo by ste ho mali začať používať hneď po tom, čo vyjdete z diery.

[Sem vložte screenshot: Celkový pohľad na 3D model jaskyne, kde všetko svieti a hýbe sa plynulo]

## Prečo sme to prekopali? (Okrem toho, že ma to baví)

Starý CaveView vznikol v dobe, kedy sme boli radi, že máme aspoň nejaké `.lox` súbory. Dnes tu máme mračná bodov z LIDAR-u a digitálne modely terénu, ktoré majú toľko polygónov, že priemerný notebook pri ich načítaní začal simulovať štart raketoplánu. 

Nová verzia je postavená na moderných technológiách, ktoré rozumejú pamäti lepšie ako my mapovacím denníkom. Výsledok? Modely, ktoré predtým prehliadač odpísali do minúty, teraz behajú plynulo aj na mobile.

## Čo je nové a prečo je to "pecka"?

### 🏔️ 1. Vrstevnice, ktoré vám konečne niečo povedia
Doteraz boli vrstevnice len také čiary "aby sa nepovedalo". V novom release sme im dali rozum:
*   **Čísla všade, kde ich treba**: Pri hlavných vrstevniciach konečne uvidíte nadmorskú výšku. Algoritmus je taký šikovný, že vám tam vždy aspoň 1-3 čísla hodí do zorného poľa, aby ste nemuseli pátrať, či ste v 400-vke alebo 500-vke.
*   **Vykuknú nad terén**: Čísla a čiary sú technicky "nad" mapou, takže žiadne "duchárske" prekrývanie s textúrou sa nekoná.
*   **Dynamický zoom**: Čísla sa menia podľa toho, ako ďaleko ste. Keď ste blízko, sú veľké a čitateľné, keď odletíte k oblakom, nezmiznú, ale zmenšia sa tak akurát, aby ste mali prehľad.

### 🗺️ 2. Mapy a povrchy s profesionálnou presnosťou
Už žiadne od oka "natiahnuté" satelitky. Ak máte v súbore fotomapu, LochViewer ju na terén napasuje s matematickou presnosťou na metre. 
*   **Nová kalibrácia**: Ak textúra nesedí úplne presne, môžete ju v sidebare posúvať po pol metroch šípkami, kým neklikne na miesto.
*   **Podpora Therionu**: LV teraz rozumie aj externým `.txt` kalibračným súborom. Stačí nahrať fotku z drona a k nej Therion kalibráciu a mapa sa sama "prilepí" na GPS súradnice.
*   **Oprava neviditeľných textúr**: Prekopali sme grafický motor (shader), takže textúry sú teraz ostrejšie a zobrazujú sa spoľahlivo aj pri obrovských modeloch. 
Terén si môžete prepínať medzi tieňovaným modelom, "drôtenou" sieťou alebo fotomapou jedným klikom v sidebare.

### 📐 3. Merania (pre tých, čo chcú mať všetko pod kontrolou)
Chcete vedieť, koľko metrov nad hlavou máte ten prekliaty kopec? Stačí kliknúť.
*   **Hĺbka pod povrchom**: Jedno kliknutie v jaskyni a LV vám povie: "Kámo, nad tebou je 45 metrov vápenca."
*   **GPS pre každého**: Kliknite na ľubovoľný bod a hneď máte WGS84 súradnice. Ideálne, keď hľadáte vchod v lese a máte len mobil.
*   **Pravítko v 3D**: Meranie medzi bodmi je teraz také intuitívne, že by to zvládol aj netopier.

### 🎥 4. Filmové štúdio priamo v prehliadači
Chcete ukázať model na schôdzi klubu? Zapnite si auto-rotáciu, nastavte rýchlosť a rovno v appke stlačte **Nahrať**. Vypluje vám to WebM video, ktoré môžete hodiť na sociálne siete alebo do prezentácie. Žiadne externé nahrávače obrazovky už netreba!

### 📱 5. Mobilná verzia (pre jaskynných nomádov)
Celý LochViewer je responzívny. Na mobile sa menu skryje pod hamburger, aby ste mali celú plochu na model. Ovládanie prstami je vyladené tak, aby ste jaskyňou mohli točiť aj so zablatenými rukami (ale radšej si ich utrite do gatí).

### 🔗 6. Zdieľanie ako u profíkov (Embed)
Toto je moja najobľúbenejšia fičúra. Chcete dať model na klubovú stránku? 
1. Nastavte si v sidebare presne to, čo chcete ukázať (uhol pohľadu, farby, rezy).
2. Kliknite na **Share**.
3. LV vám vygeneruje link, ktorý si všetko pamätá. Keď ho kamoš otvorí, uvidí **presne to isté**, čo vy. Žiadne vysvetľovanie "stlač tamten gombík a pohni posuvníkom".
4. Máme tam aj generátor **iframe kódu** pre weby. Stačí skopírovať a vložiť. Čisté, elegantné, bez zbytočných panelov (ak ich nechcete).

[Sem vložte screenshot: Ukážka nového Share dialógu – vyzerá to fakt svetovo!]

## Farebné legendy a "vizuálne žrádlo"
Pridali sme aj prehľadné farebné legendy, takže hneď vidíte, ktorá farba v jaskyni znamená akú hĺbku. Celý dizajn sme "vypucovali" do tmavej témy so sklenenými efektmi (`glassmorphism`), aby to vyzeralo ako z roku 2026 a nie 1996.

## Živá ukážka na záver (Vyskúšaj si to!)

Skúste si zatočiť s modelom Zádielskej tiesňavy nižšie. Funguje to aj na mobile!

```html
<iframe src="https://loch.sss.sk/?model=https://vasadomena.sk/zadiel.lox&embed=true&theme=precision&terrain=texture&clip=1&cliph=450" width="100%" height="600" style="border:0;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.3);" allowfullscreen loading="lazy" title="LochViewer Zádiel"></iframe>
```

---
*LochViewer je open-source a robím na ňom vo voľnom čase (a občas aj v práci, pšššt). Ak máte nápady na vylepšenia, píšte, volajte alebo ma nájdite niekde v podzemí!*

**Jaskyniarčeniu zdar!** 🔦🏔️

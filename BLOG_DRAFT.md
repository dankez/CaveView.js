# LochViewer: Modernizácia webového prehliadača jaskýň

Objavovanie a mapovanie jaskýň vyžaduje spracovanie veľkého množstva priestorových dát. Prezentácia týchto dát odbornej aj laickej verejnosti je dôležitou súčasťou našej práce. Pôvodný program CaveView dlho slúžil ako šikovný nástroj na zobrazovanie 3D modelov, no rozhodol som sa ho s pomocou AI prepísať a zmodernizovať pod novým názvom **LochViewer**, aby lepšie vyhovoval dnešným požiadavkám.

[Sem vložte screenshot: Celkový pohľad na 3D model jaskyne s terénom a textúrou]

## Prečo bola potrebná modernizácia?

Pôvodný CaveView vznikol na vizualizáciu dát z bežných jaskyniarskych programov ako Therion (súbory `.lox`), Survex (`.3d`) či Compass (`.plt`). V súčasnosti sa však čoraz viac využívajú podrobné a veľmi veľké digitálne modely terénu a presné zamerania (napríklad LIDAR). 

Tieto nové modely obsahujú obrovské množstvo bodov a polygónov. Staršia verzia aplikácie mala pri takomto objeme dát problémy – prehliadač spotreboval priveľa operačnej pamäte (RAM), čo často viedlo k sekaniu, spomaleniu celého počítača, alebo k úplnému zamrznutiu aplikácie.

Z tohto dôvodu som sa rozhodol pôvodný kód aplikácie zásadne upraviť. Zobral som pôvodnú myšlienku programu a aplikáciu som vo vnútri prepísal do moderných technológií, čo prinieslo lepšiu stabilitu a vyšší výkon.

## Zmeny "pod kapotou" (Technické vylepšenia laicky)

Aby aplikácia zvládla detailné modely plynulo, použil som súčasné technológie na tvorbu webových aplikácií (React a knižnicu Three.js, ktorá slúži na 3D grafiku priamo v prehliadači). 

V praxi to prinieslo dve hlavné výhody:
*   **Lepšia správa pamäte:** Dáta sa v programe ukladajú oveľa úspornejšie (prechodom na prísnejšie formáty dát v pamäti). Vďaka tomu dokáže prehliadač načítať modely, ktoré by ho predtým zahltili.
*   **Inteligentné zjednodušovanie:** Ak do programu nahráte extrémne veľký a náročný model, systém automaticky dočasne vypne niektoré "okrasné" vizuálne vylepšenia (napríklad plynulé zaguľatenie stien jaskyne). Zabezpečí sa tak, že modelom sa bude dať aj naďalej plynulo otáčať a preliadať si ho.

[Sem vložte screenshot: Ukážka používateľského rozhrania – bočný panel s nastaveniami]

## Čo pribudlo z používateľského pohľadu?

### 1. Práca s povrchom a satelitnými mapami
Pri modeloch jaskýň je kľúčové vidieť aj topografiu povrchu. Aplikácia po novom dokáže na digitálny model terénu automaticky "natiahnuť" textúru (napríklad satelitnú snímku), pokiaľ je uložená priamo v zdrojovom súbore. Výpočty súradníc som upravil tak, aby mapa na povrch matematicky sedela na metre presne. Ak váš súbor textúru neobsahuje, pridal som možnosť manuálne si ju do nahraného modelu priložiť ako bežný obrázok (JPG/PNG). 

Terén sa dá v bočnom paneli pohodlne prepínať medzi plným tieňovaným zobrazením, "drôtenou" sieťou, alebo zobrazením so satelitnou mapou bez toho, aby sa tieto vrstvy vizuálne prekrývali a robili vizuálne chyby.

[Sem vložte screenshot: Detailný pohľad na povrchový terén s aplikovanou satelitnou textúrou]

### 2. Tvorba rezov (Clipping) v jaskyni aj v teréne
Jedným z najužitočnejších nástrojov pri skúmaní jaskýň v 3D priestore je tvorba rezov. Často potrebujete "odrezať" kus kopca, aby ste videli, ako hlboko pod povrchom sa chodba nachádza, alebo si jaskyňu rozrezať na výškové poschodia a pozrieť sa dnu zhora. 

Pridal som preto funkciu horizontálneho rezu terénu aj profilového (zvislého) rezu. Pomocou posuvníka si presne určíte, v akej nadmorskej výške (alebo na akej osi) sa má model zrezať a nahliadnuť pod povrch.

### 3. Presné merania vzdialeností a hĺbky
Pri prezeraní 3D modelu nestačí len vizuálny odhad. Do aplikácie som zapracoval analytický nástroj na meranie. Jednoduchým klikaním priamo v 3D priestore si môžete:
* Zmerať priamu vzdialenosť medzi akýmikolvek dvoma bodmi v jaskyni.
* Vypočítať presnú hĺbku konkrétneho bodu v jaskyni voči povrchu priamo nad ním (dozviete sa tak hrúbku nadložia).
* Zistiť presné GPS súradnice (WGS84) pre akýkoľvek geodetický bod priamo z modelu.

Tento nástroj robí z obyčajného 3D prehliadača skutočnú pracovnú a analytickú pomôcku.

### 4. Možnosť nahrávania videa
Pre potreby prednášok alebo prezentácií je výhodné mať k dispozícii video záznam preletu jaskyňou. Do aplikácie som integroval nástroj na záznam obrazovky. Model sa môže začať sám plynulo otáčať a vy si pomocou jedného tlačidla nahráte video priamo do počítača. Záznam prebieha na pozadí, takže nijako neobmedzuje plynulosť prezerania.

### 5. Plná podpora pre mobilné zariadenia
Jaskyniari sú často v teréne, kde majú k dispozícii len smartfón alebo tablet. LochViewer som preto navrhol tak, aby bol plne responzívny. Ovládanie 3D modelu je optimalizované pre dotykové obrazovky (otáčanie, približovanie prstami). Celé menu sa na mobile skryje do prehľadného "hamburger" menu, aby ste mali na displeji čo najviac miesta pre samotnú jaskyňu. Vďaka optimalizácii výkonu navyše aplikácia beží plynulo aj na bežných mobilných telefónoch bez sekania.

### 6. Informácie o načítavaní a prehľadné menu
Keď nahrávate naozaj veľký súbor, aplikácia vám teraz ukazuje presný priebeh (ako postupuje načítavanie bodov, generovanie stien, či počítanie terénu). Prostredie som tiež preložil do viacerých jazykov a vizuálne ho upratal, aby bolo menu intuitívnejšie.

## Zdieľanie a vloženie modelu do webstránky (Embed)

Najzásadnejšou novinkou z pohľadu bežného využitia je kompletne prerobený systém zdieľania modelov. Doteraz ste mohli niekomu poslať len odkaz na model, no on si ho musel sám v paneli správne nastaviť, aby videl to, čo ste chceli.

Dnes tento nástroj funguje podobne ako vkladanie máp od Google:
*   **Zachovanie nastavení:** Všetko, čo si v programe na bočnom paneli nastavíte (farba jaskyne, typ terénu, aktuálna výška rezu, viditeľnosť zameriavacích bodov), sa automaticky zakóduje priamo do URL adresy (odkazu). Keď tento odkaz niekomu pošlete, otvorí sa mu model presne v takom stave, v akom ste mu ho pripravili.
*   **Vloženie do vlastného webu (Iframe):** Vytvoril som jednoduchý generátor (tlačidlo Share). Tam si naklikáte požadované rozmery okna a program vám vygeneruje krátky HTML kód. Ten stačí skopírovať a vložiť na váš blog alebo stránku jaskyniarskeho klubu. Priamo v programe si dokonca môžete overiť, či je verejná adresa súboru funkčná a prístupná.
*   **Čistý vzhľad:** Model vložený do vašej stránky nemá rušivé bočné panely. Vyzerá veľmi čisto a slúži iba na prezeranie. Ak však uznáte za vhodné, pri generovaní kódu môžete zaškrtnúť možnosť, aby si návštevníci vášho webu mohli bočný panel rozbaliť a model si sami ďalej upravovať.

[Sem vložte screenshot: Ukážka okna na zdieľanie s generátorom kódu]

## Živá ukážka na záver

Aby ste mali jasnú predstavu, ako vyzerá model vložený priamo do článku, vyskúšajte si interaktívnu ukážku nižšie. S modelom môžete bežne manipulovať myšou alebo prstom na obrazovke smartfónu:

<!-- 
TOTO JE MIESTO, KDE V REDAKČNOM SYSTÉME VLOŽÍTE IFRAME KÓD.
(Nezabudnite skopírovať a použiť vlastný kód z aplikácie)
-->

```html
<iframe src="https://loch.sss.sk/?model=https://vasadomena.sk/zadiel.lox&embed=true&theme=precision&terrain=texture&clip=1&cliph=450" width="100%" height="600" style="border:0;border-radius:8px;box-shadow:0 4px 15px rgba(0,0,0,0.1);" allowfullscreen loading="lazy" title="LochViewer Zádiel"></iframe>
```

---
*Aplikácia je voľne dostupná ako open-source na GitHube, kde ju priebežne ďalej vylepšujem pre potreby našej jaskyniarskej komunity.*

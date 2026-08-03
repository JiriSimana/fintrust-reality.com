# FinTrust Reality — web (prototyp)

Vícestránkový web pro nový realitní tým **FinTrust Reality** (Plzeň & Praha),
navazující na skupinu FinTrust (fintg.cz).

- **Vizuální styl:** tmavě zelená + zlatá mosaz + krémová (dle loga a grafik).
- **Technologie:** čistý HTML/CSS/JS, **GSAP + ScrollTrigger** (reveal animace, počítadla),
  **Lenis** (plynulý scroll), vlastní kurzor a magnetická tlačítka. Bez build-stepu, knihovny z CDN.
- Hero je klidný, tematický (foto interiéru) — původní 3D animované pozadí bylo odstraněno.

## Spuštění lokálního náhledu

Ve složce `site/`:

```bash
python3 -m http.server 8080
```

Otevřete **http://localhost:8080**.

> Náhled je potřeba spustit přes server (kvůli načítání dat nabídky přes `fetch`).
> Otevření `index.html` přes `file://` nefunguje.

## Stránky

| Stránka | Soubor |
|---|---|
| Domů | `index.html` |
| Nemovitosti (nabídka + filtry) | `nemovitosti.html` |
| Detail nemovitosti | `nemovitost.html?id=FTR-1024` |
| Služby | `sluzby.html` |
| Chci prodat / ocenění | `prodej.html` |
| Správa & pronájem | `sprava-nemovitosti.html` |
| O nás | `o-nas.html` |
| Kariéra (nábor makléřů) | `kariera.html` |
| Kontakt | `kontakt.html` |

Hlavička a patička jsou na jednom místě v `js/components.js` (vkládají se do každé stránky).

## Nabídka nemovitostí — napojení na realitní systém

Nabídka se v náhledu načítá z `data/nemovitosti.json` (`js/listings.js` ji vykresluje na
domovské stránce, na stránce Nemovitosti i v detailu).

**V ostrém provozu** se tento zdroj nahradí importem z realitního systému
**realitni-system.com (Poski REAL)** přes **XML feed / API**
(`export.poskireal.cz/api/export/klient/`). Stačí:

1. Získat URL exportu (XML) nebo přístup k API z realitního systému.
2. Naparsovat feed do stejné struktury jako `data/nemovitosti.json`
   (buď serverovým skriptem/CRON do JSON, nebo přímo v `js/listings.js`).
3. Ceny, fotky, popisy a parametry se propíšou automaticky.

Struktura položky (pole odpovídají typickému realitnímu exportu):
`id, typ, nabidka, nazev, dispozice, plocha, cena, cenaText, mesto, lokalita, kraj,
stav, penb, popis, parametry{}, fotky[]`.

## Co doplnit před ostrým spuštěním
- Reálné fotky nemovitostí (teď zlaté line-art placeholdery) — přijdou z feedu / makléřů.
- Profily a fotky makléřů (sekce O nás → Tým).
- Telefony, adresy kanceláří (Plzeň / Praha), e-maily.
- Napojení kontaktních formulářů na e-mail / CRM.
- Napojení XML/API z realitni-system.com (viz výše).
- Doména.

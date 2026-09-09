# Napojení nabídky na Poski REAL OpenAPI v2

Web bere nabídku nemovitostí z **Poski REAL OpenAPI v2** (JSON přes HTTP).
Klíč k API se **nikdy nedává do frontendu** — volání jde přes serverless
proxy na Vercelu, která klíč drží na serveru a odpověď mapuje na formát,
který web renderuje.

```
prohlížeč → /api/nemovitosti (Vercel funkce, drží klíč) → Poski REAL API v2
                                   │
                                   └─ když není nastaveno / API selže → data/nemovitosti.json (fallback)
```

Soubory:
- `api/nemovitosti.js` — proxy + mapování polí (jediné místo k ladění)
- `js/listings.js` — frontend; volá `/api/nemovitosti`, fallback `data/nemovitosti.json`
- `data/nemovitosti.json` — ukázková data / záloha

## Krok 1 — objednat API u Poski REAL
Napojení Poski REAL API v2 je placené (zaváděcí cena **350 Kč/měsíc**).
Od Poski si vyžádej: **základ URL (base) API v2**, **API klíč** a
**dokumentaci** (přesné cesty, způsob autentizace a názvy polí v odpovědi).

## Krok 2 — vyplnit Environment Variables na Vercelu
Vercel → Project `fintrust-reality` → **Settings → Environment Variables**
(prostředí Production i Preview), pak **Redeploy**:

| Proměnná | Povinné | Popis |
|---|---|---|
| `POSKI_API_BASE` | ano | základ URL API v2, např. `https://<ucet>.poskireal.cz/api/v2` |
| `POSKI_API_KEY` | ano | přístupový klíč / token |
| `POSKI_AUTH` | ne | `bearer` (výchozí) \| `header` \| `query` |
| `POSKI_AUTH_NAME` | ne | název hlavičky/parametru pro klíč u `header`/`query` (např. `X-Api-Key`, `apikey`) |
| `POSKI_LIST_PATH` | ne | cesta k výpisu nabídek, výchozí `/offers` |

Bez těchto proměnných web běží dál na ukázkových datech (nic nespadne).

## Krok 3 — potvrdit názvy polí
Proxy mapuje odpověď API na interní model v `api/nemovitosti.js`
(funkce `mapOffer`). Ta zkouší běžné názvy polí (`title`/`name`/`nazev`,
`price`/`cena`, `city`/`mesto`, `usableArea`/`area`/`plocha`, …). **Podle
reálné odpovědi API** (viz dokumentace nebo jedno testovací volání) doplň
správné názvy — je to jediné místo, kde se to ladí. Interní model, který
web očekává:

```
id, typ (byt|dum|pozemek|komercni), nabidka (prodej|pronajem),
nazev, dispozice, plocha (m²), cena (číslo), cenaText,
mesto, lokalita, kraj (praha|plzen|…), stav, penb, popis,
parametry {klíč:hodnota}, fotky [url,…], art (apartment|house|land), featured
```

Fotky: jakmile API vrátí URL fotek do pole `fotky`, web je automaticky
zobrazí na kartách i v detailu (jinak drží úspornou line-art grafiku).

## Krok 4 — filtry podle krajů (volitelné)
Filtry na `nemovitosti.html` mají dnes `Praha` a `Plzeň`. Pokud budou
nabídky i z jiných krajů, přidej odpovídající „chip" (`data-value` = slug
z `regionSlug()`, např. `stredocesky`).

## Ověření po nasazení
```bash
curl -s https://www.fintrust-reality.cz/api/nemovitosti | head -c 400
```
`"configured": true` a `"source": "poski-real-api-v2"` = jede ostré API.
`"source": "mock …"` = ještě běží fallback (chybí ENV nebo API vrátilo chybu — v poli `error` je důvod).

> Staré XML metody Poski (XML, XML‑FTP, XML‑RPC) končí **koncem roku 2027** —
> proto rovnou OpenAPI v2.

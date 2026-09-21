# Napojení nabídky na Poski REAL OpenAPI v2

Nabídka nemovitostí jde z **Poski REAL OpenAPI v2** (JSON/HTTP) přes serverless
proxy na Vercelu. Bearer klíč se drží **jen v Environment Variables** (server-side),
nikdy ne ve frontend kódu / v repu.

```
prohlížeč → /api/nemovitosti (Vercel funkce, drží klíč) → GET /api/v2/listings/?filter[status][eq]=active
                                   └─ když klíč chybí / API selže → data/nemovitosti.json (fallback)
```

- `api/nemovitosti.js` — proxy: stránkuje výpis, mapuje pole na interní model, vrací `{items}`
- `js/listings.js` — frontend: volá `/api/nemovitosti`, fallback na `data/nemovitosti.json`; filtry krajů/typů se staví z dat; fotky z `publicUrl`
- `data/nemovitosti.json` — ukázková data / záloha

Endpoint i mapování jsou **ověřené proti živému API** (účet okrealestate, 141 aktivních nabídek).

## Nastavení klíče na Vercelu (dělá klient — klíč nepatří do repa)
Vercel → Project `fintrust-reality` → **Settings → Environment Variables** → **Add**:

| Proměnná | Hodnota | Prostředí |
|---|---|---|
| `POSKI_API_KEY` | Bearer klíč `prat_…` od Poski REAL | Production + Preview |

Volitelně (mají rozumné defaulty, měnit jen v případě potřeby):
- `POSKI_API_BASE` — default `https://okrealestate.poskireal.cz/api/v2`
- `POSKI_STATUS` — default `active` (možné: incomplete, active, activeUnderContract, pending, closed, withdrawn)

Po přidání proměnné → **Redeploy** (nebo počkat na další deploy).

## Jak otestovat

**1) Že klíč a endpoint fungují (přímo API):**
```bash
curl -s -H "Authorization: Bearer <KLÍČ>" \
  "https://okrealestate.poskireal.cz/api/v2/listings/?filter[status][eq]=active&perPage=1" \
  | head -c 300
```
Očekávej `{"items":[…],"pagination":{…,"total":141,…}}`.

**2) Že proxy na webu vrací ostrá data (po nastavení ENV + redeploy):**
```bash
curl -s "https://www.fintrust-reality.cz/api/nemovitosti" | head -c 200
```
- `"source":"poski-real-api-v2","configured":true,"count":141` → jede ostré API ✅
- `"source":"mock (POSKI_API_KEY not set)"` → ještě chybí ENV (nebo nebyl redeploy)
- `"source":"mock (API error fallback)","error":"…"` → API vrátilo chybu (důvod v `error`)

**3) Vizuálně:** otevři `https://www.fintrust-reality.cz/nemovitosti` — reálné nabídky,
filtr „Lokalita" a „Typ" se samy poskládají z dat. Detail: klik na kartu.

## Poznámky
- **Fotky:** jakmile budou u nabídek nahrané a `isPublishedOnWeb`, zobrazí se z `publicUrl`
  automaticky (na kartách i v detailu); do té doby úsporná line-art grafika.
- **Rozsah nabídek:** proxy vrací všechny `active` nabídky účtu (aktuálně celá ČR + Rakousko).
  Když je chceš omezit jen na některé kraje, řekni — přidá se filtr na straně proxy.
- **Lokální náhled** (`python3 -m http.server`) serverless funkci nespustí → načte se
  fallback `data/nemovitosti.json`. Pro test proxy lokálně použij `vercel dev` s `.env`
  (soubor `.env` je v `.gitignore`, do repa se nedostane).
- Staré XML metody Poski (XML, XML‑FTP, XML‑RPC) končí **koncem roku 2027** → proto OpenAPI v2.

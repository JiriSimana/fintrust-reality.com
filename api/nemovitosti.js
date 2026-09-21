/* =========================================================
   FinTrust Reality — /api/nemovitosti  (Vercel serverless)
   Proxy pro Poski REAL OpenAPI v2 (JSON přes HTTP).
   Endpoint: GET {base}/listings/?filter[status][eq]=active
             (Bearer auth, stránkování page/perPage, vrací {items,pagination})

   PROČ proxy a ne přímé volání z prohlížeče:
     • API vyžaduje Bearer klíč — ten NESMÍ být ve frontend kódu.
       Drží se v Environment Variables na Vercelu (šifrované, server-side).
     • Vyhne se CORS (voláme ze serveru).

   ====== CO NASTAVIT NA VERCELU (Settings → Environment Variables) ======
     POSKI_API_KEY   – (POVINNÉ) Bearer klíč k API v2, tvar prat_…
     POSKI_API_BASE  – (volitelné) základ URL; default níže
     POSKI_STATUS    – (volitelné) stav nabídek; default "active"
       (možné: incomplete | active | activeUnderContract | pending | closed | withdrawn)

   Bez POSKI_API_KEY (nebo při chybě API) vrací ukázková data
   z data/nemovitosti.json — web tedy funguje vždy.
   Návod a testy: NAPOJENI-POSKI-API.md
   ========================================================= */
"use strict";

var MOCK = require("../data/nemovitosti.json");

var DEFAULT_BASE = "https://okrealestate.poskireal.cz/api/v2";
var PER_PAGE = 100;   // stránka dotazu na API
var MAX_ITEMS = 300;  // pojistka proti obřím payloadům

/* ---------- pomocné ---------- */
function num(v) {
  if (typeof v === "number") return isFinite(v) ? v : 0;
  var n = parseFloat(String(v == null ? "" : v).replace(/\s/g, "").replace(/[^\d.,-]/g, "").replace(",", "."));
  return isFinite(n) ? n : 0;
}
function czk(n) {
  try { return new Intl.NumberFormat("cs-CZ").format(Math.round(n)); }
  catch (e) { return String(Math.round(n)); }
}
// lokalizovaný text { cs: "…" } → string
function loc(v) {
  if (v == null) return "";
  if (typeof v === "object") return String(v.cs || v.en || v.value || v.label || "");
  return String(v);
}
// enum { value, label } → label
function enumLabel(v) {
  if (v == null) return "";
  if (typeof v === "object") return String(v.label != null ? v.label : (v.value != null ? v.value : ""));
  return String(v);
}
// money { value, currency } → number
function money(v) { return v && typeof v === "object" ? num(v.value) : num(v); }

function mapTyp(pt) {
  var s = String((pt && pt.label) || "").toLowerCase();
  if (/pozem/.test(s)) return "pozemek";
  if (/domy|d[uů]m|chalup|vila|chat|usedlost/.test(s)) return "dum";
  if (/byty|byt/.test(s)) return "byt";
  if (/komer/.test(s)) return "komercni";
  return "komercni"; // Ostatní/Garáž apod. → nejbližší kbelík ve filtru
}
function artFor(typ) { return typ === "dum" ? "house" : typ === "pozemek" ? "land" : "apartment"; }

function regionSlug(raw) {
  var s = String(raw == null ? "" : raw).toLowerCase();
  if (/praha|prague/.test(s)) return "praha";
  if (/plze/.test(s)) return "plzen";
  var slug = s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/kraj/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug || "jine";
}

function photosOf(it) {
  var arr = it.photos || [];
  if (!Array.isArray(arr)) return [];
  return arr
    .filter(function (ph) { return ph && ph.isPublishedOnWeb !== false && (ph.publicUrl || ph.publicThumbnailUrl); })
    .sort(function (a, b) {
      return (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0) || (a.sortOrder || 0) - (b.sortOrder || 0);
    })
    .map(function (ph) { return ph.publicUrl || ph.publicThumbnailUrl; });
}

function paramsOf(it, typ, disp) {
  var P = {};
  function add(k, v) {
    if (v == null || v === "") return;
    if (typeof v === "number" && v === 0) return;
    P[k] = String(v);
  }
  if (disp && typ !== "pozemek") add("Dispozice", disp);
  if (num(it.livingArea)) add("Užitná plocha", num(it.livingArea) + " m²");
  if (num(it.lotSizeArea)) add("Plocha pozemku", num(it.lotSizeArea) + " m²");
  if (num(it.gardenArea)) add("Zahrada", num(it.gardenArea) + " m²");
  if (it.roomsTotal) add("Počet místností", it.roomsTotal);
  if (it.floorNumber != null && it.floorNumber !== 0) add("Podlaží", it.floorNumber);
  if (it.hasElevator) add("Výtah", "Ano");
  if (it.garageSpaces) add("Garáž", it.garageSpaces + "×");
  if (num(it.balconyArea)) add("Balkon", num(it.balconyArea) + " m²");
  if (num(it.terraceArea)) add("Terasa", num(it.terraceArea) + " m²");
  if (num(it.loggiaArea)) add("Lodžie", num(it.loggiaArea) + " m²");
  if (it.constructionYear) add("Rok stavby", it.constructionYear);
  add("Vlastnictví", enumLabel(it.propertyOwnership));
  add("Konstrukce", enumLabel(it.constructionMaterial));
  return P;
}

/* ---------- mapování jedné nabídky na interní model ---------- */
function mapOffer(it) {
  if (!it || typeof it !== "object") return null;
  var typ = mapTyp(it.propertyType);

  // dispozice: unitLayout.label, jinak z labelu typu ("Byty - 3 + kk" → "3+kk")
  var disp = enumLabel(it.unitLayout);
  if (!disp && typ === "byt") {
    var parts = String((it.propertyType && it.propertyType.label) || "").split(" - ");
    if (parts[1]) disp = parts[1];
  }
  if (disp) disp = disp.replace(/\s*\+\s*/g, "+").trim();
  if (!disp && typ === "pozemek") disp = "pozemek";

  var agr = (it.listingAgreement && it.listingAgreement.label) || "";
  var nabidka = (it.leaseAmountFrequency || /pron[aá]j|n[aá]jem/i.test(agr)) ? "pronajem" : "prodej";

  var plocha = num(it.livingArea) || num(it.floorArea) || num(it.totalArea) || num(it.lotSizeArea) || num(it.gardenArea) || 0;

  var cena = money(it.listPrice);
  var cur = (it.listPrice && it.listPrice.currency) || "CZK";
  var jednotka = cur === "CZK" ? "Kč" : cur;
  var cenaText = cena > 0 ? (czk(cena) + " " + jednotka + (nabidka === "pronajem" ? "/měs" : "")) : "Cena na vyžádání";

  var a = it.address || {};
  var mesto = a.city || "";
  var cast = a.cityPart || a.district || "";
  if (cast && cast === mesto) cast = ""; // nedupluj "Roztoky — Roztoky"
  var lokalita = [mesto, cast].filter(Boolean).join(" — ") || a.unparsedAddress || mesto || "Česká republika";

  var nazev = loc(it.publicHeadline);
  if (!nazev) nazev = (enumLabel(it.propertyType) || "Nemovitost") + (lokalita ? " — " + lokalita : "");

  var fotky = photosOf(it);

  return {
    id: String(it.externalId || it.id || ""),
    typ: typ,
    nabidka: nabidka,
    nazev: nazev,
    dispozice: disp || "",
    plocha: plocha,
    cena: cena,
    cenaText: cenaText,
    mesto: mesto,
    lokalita: lokalita,
    kraj: regionSlug(a.region || mesto),
    krajLabel: String(a.region || mesto || ""),
    stav: enumLabel(it.propertyCondition),
    penb: enumLabel(it.energyPerformanceRating),
    popis: loc(it.publicRemarks),
    parametry: paramsOf(it, typ, disp),
    fotky: fotky,
    art: artFor(typ),
    featured: false
  };
}

/* ---------- volání Poski REAL API v2 (se stránkováním) ---------- */
async function fetchAllListings(base, key, status) {
  var out = [];
  var page = 1;
  var headers = { "Accept": "application/json", "Authorization": "Bearer " + key };
  while (out.length < MAX_ITEMS) {
    var url = base.replace(/\/+$/, "") + "/listings/?filter%5Bstatus%5D%5Beq%5D=" +
      encodeURIComponent(status) + "&page=" + page + "&perPage=" + PER_PAGE;
    var ctrl = new AbortController();
    var t = setTimeout(function () { ctrl.abort(); }, 12000);
    var r;
    try { r = await fetch(url, { headers: headers, signal: ctrl.signal }); }
    finally { clearTimeout(t); }
    if (!r.ok) throw new Error("Poski API HTTP " + r.status + " (page " + page + ")");
    var j = await r.json();
    var items = (j && j.items) || [];
    out = out.concat(items);
    var pg = j && j.pagination;
    if (!pg || !pg.hasNextPage) break;
    page++;
  }
  return out;
}

/* ---------- handler ---------- */
module.exports = async function (req, res) {
  var base = process.env.POSKI_API_BASE || DEFAULT_BASE;
  var key = process.env.POSKI_API_KEY;
  var status = process.env.POSKI_STATUS || "active";

  // odolnost vůči časté chybě: v ENV omylem zůstane "Bearer …" nebo mezera/nový řádek
  if (key) key = key.trim().replace(/^Bearer\s+/i, "").trim();

  if (!key) {
    res.setHeader("Cache-Control", "s-maxage=60");
    res.status(200).json(Object.assign({}, MOCK, {
      source: "mock (POSKI_API_KEY not set)",
      configured: false
    }));
    return;
  }

  try {
    var raw = await fetchAllListings(base, key, status);
    var items = raw.map(mapOffer).filter(function (x) { return x && x.id; });
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    res.status(200).json({
      source: "poski-real-api-v2",
      updated: new Date().toISOString().slice(0, 10),
      configured: true,
      count: items.length,
      items: items
    });
  } catch (e) {
    res.setHeader("Cache-Control", "s-maxage=30");
    res.status(200).json(Object.assign({}, MOCK, {
      source: "mock (API error fallback)",
      configured: false,
      error: String((e && e.message) || e)
    }));
  }
};

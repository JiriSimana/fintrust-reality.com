/* =========================================================
   FinTrust Reality — /api/nemovitosti  (Vercel serverless)
   Proxy pro Poski REAL OpenAPI v2 (JSON přes HTTP).

   Dva režimy:
     • /api/nemovitosti          → výpis všech active nabídek;
                                    každá má HLAVNÍ fotku (malý payload)
     • /api/nemovitosti?id=<id>  → jeden inzerát se VŠEMI fotkami
                                    (pro galerii v detailu)

   Fotky se z API musí vyžádat parametrem fields=photos (jinak je
   výpis neobsahuje). Obrázky samotné jsou za autorizací → vracíme
   je jako URL na náš proxy /api/foto (klíč zůstává na serveru).

   PROČ proxy: API klíč nesmí do prohlížeče → drží se v ENV
   (POSKI_API_KEY) na Vercelu. Bez klíče / při chybě → ukázková data.

   ENV: POSKI_API_KEY (povinné), POSKI_API_BASE, POSKI_STATUS (volitelné).
   Návod + testy: NAPOJENI-POSKI-API.md
   ========================================================= */
"use strict";

var MOCK = require("../data/nemovitosti.json");

var DEFAULT_BASE = "https://okrealestate.poskireal.cz/api/v2";
var PER_PAGE = 100;
var MAX_ITEMS = 300;
var CARD_SIZE = "medium"; // fotka na kartě

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
function loc(v) {
  if (v == null) return "";
  if (typeof v === "object") return String(v.cs || v.en || v.value || v.label || "");
  return String(v);
}
function enumLabel(v) {
  if (v == null) return "";
  if (typeof v === "object") return String(v.label != null ? v.label : (v.value != null ? v.value : ""));
  return String(v);
}
function money(v) { return v && typeof v === "object" ? num(v.value) : num(v); }

function mapTyp(pt) {
  var s = String((pt && pt.label) || "").toLowerCase();
  if (/pozem/.test(s)) return "pozemek";
  if (/domy|d[uů]m|chalup|vila|chat|usedlost/.test(s)) return "dum";
  if (/byty|byt/.test(s)) return "byt";
  if (/komer/.test(s)) return "komercni";
  return "komercni";
}
function artFor(typ) { return typ === "dum" ? "house" : typ === "pozemek" ? "land" : "apartment"; }

function regionSlug(raw) {
  var s = String(raw == null ? "" : raw).toLowerCase();
  if (/praha|prague/.test(s)) return "praha";
  if (/plze/.test(s)) return "plzen";
  var slug = s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/kraj/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug || "jine";
}

function fotoUrl(listingId, photoId, size) {
  return "/api/foto?l=" + encodeURIComponent(listingId) + "&p=" + encodeURIComponent(photoId) + "&s=" + size;
}
// publikované fotky, seřazené (hlavní první)
function publishedPhotos(it) {
  var arr = it.photos || [];
  if (!Array.isArray(arr)) return [];
  return arr
    .filter(function (ph) { return ph && ph.id != null && ph.isPublishedOnWeb !== false; })
    .sort(function (a, b) {
      return (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0) || (a.sortOrder || 0) - (b.sortOrder || 0);
    });
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

/* ---------- mapování jedné nabídky na interní model ----------
   full=false → jen hlavní fotka (foto) + počet (fotoCount)  [výpis]
   full=true  → celá galerie (fotky[{t,f}]) + foto + fotoCount [detail] */
function mapOffer(it, full) {
  if (!it || typeof it !== "object") return null;
  var lid = it.id; // číselné ID inzerátu (pro cesty k fotkám)
  var typ = mapTyp(it.propertyType);

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
  if (cast && cast === mesto) cast = "";
  var lokalita = [mesto, cast].filter(Boolean).join(" — ") || a.unparsedAddress || mesto || "Česká republika";

  var nazev = loc(it.publicHeadline);
  if (!nazev) nazev = (enumLabel(it.propertyType) || "Nemovitost") + (lokalita ? " — " + lokalita : "");

  var photos = publishedPhotos(it);
  var foto = photos.length ? fotoUrl(lid, photos[0].id, CARD_SIZE) : "";
  var out = {
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
    foto: foto,
    fotoCount: photos.length,
    art: artFor(typ),
    featured: false
  };
  if (full) {
    out.fotky = photos.map(function (ph) {
      return { t: fotoUrl(lid, ph.id, "thumbnail"), f: fotoUrl(lid, ph.id, "full") };
    });
  }
  return out;
}

/* ---------- volání Poski REAL API v2 ---------- */
function authHeaders(key) { return { "Accept": "application/json", "Authorization": "Bearer " + key }; }

async function fetchJSON(url, key) {
  var ctrl = new AbortController();
  var t = setTimeout(function () { ctrl.abort(); }, 12000);
  var r;
  try { r = await fetch(url, { headers: authHeaders(key), signal: ctrl.signal }); }
  finally { clearTimeout(t); }
  if (!r.ok) throw new Error("Poski API HTTP " + r.status);
  return r.json();
}

async function fetchAllListings(base, key, status) {
  var out = [];
  var page = 1;
  while (out.length < MAX_ITEMS) {
    var url = base.replace(/\/+$/, "") + "/listings/?filter%5Bstatus%5D%5Beq%5D=" +
      encodeURIComponent(status) + "&fields=photos&page=" + page + "&perPage=" + PER_PAGE;
    var j = await fetchJSON(url, key);
    var items = (j && j.items) || [];
    out = out.concat(items);
    var pg = j && j.pagination;
    if (!pg || !pg.hasNextPage) break;
    page++;
  }
  return out;
}

async function fetchOne(base, key, id) {
  var b = base.replace(/\/+$/, "");
  var path = /^[0-9]+$/.test(id)
    ? "/listings/" + encodeURIComponent(id) + "?fields=photos"
    : "/listings/by-external-id/" + encodeURIComponent(id) + "?fields=photos";
  return fetchJSON(b + path, key);
}

/* ---------- handler ---------- */
module.exports = async function (req, res) {
  var base = process.env.POSKI_API_BASE || DEFAULT_BASE;
  var key = process.env.POSKI_API_KEY;
  var status = process.env.POSKI_STATUS || "active";
  if (key) key = key.trim().replace(/^Bearer\s+/i, "").trim();

  var id = req.query && req.query.id ? String(req.query.id) : "";

  if (!key) {
    res.setHeader("Cache-Control", "s-maxage=60");
    var m = Object.assign({}, MOCK, { source: "mock (POSKI_API_KEY not set)", configured: false });
    if (id) m.items = (MOCK.items || []).filter(function (x) { return String(x.id) === id; });
    res.status(200).json(m);
    return;
  }

  try {
    if (id) {
      var one = await fetchOne(base, key, id);
      var item = mapOffer(one && one.id ? one : (one && one.items && one.items[0]), true);
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
      res.status(200).json({ source: "poski-real-api-v2", configured: true, items: item ? [item] : [] });
      return;
    }
    var raw = await fetchAllListings(base, key, status);
    var items = raw.map(function (it) { return mapOffer(it, false); }).filter(function (x) { return x && x.id; });
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
    var mm = Object.assign({}, MOCK, { source: "mock (API error fallback)", configured: false, error: String((e && e.message) || e) });
    if (id) mm.items = (MOCK.items || []).filter(function (x) { return String(x.id) === id; });
    res.status(200).json(mm);
  }
};

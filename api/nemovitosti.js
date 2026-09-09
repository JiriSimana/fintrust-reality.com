/* =========================================================
   FinTrust Reality — /api/nemovitosti  (Vercel serverless)
   Proxy pro Poski REAL OpenAPI v2 (JSON přes HTTP).

   PROČ proxy a ne přímé volání z prohlížeče:
     • API vyžaduje autentizaci (API klíč) — ten NESMÍ být ve
       frontend kódu. Drží se v Environment Variables na Vercelu.
     • Vyhne se CORS omezením (voláme ze serveru, ne z prohlížeče).

   Co dělá:
     1) načte nabídky z Poski REAL API v2,
     2) namapuje je na interní model, který renderuje js/listings.js,
     3) vrátí { source, updated, configured, count, items:[…] } jako JSON.

   Dokud nejsou vyplněné ENV proměnné (nebo když API selže), vrací
   ukázková data z data/nemovitosti.json — web tedy funguje vždy.

   ====== CO DOPLNIT PRO OSTRÝ PROVOZ ======
   Vercel → Project → Settings → Environment Variables:
     POSKI_API_BASE   – základ URL API v2 z dokumentace Poski REAL,
                        např. https://<vas-ucet>.poskireal.cz/api/v2
     POSKI_API_KEY    – přístupový klíč / token
     POSKI_AUTH       – (volitelné) "bearer" (výchozí) | "header" | "query"
     POSKI_AUTH_NAME  – (volitelné) název hlavičky/parametru pro klíč,
                        když POSKI_AUTH="header"/"query"
                        (např. "X-Api-Key" nebo "apikey")
     POSKI_LIST_PATH  – (volitelné) cesta k výpisu nabídek, výchozí "/offers"

   Přesné cesty, autentizaci a NÁZVY POLÍ potvrď podle dokumentace
   Poski REAL API v2. Jediná dvě místa, kde se to ladí, jsou funkce
   fetchOffers() (endpoint + auth) a mapOffer() (názvy polí).
   ========================================================= */
"use strict";

var MOCK = require("../data/nemovitosti.json");

/* ---------- pomocné ---------- */
function pick(o) {
  for (var i = 1; i < arguments.length; i++) {
    var k = arguments[i];
    if (o && o[k] != null && o[k] !== "") return o[k];
  }
  return undefined;
}
function num(v) {
  var n = parseFloat(String(v == null ? "" : v).replace(/\s/g, "").replace(/[^\d.,-]/g, "").replace(",", "."));
  return isFinite(n) ? n : 0;
}
function czk(n) {
  try { return new Intl.NumberFormat("cs-CZ").format(Math.round(n)); }
  catch (e) { return String(Math.round(n)); }
}
function mapTyp(raw) {
  var s = String(raw == null ? "" : raw).toLowerCase();
  if (/pozem|land|plot|parcel/.test(s)) return "pozemek";
  if (/d[uů]m|rodinn|house|vila|chat|chalup|usedlost/.test(s)) return "dum";
  if (/komer|commerc|office|kancel|sklad|business|nebytov/.test(s)) return "komercni";
  return "byt"; // výchozí
}
function artFor(typ) { return typ === "dum" ? "house" : typ === "pozemek" ? "land" : "apartment"; }
function mapNabidka(raw) {
  var s = String(raw == null ? "" : raw).toLowerCase();
  if (/pron|rent|n[aá]jem|lease/.test(s)) return "pronajem";
  return "prodej";
}
function regionSlug(raw) {
  var s = String(raw == null ? "" : raw).toLowerCase();
  if (/praha|prague/.test(s)) return "praha";
  if (/plze/.test(s)) return "plzen";
  // ostatní kraje → zjednodušený slug (filtry na nemovitosti.html případně rozšiř)
  var slug = s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug || "jine";
}
function mapPhotos(o) {
  var arr = pick(o, "photos", "images", "fotky", "media", "pictures") || [];
  if (!Array.isArray(arr)) return [];
  return arr.map(function (ph) {
    if (typeof ph === "string") return ph;
    return pick(ph, "url", "src", "href", "link", "large", "medium", "original");
  }).filter(Boolean);
}
function mapParams(o) {
  var p = pick(o, "parameters", "parametry", "attributes", "params");
  if (p && typeof p === "object" && !Array.isArray(p)) return p;
  // pole { name/label, value } → objekt
  if (Array.isArray(p)) {
    var out = {};
    p.forEach(function (it) {
      var k = pick(it, "name", "label", "key", "nazev");
      var v = pick(it, "value", "hodnota", "val");
      if (k != null && v != null) out[String(k)] = String(v);
    });
    return out;
  }
  return {};
}

/* ---------- mapování jedné nabídky na interní model ---------- */
function mapOffer(o) {
  if (!o || typeof o !== "object") return null;
  var typ = mapTyp(pick(o, "category", "type", "propertyType", "typ", "druh", "kind"));
  var nabidka = mapNabidka(pick(o, "transaction", "dealType", "contractType", "offerType", "nabidka"));
  var cena = num(pick(o, "price", "priceValue", "cena", "cenaValue", "amount"));
  var mesto = String(pick(o, "city", "town", "mesto") || "");
  var cast = String(pick(o, "district", "cityPart", "locality", "cast", "quarter") || "");
  var lokalita = [mesto, cast].filter(Boolean).join(" — ") || String(pick(o, "address", "adresa") || mesto);
  return {
    id: String(pick(o, "externalId", "external_id", "id", "code", "kod", "referenceNumber", "zakazka") || ""),
    typ: typ,
    nabidka: nabidka,
    nazev: String(pick(o, "title", "name", "nazev", "heading") || "Nemovitost"),
    dispozice: String(pick(o, "layout", "disposition", "dispozice", "rooms") || (typ === "pozemek" ? "pozemek" : "")),
    plocha: num(pick(o, "usableArea", "area", "floorArea", "landArea", "plocha", "vymera")),
    cena: cena,
    cenaText: cena > 0 ? (czk(cena) + " Kč" + (nabidka === "pronajem" ? "/měs" : "")) : "Cena na vyžádání",
    mesto: mesto,
    lokalita: lokalita,
    kraj: regionSlug(pick(o, "region", "kraj", "county") || mesto),
    stav: String(pick(o, "condition", "state", "stav") || ""),
    penb: String(pick(o, "energyClass", "energyRating", "penb", "peneb") || ""),
    popis: String(pick(o, "description", "descriptionCs", "text", "popis") || ""),
    parametry: mapParams(o),
    fotky: mapPhotos(o),
    art: artFor(typ),
    featured: !!(pick(o, "featured", "top", "exclusive", "highlighted", "zvyraznene"))
  };
}

/* ---------- volání Poski REAL API v2 ---------- */
async function fetchOffers(base, key) {
  var authMode = (process.env.POSKI_AUTH || "bearer").toLowerCase();
  var authName = process.env.POSKI_AUTH_NAME || (authMode === "query" ? "apikey" : "X-Api-Key");
  var listPath = process.env.POSKI_LIST_PATH || "/offers";
  var url = base.replace(/\/+$/, "") + "/" + listPath.replace(/^\/+/, "");

  var headers = { "Accept": "application/json" };
  if (authMode === "bearer") headers["Authorization"] = "Bearer " + key;
  else if (authMode === "header") headers[authName] = key;
  else if (authMode === "query") url += (url.indexOf("?") > -1 ? "&" : "?") + encodeURIComponent(authName) + "=" + encodeURIComponent(key);

  var ctrl = new AbortController();
  var t = setTimeout(function () { ctrl.abort(); }, 10000);
  var r;
  try {
    r = await fetch(url, { headers: headers, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
  if (!r.ok) throw new Error("Poski API HTTP " + r.status);
  var j = await r.json();
  // výpis může být pole, nebo obalený v data/items/offers/results/records
  var list = Array.isArray(j) ? j : (j.items || j.data || j.offers || j.results || j.records || []);
  return Array.isArray(list) ? list : [];
}

/* ---------- handler ---------- */
module.exports = async function (req, res) {
  var base = process.env.POSKI_API_BASE;
  var key = process.env.POSKI_API_KEY;

  // API zatím nenastaveno → ukázková data, ať web funguje
  if (!base || !key) {
    res.setHeader("Cache-Control", "s-maxage=60");
    res.status(200).json(Object.assign({}, MOCK, {
      source: "mock (API not configured)",
      configured: false
    }));
    return;
  }

  try {
    var raw = await fetchOffers(base, key);
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
    // fail-safe → ukázková data, web nikdy nespadne
    res.setHeader("Cache-Control", "s-maxage=30");
    res.status(200).json(Object.assign({}, MOCK, {
      source: "mock (API error fallback)",
      configured: false,
      error: String((e && e.message) || e)
    }));
  }
};

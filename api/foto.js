/* =========================================================
   FinTrust Reality — /api/foto  (Vercel serverless)
   Proxy obrázků z Poski REAL API v2. Fotky jsou za autorizací
   (401 bez klíče), takže je prohlížeč nemůže načíst přímo —
   tato funkce je stáhne s Bearer klíčem (drženým na serveru)
   a odešle je do <img>. Výsledek se dlouho cachuje na CDN.

   Použití:  /api/foto?l=<listingId>&p=<photoId>&s=thumbnail|medium|full
   ========================================================= */
"use strict";

var DEFAULT_BASE = "https://okrealestate.poskireal.cz/api/v2";
var SIZES = { thumbnail: 1, medium: 1, full: 1 };

module.exports = async function (req, res) {
  var base = process.env.POSKI_API_BASE || DEFAULT_BASE;
  var key = process.env.POSKI_API_KEY;
  if (key) key = key.trim().replace(/^Bearer\s+/i, "").trim();

  var q = req.query || {};
  var l = String(q.l || "").replace(/[^0-9]/g, "");
  var p = String(q.p || "").replace(/[^0-9]/g, "");
  var s = String(q.s || "medium");
  if (!SIZES[s]) s = "medium";

  if (!key || !l || !p) { res.status(400).end(); return; }

  try {
    var url = base.replace(/\/+$/, "") + "/listings/" + l + "/photos/" + p + "/" + s;
    var ctrl = new AbortController();
    var t = setTimeout(function () { ctrl.abort(); }, 12000);
    var r;
    try { r = await fetch(url, { headers: { Authorization: "Bearer " + key }, signal: ctrl.signal }); }
    finally { clearTimeout(t); }

    if (!r.ok) { res.status(r.status === 401 ? 502 : r.status).end(); return; }

    var ct = r.headers.get("content-type") || "image/jpeg";
    var buf = Buffer.from(await r.arrayBuffer());
    res.setHeader("Content-Type", ct);
    // dlouhá cache — obrázky se nemění; CDN i prohlížeč si je podrží
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=2592000, immutable");
    res.status(200).send(buf);
  } catch (e) {
    res.status(502).end();
  }
};

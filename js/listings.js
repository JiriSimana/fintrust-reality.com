/* =========================================================
   FinTrust Reality — property listings
   Zdroj dat: nejprve /api/nemovitosti (serverless proxy pro
   Poski REAL OpenAPI v2 — viz api/nemovitosti.js), a když
   není dostupné (lokální náhled), spadne zpět na ukázkový
   soubor data/nemovitosti.json. Obě varianty vrací stejný
   tvar { items:[…] }, takže renderování je společné:
     • featured karty na úvodu           (#featuredGrid)
     • plná filtrovaná mřížka             (#feedGrid)
     • detail jedné nemovitosti           (#detailRoot)
   ========================================================= */
(function () {
  "use strict";

  var API_URL = "/api/nemovitosti";        // ostrý zdroj (Poski REAL API v2 přes proxy)
  var MOCK_URL = "data/nemovitosti.json";  // fallback (lokální náhled / API nedostupné)

  // ---- line-art per property type (used until real photos arrive) ----
  var ART = {
    apartment: '<svg class="prop__art" viewBox="0 0 400 260" aria-hidden="true"><g stroke="currentColor" fill="none" stroke-width="1.5"><path d="M70 210h260M110 210V70h180v140M110 100h180M110 135h180M110 170h180M155 70v140M200 70v140M245 70v140"/></g></svg>',
    house: '<svg class="prop__art" viewBox="0 0 400 260" aria-hidden="true"><g stroke="currentColor" fill="none" stroke-width="1.5"><path d="M50 205h300M110 205V110l90-55 90 55v95M150 205v-55h40v55M215 150h45v55h-45M228 165h20M228 182h20M110 120l90-52 90 52"/></g></svg>',
    land: '<svg class="prop__art" viewBox="0 0 400 260" aria-hidden="true"><g stroke="currentColor" fill="none" stroke-width="1.5"><path d="M40 210h320M90 210l40-60 60 30 70-70 60 40 30-20M120 120v-14M120 106l16 6"/><path d="M70 175h20v20H70zM100 185h16v10h-16z" opacity=".7"/></g></svg>'
  };

  var TYP_LABEL = { byt: "Byt", dum: "Dům", pozemek: "Pozemek", komercni: "Komerční" };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function badge(p) {
    if (String(p.cenaText).toLowerCase().indexOf("vyžádání") > -1 || p.stav === "novostavba" && p.parametry && p.parametry["Dostupné"] === "Připravujeme")
      return '<span class="prop__badge prop__badge--soon">Připravujeme</span>';
    return p.nabidka === "pronajem"
      ? '<span class="prop__badge prop__badge--rent">Pronájem</span>'
      : '<span class="prop__badge">Prodej</span>';
  }

  function specLine(p) {
    var bits = [p.plocha + " m²"];
    if (p.dispozice && p.dispozice !== "pozemek") bits.push(p.dispozice);
    if (p.stav) bits.push(p.stav);
    return bits.join(" · ");
  }

  function card(p) {
    return '' +
      '<article class="prop reveal-card" data-city="' + esc(p.kraj) + '" data-typ="' + esc(p.typ) +
        '" data-nabidka="' + esc(p.nabidka) + '" data-cursor data-cursor-label="Detail">' +
        '<a class="prop__hit" href="nemovitost.html?id=' + encodeURIComponent(p.id) + '" aria-label="' + esc(p.nazev) + '">' +
          '<div class="prop__media ' + (p.foto ? "prop__media--photo" : "prop__media--gen") + '">' +
            badge(p) +
            countBadge(p) +
            '<span class="prop__city">' + esc(p.lokalita) + "</span>" +
            cardMedia(p) +
          "</div>" +
          '<div class="prop__info">' +
            '<h3 class="prop__title">' + esc(p.nazev) + "</h3>" +
            '<p class="prop__spec">' + esc(specLine(p)) + "</p>" +
            '<div class="prop__foot">' +
              '<span class="prop__price">' + esc(p.cenaText) + "</span>" +
              '<span class="prop__link">Detail →</span>' +
            "</div>" +
          "</div>" +
        "</a>" +
      "</article>";
  }

  function enhance(node) {
    if (window.FTR && typeof window.FTR.enhance === "function") window.FTR.enhance(node);
  }

  function fetchJSON(url) {
    return fetch(url, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }
  function load() {
    // ostrý zdroj přes proxy; když selže (404 na lokálu, výpadek), použij mock
    return fetchJSON(API_URL).catch(function () { return fetchJSON(MOCK_URL); });
  }

  // hlavní fotka karty (z API přes /api/foto), jinak generativní line-art
  function cardMedia(p) {
    if (p.foto) {
      return '<img class="prop__photo" src="' + esc(p.foto) + '" alt="' + esc(p.nazev) +
        '" loading="lazy" decoding="async" />';
    }
    return ART[p.art] || ART.apartment;
  }
  function countBadge(p) {
    return p.fotoCount > 1
      ? '<span class="prop__count" aria-label="' + p.fotoCount + ' fotografií">' +
          '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path fill="currentColor" d="M9 3 7.2 5H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3.2L15 3H9Zm3 14a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9Z"/></svg>' +
          p.fotoCount + "</span>"
      : "";
  }

  // ---------- homepage: featured ----------
  function renderFeatured(feed) {
    var grid = document.getElementById("featuredGrid");
    if (!grid) return;
    var items = feed.items.filter(function (p) { return p.featured; });
    if (!items.length) items = feed.items; // API featured nedodává → vezmi první nabídky
    items = items.slice(0, 3);
    grid.innerHTML = items.map(card).join("");
    enhance(grid);
  }

  // rebuild a filter group's chips from actual data (so kraj/typ always match feed)
  var KRAJ_LABEL = { praha: "Praha", plzen: "Plzeň" };
  var TYP_ORDER = ["byt", "dum", "pozemek", "komercni"];
  function prettyKraj(p) {
    return p.krajLabel || KRAJ_LABEL[p.kraj] || (p.kraj ? p.kraj.charAt(0).toUpperCase() + p.kraj.slice(1) : "");
  }
  function rebuildGroup(key, pairs) {
    var group = document.querySelector('[data-filtergroup="' + key + '"]');
    if (!group) return;
    var b = group.querySelector("b");
    var chips = '<button class="chip is-active" data-value="all">Vše</button>' +
      pairs.map(function (p) {
        return '<button class="chip" data-value="' + esc(p.value) + '">' + esc(p.label) + "</button>";
      }).join("");
    group.innerHTML = (b ? b.outerHTML : "") + chips;
  }
  function buildFilters(feed) {
    // kraje — jen ty, co jsou v datech
    var seenK = {}, kraje = [];
    feed.items.forEach(function (p) {
      if (p.kraj && !seenK[p.kraj]) { seenK[p.kraj] = 1; kraje.push({ value: p.kraj, label: prettyKraj(p) }); }
    });
    kraje.sort(function (a, b) { return a.label.localeCompare(b.label, "cs"); });
    if (kraje.length > 1) rebuildGroup("kraj", kraje);
    // typy — ve fixním pořadí, jen přítomné v datech
    var TYP_PLURAL = { byt: "Byty", dum: "Domy", pozemek: "Pozemky", komercni: "Komerční" };
    var seenT = {};
    feed.items.forEach(function (p) { if (p.typ) seenT[p.typ] = 1; });
    var typy = TYP_ORDER.filter(function (t) { return seenT[t]; })
      .map(function (t) { return { value: t, label: TYP_PLURAL[t] || t }; });
    if (typy.length > 1) rebuildGroup("typ", typy);
  }

  // ---------- listings page: full grid + filters ----------
  function renderFeed(feed) {
    var grid = document.getElementById("feedGrid");
    if (!grid) return;
    var countEl = document.getElementById("feedCount");
    var state = { kraj: "all", nabidka: "all", typ: "all" };

    buildFilters(feed);
    grid.innerHTML = feed.items.map(card).join("");
    enhance(grid);
    apply();

    function apply() {
      var shown = 0;
      grid.querySelectorAll(".prop").forEach(function (el) {
        var ok =
          (state.kraj === "all" || el.dataset.city === state.kraj) &&
          (state.nabidka === "all" || el.dataset.nabidka === state.nabidka) &&
          (state.typ === "all" || el.dataset.typ === state.typ);
        el.classList.toggle("is-hidden", !ok);
        if (ok) shown++;
      });
      if (countEl) countEl.textContent = shown;
      var empty = document.getElementById("feedEmpty");
      if (empty) empty.hidden = shown !== 0;
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    }

    document.querySelectorAll("[data-filtergroup]").forEach(function (group) {
      var key = group.getAttribute("data-filtergroup");
      group.querySelectorAll(".chip").forEach(function (chip) {
        chip.addEventListener("click", function () {
          group.querySelectorAll(".chip").forEach(function (c) { c.classList.remove("is-active"); });
          chip.classList.add("is-active");
          state[key] = chip.getAttribute("data-value");
          apply();
        });
      });
    });
  }

  // ---------- detail page ----------
  function paramsTable(p) {
    var rows = Object.keys(p.parametry || {}).map(function (k) {
      return '<div class="prow"><dt>' + esc(k) + "</dt><dd>" + esc(p.parametry[k]) + "</dd></div>";
    });
    rows.push('<div class="prow"><dt>Typ</dt><dd>' + esc(TYP_LABEL[p.typ] || p.typ) + "</dd></div>");
    rows.push('<div class="prow"><dt>Plocha</dt><dd>' + esc(p.plocha) + " m²</dd></div>");
    if (p.penb) rows.push('<div class="prow"><dt>PENB</dt><dd>' + esc(p.penb) + "</dd></div>");
    rows.push('<div class="prow"><dt>ID zakázky</dt><dd>' + esc(p.id) + "</dd></div>");
    return '<dl class="detail__params">' + rows.join("") + "</dl>";
  }

  function gallery(p) {
    var f = p.fotky && p.fotky.length ? p.fotky : null;
    if (!f) {
      return '<div class="detail__stage prop__media--gen">' + (ART[p.art] || ART.apartment) +
        '<span class="detail__ph">Fotografie připravujeme</span></div>';
    }
    var thumbs = f.map(function (ph, i) {
      return '<button type="button" class="gal-thumb' + (i === 0 ? " is-active" : "") + '" data-full="' + esc(ph.f) +
        '" aria-label="Fotografie ' + (i + 1) + '"><img src="' + esc(ph.t) + '" loading="lazy" decoding="async" alt="" /></button>';
    }).join("");
    return '' +
      '<div class="detail__stage prop__media--photo">' +
        '<img id="galMain" class="prop__photo" src="' + esc(f[0].f) + '" alt="' + esc(p.nazev) + '" decoding="async" />' +
      "</div>" +
      (f.length > 1 ? '<div class="gal-thumbs">' + thumbs + "</div>" : "");
  }
  function wireGallery(root) {
    var main = root.querySelector("#galMain");
    if (!main) return;
    root.querySelectorAll(".gal-thumb").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var full = btn.getAttribute("data-full");
        if (full) main.src = full;
        root.querySelectorAll(".gal-thumb").forEach(function (b) { b.classList.remove("is-active"); });
        btn.classList.add("is-active");
      });
    });
  }

  function renderDetail(p) {
    var root = document.getElementById("detailRoot");
    if (!root || !p) return;
    document.title = p.nazev + " — FinTrust Reality";

    root.innerHTML = '' +
      '<a href="nemovitosti.html" class="detail__back" data-cursor>← Zpět na nabídku</a>' +
      '<div class="detail__head">' +
        '<div>' +
          '<span class="eyebrow"><i></i>' + esc(p.lokalita) + " · " + (p.nabidka === "pronajem" ? "Pronájem" : "Prodej") + "</span>" +
          '<h1 class="detail__title">' + esc(p.nazev) + "</h1>" +
          '<p class="detail__meta">' + esc(specLine(p)) + "</p>" +
        "</div>" +
        '<div class="detail__pricebox">' +
          '<span class="detail__price">' + esc(p.cenaText) + "</span>" +
          '<a href="kontakt.html" class="btn btn--gold btn--sm" data-cursor data-magnetic>Mám zájem</a>' +
        "</div>" +
      "</div>" +
      '<div class="detail__gallery reveal-fade">' + gallery(p) + "</div>" +
      '<div class="detail__body">' +
        '<div class="detail__desc reveal-fade">' +
          "<h2>Popis nemovitosti</h2><p>" + esc(p.popis) + "</p>" +
          '<div class="detail__note">Zakázka ' + esc(p.id) + " · nabídku spravuje realitní systém a průběžně ji aktualizujeme.</div>" +
        "</div>" +
        '<aside class="detail__side reveal-fade">' +
          "<h2>Parametry</h2>" + paramsTable(p) +
          '<a href="kontakt.html" class="btn btn--dark btn--block" data-cursor data-magnetic>Domluvit prohlídku</a>' +
        "</aside>" +
      "</div>";
    enhance(root);
    wireGallery(root);
  }

  function fail(err) {
    ["featuredGrid", "feedGrid", "detailRoot"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.innerHTML = '<p class="feed-error">Nabídku se nepodařilo načíst. Zkuste to prosím znovu, nebo nás kontaktujte na reality@fintg.cz.</p>';
    });
    console.warn("listings load failed:", err);
  }

  var hasList = document.getElementById("featuredGrid") || document.getElementById("feedGrid");
  var hasDetail = document.getElementById("detailRoot");

  if (hasList) {
    load().then(function (feed) {
      renderFeatured(feed);
      renderFeed(feed);
    }).catch(fail);
  }

  if (hasDetail) {
    // detail načítá JEDEN inzerát se všemi fotkami (režim ?id=)
    var id = new URLSearchParams(location.search).get("id") || "";
    fetchJSON(API_URL + "?id=" + encodeURIComponent(id))
      .then(function (feed) {
        var p = (feed.items || [])[0];
        if (!p) throw new Error("not found");
        renderDetail(p);
      })
      .catch(function () {
        // fallback: mock/list (lokální náhled nebo výpadek) → line-art
        load().then(function (f) {
          var items = f.items || [];
          var p = items.filter(function (x) { return String(x.id) === id; })[0] || items[0];
          if (p) renderDetail(p); else fail("empty");
        }).catch(fail);
      });
  }
})();

/* =========================================================
   FinTrust Reality — property listings
   Reads data/nemovitosti.json (a stand-in for the live
   realitni-system.com XML/API import) and renders:
     • featured cards on the homepage   (#featuredGrid)
     • the full filterable grid          (#feedGrid)
     • a single property detail          (#detailRoot)
   ========================================================= */
(function () {
  "use strict";

  var DATA_URL = "data/nemovitosti.json";

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
          '<div class="prop__media prop__media--gen">' +
            badge(p) +
            '<span class="prop__city">' + esc(p.lokalita) + "</span>" +
            (ART[p.art] || ART.apartment) +
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

  function load() {
    return fetch(DATA_URL, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  // ---------- homepage: featured ----------
  function renderFeatured(feed) {
    var grid = document.getElementById("featuredGrid");
    if (!grid) return;
    var items = feed.items.filter(function (p) { return p.featured; }).slice(0, 3);
    grid.innerHTML = items.map(card).join("");
    enhance(grid);
  }

  // ---------- listings page: full grid + filters ----------
  function renderFeed(feed) {
    var grid = document.getElementById("feedGrid");
    if (!grid) return;
    var countEl = document.getElementById("feedCount");
    var state = { kraj: "all", nabidka: "all", typ: "all" };

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

  function renderDetail(feed) {
    var root = document.getElementById("detailRoot");
    if (!root) return;
    var id = new URLSearchParams(location.search).get("id");
    var p = feed.items.filter(function (x) { return x.id === id; })[0] || feed.items[0];
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
      '<div class="detail__gallery reveal-fade">' +
        '<div class="detail__stage prop__media--gen">' + (ART[p.art] || ART.apartment) +
          '<span class="detail__ph">Fotografie doplní makléř</span></div>' +
      "</div>" +
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
  }

  function fail(err) {
    ["featuredGrid", "feedGrid", "detailRoot"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.innerHTML = '<p class="feed-error">Nabídku se nepodařilo načíst. Zkuste to prosím znovu, nebo nás kontaktujte na reality@fintg.cz.</p>';
    });
    console.warn("listings load failed:", err);
  }

  if (document.getElementById("featuredGrid") || document.getElementById("feedGrid") || document.getElementById("detailRoot")) {
    load().then(function (feed) {
      renderFeatured(feed);
      renderFeed(feed);
      renderDetail(feed);
    }).catch(fail);
  }
})();

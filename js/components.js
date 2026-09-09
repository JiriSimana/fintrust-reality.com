/* =========================================================
   FinTrust Reality — shared header + footer
   Injected on every page so navigation stays in one place.
   Set the active item with  <body data-page="nemovitosti">.
   ========================================================= */
(function () {
  "use strict";

  var LOGO = '' +
    '<span class="logo" data-logo>' +
      '<img class="logo__wm" src="assets/fintrust-wordmark-inverted.svg" alt="FinTrust" width="356" height="83" />' +
      '<span class="logo__sub">Reality</span>' +
    '</span>';

  // key must match <body data-page="…">
  var LINKS = [
    { key: "nemovitosti", href: "nemovitosti.html", label: "Nemovitosti" },
    { key: "sluzby",      href: "sluzby.html",       label: "Služby" },
    { key: "sprava",      href: "sprava-nemovitosti.html", label: "Správa &amp; pronájem" },
    // DOČASNĚ SKRYTO — „O nás" (zatím neprezentujeme žádného makléře).
    // Obnovení: odkomentovat řádek níže + smazat redirect blok v horní části o-nas.html.
    // { key: "o-nas",       href: "o-nas.html",        label: "O nás" },
    { key: "kariera",     href: "kariera.html",      label: "Kariéra" },
    { key: "kontakt",     href: "kontakt.html",      label: "Kontakt" },
  ];

  function navLinks(active, mobile) {
    return LINKS.map(function (l, i) {
      var on = l.key === active ? ' class="is-active"' : "";
      if (mobile) {
        return '<a href="' + l.href + '" class="menu__link' + (l.key === active ? " is-active" : "") + '">' +
          '<i>0' + (i + 1) + '</i> ' + l.label + "</a>";
      }
      return '<a href="' + l.href + '"' + on + " data-cursor>" + l.label + "</a>";
    }).join("");
  }

  function header(active) {
    return '' +
      '<header class="nav" id="nav">' +
        '<a href="index.html" class="nav__logo" data-cursor aria-label="FinTrust Reality — domů">' + LOGO + "</a>" +
        '<nav class="nav__links" aria-label="Hlavní navigace">' + navLinks(active, false) + "</nav>" +
        '<div class="nav__right">' +
          '<span class="nav__loc">Plzeň · Praha</span>' +
          '<a href="prodej.html" class="btn btn--gold btn--sm" data-cursor data-magnetic>Chci znát cenu</a>' +
          '<button class="nav__burger" id="burger" aria-label="Menu" aria-expanded="false"><span></span><span></span></button>' +
        "</div>" +
      "</header>" +
      '<div class="menu" id="menu" aria-hidden="true">' +
        '<nav class="menu__links">' + navLinks(active, true) + "</nav>" +
        '<div class="menu__foot">' +
          '<a href="prodej.html" class="btn btn--gold">Chci znát cenu nemovitosti</a>' +
          "<p>Plzeň · Praha — součást skupiny <a href=\"https://fintg.cz\" target=\"_blank\" rel=\"noopener\">FinTrust</a></p>" +
        "</div>" +
      "</div>";
  }

  function footer() {
    var y = new Date().getFullYear();
    return '' +
      '<footer class="footer">' +
        '<div class="footer__top">' +
          '<div class="footer__brand">' +
            '<a href="index.html" class="logo logo--footer" data-logo data-cursor>' + LOGO + "</a>" +
            '<p class="footer__tag">Váš lidský partner<br>ve světě nemovitostí.</p>' +
          "</div>" +
          '<nav class="footer__nav" aria-label="Patička">' +
            '<div><h4>Web</h4>' +
              '<a href="nemovitosti.html" data-cursor>Nemovitosti</a>' +
              '<a href="sluzby.html" data-cursor>Služby</a>' +
              '<a href="sprava-nemovitosti.html" data-cursor>Správa &amp; pronájem</a>' +
              '<a href="prodej.html" data-cursor>Chci prodat</a>' +
              '<a href="kariera.html" data-cursor>Kariéra</a>' +
            "</div>" +
            '<div><h4>Skupina FinTrust</h4>' +
              '<a href="https://fintg.cz" target="_blank" rel="noopener" data-cursor>FinTrust ↗</a>' +
              '<a href="https://fintg.cz" target="_blank" rel="noopener" data-cursor>Hypotéky ↗</a>' +
              '<a href="https://fintg.cz" target="_blank" rel="noopener" data-cursor>Pojištění ↗</a>' +
              '<a href="https://fintg.cz" target="_blank" rel="noopener" data-cursor>Investice ↗</a>' +
            "</div>" +
            '<div><h4>Kontakt</h4>' +
              '<a href="mailto:reality@fintg.cz" data-cursor>reality@fintg.cz</a>' +
              '<a href="tel:+420606060098" data-cursor>+420 606 060 098</a>' +
              '<span>Josef Knopp, MBA</span>' +
              '<span>alej Svobody 659/29, 323 00 Plzeň</span>' +
              '<span>Praha — pobočka</span>' +
            "</div>" +
          "</nav>" +
        "</div>" +
        '<div class="footer__legal">' +
          'FinTrust Reality s.r.o. · IČO 29940150 · se sídlem alej Svobody 659/29, Severní Předměstí, 323 00 Plzeň · ' +
          'zapsaná v obchodním rejstříku vedeném Krajským soudem v Plzni, oddíl C, vložka 48943.' +
        "</div>" +
        '<div class="footer__bottom">' +
          "<span>© " + y + " FinTrust Reality s.r.o. — součást skupiny FinTrust</span>" +
          '<span class="footer__made">Nabídka nemovitostí: realitní systém (XML/API)</span>' +
          '<a href="#top" class="footer__top-link" data-cursor data-magnetic>Nahoru ↑</a>' +
        "</div>" +
      "</footer>";
  }

  function inject() {
    var active = document.body.getAttribute("data-page") || "";

    // scroll progress bar (once)
    if (!document.getElementById("scrollProgress")) {
      var chrome = document.createElement("div");
      chrome.innerHTML =
        '<div class="scroll-progress" id="scrollProgress" aria-hidden="true"></div>';
      document.body.insertBefore(chrome.firstChild, document.body.firstChild);
    }

    var h = document.getElementById("site-header");
    var f = document.getElementById("site-footer");
    if (h) h.innerHTML = header(active);
    if (f) f.innerHTML = footer();
  }

  inject();
  window.FTR = window.FTR || {};
  window.FTR.componentsReady = true;
})();

/* =========================================================
   FinTrust Reality — galerie s lightboxem (landing pages)
   Odkazy uvnitř .gallery otevřou fotku přes celou obrazovku,
   šipky/klávesy listují, Esc nebo klik mimo zavře.
   ========================================================= */
(function () {
  "use strict";

  var links = Array.prototype.slice.call(document.querySelectorAll(".gallery a"));
  if (!links.length) return;

  var lb = document.createElement("div");
  lb.className = "lb";
  lb.hidden = true;
  lb.setAttribute("role", "dialog");
  lb.setAttribute("aria-modal", "true");
  lb.setAttribute("aria-label", "Fotogalerie");
  lb.setAttribute("data-lenis-prevent", "");
  lb.innerHTML =
    '<img alt="" />' +
    '<button class="lb__btn lb__close" type="button" aria-label="Zavřít">✕</button>' +
    '<button class="lb__btn lb__prev" type="button" aria-label="Předchozí fotografie">←</button>' +
    '<button class="lb__btn lb__next" type="button" aria-label="Další fotografie">→</button>' +
    '<span class="lb__count"></span>';
  document.body.appendChild(lb);

  var img = lb.querySelector("img");
  var count = lb.querySelector(".lb__count");
  var i = 0, lastFocus = null;

  function show(n) {
    i = (n + links.length) % links.length;
    var a = links[i];
    img.src = a.getAttribute("href");
    img.alt = (a.querySelector("img") || {}).alt || "";
    count.textContent = (i + 1) + " / " + links.length;
    // přednačti sousední fotky, ať listování nečeká
    [i + 1, i - 1].forEach(function (k) {
      var n = links[(k + links.length) % links.length];
      if (n && !n.__pre) { n.__pre = true; new Image().src = n.getAttribute("href"); }
    });
  }
  function open(n) {
    lastFocus = document.activeElement;
    show(n);
    lb.hidden = false;
    document.body.style.overflow = "hidden";
    lb.querySelector(".lb__close").focus();
  }
  function close() {
    lb.hidden = true;
    document.body.style.overflow = "";
    img.removeAttribute("src");
    if (lastFocus) lastFocus.focus();
  }

  links.forEach(function (a, n) {
    a.addEventListener("click", function (e) { e.preventDefault(); open(n); });
  });
  lb.querySelector(".lb__close").addEventListener("click", close);
  lb.querySelector(".lb__prev").addEventListener("click", function () { show(i - 1); });
  lb.querySelector(".lb__next").addEventListener("click", function () { show(i + 1); });
  lb.addEventListener("click", function (e) { if (e.target === lb) close(); });
  document.addEventListener("keydown", function (e) {
    if (lb.hidden) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowRight") show(i + 1);
    else if (e.key === "ArrowLeft") show(i - 1);
  });
})();

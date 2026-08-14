/* =========================================================
   FinTrust Reality — interaction layer (multi-page)
   Lenis smooth scroll · GSAP reveals · custom cursor · magnetics
   Degrades gracefully if any CDN lib is missing.
   Exposes window.FTR.enhance(root) so injected content
   (property cards) gets cursor + reveal behaviour too.
   ========================================================= */
(function () {
  "use strict";

  var hasGSAP = typeof window.gsap !== "undefined";
  var hasST = hasGSAP && typeof window.ScrollTrigger !== "undefined";
  var hasLenis = typeof window.Lenis !== "undefined";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia("(pointer: fine)").matches;

  if (hasST) gsap.registerPlugin(ScrollTrigger);
  document.documentElement.classList.remove("no-js");

  window.FTR = window.FTR || {};

  var cursorEl = null, cursorParts = null;

  function forceReveal(scope) {
    (scope || document).querySelectorAll(".reveal-fade,.reveal-card").forEach(function (el) {
      el.style.opacity = 1; el.style.transform = "none";
    });
  }
  if (!hasGSAP) forceReveal();

  var started = false;
  function init() {
    if (started) return; started = true;
    var lenis = initLenis();
    initNav(lenis);
    initMobileMenu();
    if (fine && !reduce) initCursor();
    if (hasGSAP) buildAnimations();
    if (window.FTR && FTR.enhance) FTR.enhance(document); // bind magnetics/cursor already in DOM
    initForm();
  }
  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);

  /* ---------- Lenis ---------- */
  function initLenis() {
    if (!hasLenis || reduce) { bindAnchors(null); return null; }
    var lenis = new Lenis({
      duration: 1.15,
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      smoothWheel: true,
    });
    if (hasST) {
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
      gsap.ticker.lagSmoothing(0);
    } else {
      (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })();
    }
    bindAnchors(lenis);
    return lenis;
  }
  function bindAnchors(lenis) {
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a) return;
      var id = a.getAttribute("href");
      if (id === "#" || id === "#top") { e.preventDefault(); closeMenu(); scrollTop(lenis); return; }
      if (id.length < 2) return;
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault(); closeMenu();
      if (lenis) lenis.scrollTo(target, { offset: -10, duration: 1.3 });
      else target.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
    });
  }
  function scrollTop(lenis) {
    if (lenis) lenis.scrollTo(0, { duration: 1.1 });
    else window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  }

  /* ---------- nav ---------- */
  function initNav(lenis) {
    var nav = document.getElementById("nav");
    var prog = document.getElementById("scrollProgress");
    function onScroll(y) {
      if (nav) nav.classList.toggle("scrolled", y > 40);
      if (prog) {
        var max = document.documentElement.scrollHeight - window.innerHeight;
        prog.style.transform = "scaleX(" + (max > 0 ? y / max : 0) + ")";
      }
    }
    if (lenis) lenis.on("scroll", function (e) { onScroll(e.scroll); });
    else window.addEventListener("scroll", function () { onScroll(window.scrollY); }, { passive: true });
    onScroll(window.scrollY);
  }

  /* ---------- mobile menu ---------- */
  var menuEl, navEl;
  function initMobileMenu() {
    menuEl = document.getElementById("menu");
    navEl = document.getElementById("nav");
    var burger = document.getElementById("burger");
    if (!burger) return;
    burger.addEventListener("click", function () {
      var open = menuEl.classList.toggle("open");
      navEl.classList.toggle("menu-open", open);
      burger.setAttribute("aria-expanded", open);
      menuEl.setAttribute("aria-hidden", !open);
      document.body.style.overflow = open ? "hidden" : "";
    });
    menuEl.querySelectorAll("a").forEach(function (a) { a.addEventListener("click", closeMenu); });
  }
  function closeMenu() {
    if (!menuEl || !menuEl.classList.contains("open")) return;
    menuEl.classList.remove("open");
    if (navEl) navEl.classList.remove("menu-open");
    menuEl.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    var b = document.getElementById("burger");
    if (b) b.setAttribute("aria-expanded", "false");
  }

  /* ---------- custom cursor ---------- */
  function initCursor() {
    cursorEl = document.getElementById("cursor");
    if (!cursorEl) return;
    document.body.classList.add("cursor-ready");
    var label = cursorEl.querySelector(".cursor__label");
    var dot = cursorEl.querySelector(".cursor__dot");
    var ring = cursorEl.querySelector(".cursor__ring");
    cursorParts = { label: label, dot: dot, ring: ring };
    var mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;
    window.addEventListener("mousemove", function (e) {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = "translate(" + mx + "px," + my + "px)";
      cursorEl.classList.add("on");
    });
    (function loop() {
      rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18;
      ring.style.transform = "translate(" + rx + "px," + ry + "px)";
      label.style.transform = "translate(" + rx + "px," + ry + "px)";
      requestAnimationFrame(loop);
    })();
    window.addEventListener("mouseleave", function () { cursorEl.classList.remove("on"); });
  }
  function bindCursor(scope) {
    if (!cursorEl || !fine || reduce) return;
    scope.querySelectorAll("[data-cursor]").forEach(function (el) {
      if (el.__cur) return; el.__cur = true;
      el.addEventListener("mouseenter", function () {
        var l = el.getAttribute("data-cursor-label");
        if (l) { cursorEl.classList.add("label"); cursorParts.label.textContent = l; }
        else cursorEl.classList.add("hover");
      });
      el.addEventListener("mouseleave", function () { cursorEl.classList.remove("hover", "label"); });
    });
  }

  /* ---------- magnetic ---------- */
  function bindMagnetic(scope) {
    if (!fine || reduce) return;
    scope.querySelectorAll("[data-magnetic]").forEach(function (el) {
      if (el.__mag) return; el.__mag = true;
      var s = 0.35;
      el.addEventListener("mousemove", function (e) {
        var r = el.getBoundingClientRect();
        el.style.transform = "translate(" + (e.clientX - (r.left + r.width / 2)) * s + "px," + (e.clientY - (r.top + r.height / 2)) * s + "px)";
      });
      el.addEventListener("mouseleave", function () { el.style.transform = "translate(0,0)"; });
    });
  }

  /* ---------- reveals for a scope (used for injected content) ---------- */
  function revealScope(scope) {
    var items = scope.querySelectorAll(".reveal-fade,.reveal-card");
    if (!items.length) return;
    if (!hasST) { forceReveal(scope); return; }
    items.forEach(function (el) {
      if (el.__rev) return; el.__rev = true;
      gsap.fromTo(el, { y: 34, opacity: 0 }, {
        y: 0, opacity: 1, duration: 1, ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 90%" },
      });
    });
  }

  // public: enhance freshly-injected DOM
  window.FTR.enhance = function (root) {
    root = root || document;
    bindCursor(root);
    bindMagnetic(root);
    revealScope(root);
    if (hasST) ScrollTrigger.refresh();
  };

  /* ---------- contact form ---------- */
  function initForm() {
    var form = document.getElementById("contactForm");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var msg = document.getElementById("formMsg");
      var name = (document.getElementById("cname") || {}).value || "";
      if (msg) msg.textContent = "Děkujeme" + (name ? ", " + name.split(" ")[0] : "") +
        "! Toto je náhledová verze — formulář zatím neodesílá. Napište nám na reality@fintg.cz.";
      var b = form.querySelector('button[type="submit"]'); if (b) b.textContent = "Odesláno ✓";
    });
  }

  /* =========================================================
     GSAP page animations (static content already in the DOM)
     ========================================================= */
  function buildAnimations() {
    document.querySelectorAll("[data-split],[data-split-words]").forEach(splitWords);
    if (!hasST) { forceReveal(); return; }

    gsap.utils.toArray(".reveal-fade").forEach(function (el) {
      if (el.__rev) return; el.__rev = true;
      gsap.fromTo(el, { y: 26, opacity: 0 }, {
        y: 0, opacity: 1, duration: 1, ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 88%" },
      });
    });

    gsap.utils.toArray(".pillars__grid,.team__grid,.sprava__panel,.hero__meta,.values__grid,.grid-svc,.forwhom")
      .forEach(function (grid) {
        var items = grid.classList.contains("sprava__panel") ? [grid] : grid.querySelectorAll(".reveal-card");
        items = Array.prototype.filter.call(items, function (el) { return !el.__rev; });
        if (!items.length) return;
        items.forEach(function (el) { el.__rev = true; });
        gsap.fromTo(items, { y: 40, opacity: 0 }, {
          y: 0, opacity: 1, duration: 1, ease: "power3.out", stagger: 0.09,
          scrollTrigger: { trigger: grid, start: "top 85%" },
        });
      });

    gsap.utils.toArray("[data-split-words]").forEach(function (el) {
      var inners = el.querySelectorAll(".split-word i");
      if (!inners.length) return;
      gsap.fromTo(inners, { yPercent: 115 }, {
        yPercent: 0, duration: 1.05, ease: "power4.out", stagger: 0.045,
        scrollTrigger: { trigger: el, start: "top 90%" },
      });
    });

    gsap.utils.toArray("[data-split]").forEach(function (el) {
      var inners = el.querySelectorAll(".split-word i");
      if (!inners.length) return;
      gsap.fromTo(inners, { yPercent: 120 }, {
        yPercent: 0, duration: 1.1, ease: "power4.out", stagger: 0.05,
        scrollTrigger: { trigger: el, start: "top 86%" },
      });
    });

    gsap.utils.toArray(".step").forEach(function (step, i) {
      ScrollTrigger.create({ trigger: step, start: "top 85%", onEnter: function () { step.classList.add("in"); } });
      gsap.fromTo(step.querySelectorAll("h3,p"), { y: 20, opacity: 0 }, {
        y: 0, opacity: 1, duration: 0.9, ease: "power3.out", stagger: 0.08, delay: 0.1 + i * 0.02,
        scrollTrigger: { trigger: step, start: "top 85%" },
      });
    });

    gsap.utils.toArray("[data-count]").forEach(function (el) {
      var end = parseFloat(el.getAttribute("data-count"));
      var target = el.querySelector("span") || el;
      var obj = { v: 0 };
      ScrollTrigger.create({
        trigger: el, start: "top 90%", once: true,
        onEnter: function () {
          gsap.to(obj, { v: end, duration: 1.6, ease: "power2.out",
            onUpdate: function () { target.textContent = Math.round(obj.v); } });
        },
      });
    });

    ScrollTrigger.refresh();
  }

  /* ---------- word splitter (keeps nested inline elements) ---------- */
  function splitWords(container) {
    if (container.querySelector(".split-word")) return;
    walk(container);
    function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          var frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach(function (w) {
            if (w.trim() === "") { frag.appendChild(document.createTextNode(w)); return; }
            var wrap = document.createElement("span"); wrap.className = "split-word";
            var inner = document.createElement("i"); inner.textContent = w;
            wrap.appendChild(inner); frag.appendChild(wrap);
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1) {
          var wrap = document.createElement("span"); wrap.className = "split-word";
          var inner = document.createElement("i");
          child.parentNode.replaceChild(wrap, child);
          inner.appendChild(child); wrap.appendChild(inner);
        }
      });
    }
  }
})();

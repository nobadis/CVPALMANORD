(function () {
  var doc = document;
  var STORAGE_KEY = "cvpalmanord_cookie_consent_v1";
  var GA_ID = "G-N3VK1ERH9L";

  // Add loading class for subtle perceived performance.
  doc.documentElement.classList.add("ui-ready");

  // Improve native behavior for offcanvas/menu links.
  var menuLinks = doc.querySelectorAll(".sydney-offcanvas-menu a[href^='/']");
  for (var i = 0; i < menuLinks.length; i += 1) {
    menuLinks[i].addEventListener("click", function () {
      var closeBtn = doc.querySelector(".mobile-menu-close");
      if (closeBtn) {
        closeBtn.click();
      }
    });
  }

  // Make hero header less jumpy on scroll.
  var sticky = doc.querySelector(".bottom-header-row.sticky-header");
  if (sticky) {
    window.addEventListener(
      "scroll",
      function () {
        var currentY = window.scrollY;
        if (currentY > 24) {
          sticky.style.boxShadow = "0 8px 24px rgba(38,50,70,0.14)";
        } else {
          sticky.style.boxShadow = "";
        }
      },
      { passive: true }
    );
  }

  function ensureLegalLinks() {
    var siteInfo = doc.querySelector(".site-info .col-md-6:last-child");
    if (!siteInfo || siteInfo.querySelector(".legal-links")) return;
    siteInfo.innerHTML =
      '<div class="legal-links">' +
      '<a href="/legal/aviso-legal-y-privacidad/">Aviso legal y privacidad</a>' +
      '<a href="/legal/politica-cookies/">Política de cookies</a>' +
      '<a href="#" id="open-cookie-settings-link">Configurar cookies</a>' +
      "</div>";
  }

  function setupFormConsent() {
    var forms = doc.querySelectorAll("form.wpcf7-form");
    for (var i = 0; i < forms.length; i += 1) {
      var form = forms[i];
      if (form.querySelector(".legal-consent")) continue;

      var box = doc.createElement("div");
      box.className = "legal-consent";
      box.innerHTML =
        '<p class="legal-inline-notice"><strong>Información básica sobre Protección de Datos</strong><br>' +
        "Responsable: Clinica Veterinaria Palmanord.<br>" +
        "Finalidad: gestionar tu consulta y/o solicitud de cita o presupuesto.<br>" +
        "Legitimación: consentimiento del interesado.<br>" +
        "Destinatarios: no se cederan datos a terceros, salvo obligacion legal.<br>" +
        'Derechos: acceso, rectificacion, supresion y otros, segun informacion adicional en el <a href="/legal/aviso-legal-y-privacidad/" target="_blank" rel="noopener">Aviso legal y politica de privacidad</a>.</p>' +
        '<label><input type="checkbox" name="legal-consent-required" value="1"> <span>He leido y acepto las condiciones (aviso legal y politica de privacidad).</span></label>' +
        '<label><input type="checkbox" name="legal-consent-marketing" value="1"> <span>Acepto recibir informacion comercial sobre promociones, productos y servicios.</span></label>' +
        '<div class="legal-consent-error">No puedes enviar la solicitud sin aceptar el aviso legal y politica de privacidad.</div>';

      var submit = form.querySelector('input[type="submit"], button[type="submit"]');
      if (submit && submit.parentNode) {
        submit.parentNode.parentNode.insertBefore(box, submit.parentNode);
      } else {
        form.appendChild(box);
      }

      form.addEventListener("submit", function (ev) {
        var wrap = ev.currentTarget.querySelector(".legal-consent");
        var required = ev.currentTarget.querySelector('input[name="legal-consent-required"]');
        if (!required || !required.checked) {
          ev.preventDefault();
          if (wrap) wrap.classList.add("error");
        }
      });

      var requiredInput = form.querySelector('input[name="legal-consent-required"]');
      if (requiredInput) {
        requiredInput.addEventListener("change", function (ev) {
          var wrap = ev.target.closest(".legal-consent");
          if (wrap && ev.target.checked) wrap.classList.remove("error");
        });
      }
    }
  }

  function getConsent() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveConsent(consent) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
    } catch (e) {
      return;
    }
  }

  function loadGoogleAnalytics() {
    if (window.__ga_loaded__) return;
    window.__ga_loaded__ = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", GA_ID);

    var s = doc.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(GA_ID);
    doc.head.appendChild(s);
  }

  function applyConsent(consent) {
    if (!consent) return;
    if (consent.analytics) loadGoogleAnalytics();
  }

  function renderCookieUI() {
    if (doc.querySelector(".cookie-banner")) return;
    var banner = doc.createElement("div");
    banner.className = "cookie-banner";
    banner.innerHTML =
      '<h3 class="cookie-title">Cookies en CV Palmanord</h3>' +
      '<p class="cookie-text">Usamos cookies tecnicas necesarias y, si lo autorizas, cookies analiticas para mejorar la web. Puedes aceptar, rechazar o configurar.</p>' +
      '<div class="cookie-actions">' +
      '<button class="cookie-btn light" data-cookie-action="accept-all">Aceptar todas</button>' +
      '<button class="cookie-btn" data-cookie-action="reject-all">Rechazar no necesarias</button>' +
      '<button class="cookie-btn primary" data-cookie-action="open-panel">Configurar</button>' +
      '<a class="cookie-btn" href="/legal/politica-cookies/">Politica de cookies</a>' +
      "</div>";

    var panel = doc.createElement("div");
    panel.className = "cookie-panel";
    panel.innerHTML =
      '<h3 class="cookie-title">Configurar cookies</h3>' +
      '<p class="cookie-text">Puedes activar o desactivar categorias no esenciales. Las cookies tecnicas siempre estan activas.</p>' +
      '<div class="cookie-toggle-row"><div><strong>Tecnicas</strong><br><small>Necesarias para el funcionamiento basico.</small></div><span class="cookie-chip">Siempre activas</span></div>' +
      '<div class="cookie-toggle-row"><div><strong>Analiticas</strong><br><small>Medicion anonima para mejorar experiencia y rendimiento.</small></div><input type="checkbox" id="cookie-analytics-toggle"></div>' +
      '<div class="cookie-actions">' +
      '<button class="cookie-btn light" data-cookie-action="save-config">Guardar configuracion</button>' +
      '<button class="cookie-btn" data-cookie-action="close-panel">Cancelar</button>' +
      "</div>";

    var floating = doc.createElement("button");
    floating.className = "cookie-settings-btn";
    floating.type = "button";
    floating.textContent = "⚙";
    floating.setAttribute("aria-label", "Configurar cookies");
    floating.setAttribute("title", "Configurar cookies");
    floating.addEventListener("click", function () {
      panel.style.display = "block";
      banner.style.display = "none";
    });

    doc.body.appendChild(banner);
    doc.body.appendChild(panel);
    doc.body.appendChild(floating);

    var saved = getConsent();
    var analyticsToggle = panel.querySelector("#cookie-analytics-toggle");
    if (saved && analyticsToggle) analyticsToggle.checked = !!saved.analytics;

    function closeAll() {
      banner.style.display = "none";
      panel.style.display = "none";
    }

    function showPanel() {
      panel.style.display = "block";
      banner.style.display = "none";
    }

    function maybeHideBanner() {
      var consent = getConsent();
      if (consent) banner.style.display = "none";
    }

    doc.addEventListener("click", function (ev) {
      var target = ev.target;
      if (!target || !target.getAttribute) return;
      var action = target.getAttribute("data-cookie-action");
      if (!action) return;

      if (action === "accept-all") {
        var consent = { essential: true, analytics: true, updatedAt: new Date().toISOString() };
        saveConsent(consent);
        applyConsent(consent);
        closeAll();
      } else if (action === "reject-all") {
        var reject = { essential: true, analytics: false, updatedAt: new Date().toISOString() };
        saveConsent(reject);
        closeAll();
      } else if (action === "open-panel") {
        showPanel();
      } else if (action === "save-config") {
        var chosen = {
          essential: true,
          analytics: !!(analyticsToggle && analyticsToggle.checked),
          updatedAt: new Date().toISOString()
        };
        saveConsent(chosen);
        applyConsent(chosen);
        closeAll();
      } else if (action === "close-panel") {
        panel.style.display = "none";
        if (!getConsent()) banner.style.display = "block";
      }
    });

    var openLink = doc.getElementById("open-cookie-settings-link");
    if (openLink) {
      openLink.addEventListener("click", function (ev) {
        ev.preventDefault();
        panel.style.display = "block";
        banner.style.display = "none";
      });
    }

    maybeHideBanner();
  }

  function setupProgressFallback() {
    var bars = doc.querySelectorAll(".elementor-progress-bar[data-max]");
    if (!bars.length) return;

    function activateBar(bar) {
      var max = parseInt(bar.getAttribute("data-max") || "0", 10);
      if (max < 0) max = 0;
      if (max > 100) max = 100;
      bar.style.width = max + "%";
    }

    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(
        function (entries) {
          for (var i = 0; i < entries.length; i += 1) {
            if (entries[i].isIntersecting) {
              activateBar(entries[i].target);
              io.unobserve(entries[i].target);
            }
          }
        },
        { threshold: 0.25 }
      );
      for (var j = 0; j < bars.length; j += 1) io.observe(bars[j]);
    } else {
      for (var k = 0; k < bars.length; k += 1) activateBar(bars[k]);
    }
  }

  function setupCarouselFallback() {
    var wrappers = doc.querySelectorAll(".elementor-image-carousel-wrapper");
    if (!wrappers.length) return;

    function initFallback(wrapper) {
      if (wrapper.getAttribute("data-ui-fallback") === "1") return;
      var track = wrapper.querySelector(".swiper-wrapper");
      if (!track) return;
      var slides = track.querySelectorAll(".swiper-slide");
      if (!slides.length) return;

      wrapper.setAttribute("data-ui-fallback", "1");
      wrapper.classList.add("ui-simple-carousel");

      var idx = 0;
      function goTo(index) {
        idx = (index + slides.length) % slides.length;
        var left = slides[idx].offsetLeft;
        track.scrollTo({ left: left, behavior: "smooth" });
      }
      function next() { goTo(idx + 1); }
      function prev() { goTo(idx - 1); }

      var prevBtn = wrapper.querySelector(".elementor-swiper-button-prev");
      var nextBtn = wrapper.querySelector(".elementor-swiper-button-next");
      if (prevBtn) prevBtn.addEventListener("click", prev);
      if (nextBtn) nextBtn.addEventListener("click", next);

      track.addEventListener("scroll", function () {
        var best = 0;
        var bestDist = Infinity;
        for (var i = 0; i < slides.length; i += 1) {
          var d = Math.abs(track.scrollLeft - slides[i].offsetLeft);
          if (d < bestDist) { bestDist = d; best = i; }
        }
        idx = best;
      }, { passive: true });
    }

    // Delay to avoid fighting initial layout.
    window.setTimeout(function () {
      for (var i = 0; i < wrappers.length; i += 1) initFallback(wrappers[i]);
    }, 700);
  }

  ensureLegalLinks();
  setupFormConsent();
  renderCookieUI();
  setupProgressFallback();
  setupCarouselFallback();
  applyConsent(getConsent());
})();

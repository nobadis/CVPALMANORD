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

  function getFieldValue(form, names) {
    for (var i = 0; i < names.length; i += 1) {
      var field = form.querySelector('[name="' + names[i] + '"]');
      if (field && typeof field.value === "string" && field.value.trim()) {
        return field.value.trim();
      }
    }
    return "";
  }

  function showQuotePanel(panelId) {
    var ids = ["quote-panel-form", "quote-panel-success", "quote-panel-error", "quote-panel-loading"];
    for (var i = 0; i < ids.length; i += 1) {
      var panel = doc.getElementById(ids[i]);
      if (panel) panel.hidden = ids[i] !== panelId;
    }
    if (panelId !== "quote-panel-loading") {
      var form = doc.getElementById("quote-form");
      var btn = doc.getElementById("quote-submit-btn");
      if (form) form.classList.remove("is-submitting");
      if (btn) btn.disabled = false;
    }
    var shell = doc.getElementById("quote-form-shell");
    if (shell && shell.scrollIntoView) {
      shell.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function showQuoteLoading(form, loading) {
    var btn = doc.getElementById("quote-submit-btn");
    if (loading) {
      if (form) form.classList.add("is-submitting");
      if (btn) btn.disabled = true;
      showQuotePanel("quote-panel-loading");
    } else {
      if (form) form.classList.remove("is-submitting");
      if (btn) btn.disabled = false;
      showQuotePanel("quote-panel-form");
    }
  }

  function showQuoteSuccessPage() {
    showQuotePanel("quote-panel-success");
  }

  function showQuoteErrorPage(message) {
    var msgEl = doc.getElementById("quote-error-message");
    if (msgEl) msgEl.textContent = message;
    showQuotePanel("quote-panel-error");
  }

  function setFormStatus(form, type, message) {
    if (form.classList.contains("quote-form-modern")) {
      if (type === "ok") {
        showQuoteSuccessPage();
        return;
      }
      showQuoteErrorPage(message);
      return;
    }
    var output = form.parentNode && form.parentNode.querySelector(".wpcf7-response-output");
    if (!output) {
      output = doc.createElement("div");
      output.className = "wpcf7-response-output";
      form.appendChild(output);
    }
    output.textContent = message;
    output.setAttribute("aria-hidden", "false");
    output.className = "wpcf7-response-output " + (type === "ok" ? "wpcf7-mail-sent-ok" : "wpcf7-validation-errors");
  }

  function isValidEmailValue(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function setFieldError(fieldWrap, message) {
    fieldWrap.classList.add("has-error");
    var input = fieldWrap.querySelector(".quote-input, .wpcf7-form-control");
    if (input) input.classList.add("is-invalid");
    var err = fieldWrap.querySelector(".quote-field-error");
    if (err) err.textContent = message;
  }

  function clearQuoteFieldErrors(form) {
    var fields = form.querySelectorAll(".quote-field");
    for (var i = 0; i < fields.length; i += 1) {
      fields[i].classList.remove("has-error");
      var input = fields[i].querySelector(".quote-input");
      if (input) input.classList.remove("is-invalid");
      var err = fields[i].querySelector(".quote-field-error");
      if (err) err.textContent = "";
    }
  }

  function validateQuoteForm(form) {
    clearQuoteFieldErrors(form);
    var valid = true;

    function check(name, msg, validator) {
      var input = form.querySelector('[name="' + name + '"]');
      var wrap = input && input.closest(".quote-field");
      var val = input && input.value ? input.value.trim() : "";
      if (!val || (validator && !validator(val))) {
        if (wrap) setFieldError(wrap, msg);
        valid = false;
      }
    }

    check("your-name", "Indica tu nombre.");
    check("your-email", "Indica un correo valido.", isValidEmailValue);
    check("your-phone", "Indica un telefono valido.", function (v) {
      return v.replace(/\D/g, "").length >= 8;
    });
    check("your-animal-name", "Indica el nombre de tu mascota.");
    check("your-animal-race", "Indica especie y raza.");
    check("your-animal-weight", "Indica el peso aproximado.");

    var legal = form.querySelector('input[name="legal-consent-required"]');
    var legalWrap = form.querySelector(".legal-consent");
    if (!legal || !legal.checked) {
      if (legalWrap) legalWrap.classList.add("error");
      valid = false;
    } else if (legalWrap) {
      legalWrap.classList.remove("error");
    }

    return valid;
  }

  function fixPresupuestoEmails() {
    if (location.pathname.indexOf("/pide-tu-presupuesto") === -1) return;
    var links = doc.querySelectorAll('a[href*="info@cvpalmanord.es"]');
    for (var i = 0; i < links.length; i += 1) {
      links[i].href = "mailto:cvpalmanord@cvpalmanord.es";
      if (links[i].textContent.indexOf("info@") !== -1) {
        links[i].textContent = "cvpalmanord@cvpalmanord.es";
      }
    }
  }

  function setupQuoteForm() {
    var form = doc.getElementById("quote-form");
    if (!form) return;

    form.addEventListener(
      "submit",
      function (ev) {
        handleSecureFormSubmit(ev, form);
      },
      true
    );

    var retryBtn = doc.getElementById("quote-retry-btn");
    if (retryBtn) {
      retryBtn.addEventListener("click", function () {
        showQuotePanel("quote-panel-form");
      });
    }

    var inputs = form.querySelectorAll(".quote-input");
    for (var i = 0; i < inputs.length; i += 1) {
      inputs[i].addEventListener("input", function (ev) {
        var wrap = ev.target.closest(".quote-field");
        if (wrap) {
          wrap.classList.remove("has-error");
          ev.target.classList.remove("is-invalid");
        }
      });
    }

    var legalRequired = form.querySelector('input[name="legal-consent-required"]');
    if (legalRequired) {
      legalRequired.addEventListener("change", function () {
        var legalWrap = form.querySelector(".legal-consent");
        if (legalRequired.checked && legalWrap) legalWrap.classList.remove("error");
      });
    }
  }

  function handleSecureFormSubmit(ev, form) {
    ev.preventDefault();
    ev.stopPropagation();

    var honeypot = form.querySelector('input[name="website"]');
    if (honeypot && honeypot.value) return;

    if (form.classList.contains("quote-form-modern") && !validateQuoteForm(form)) {
      showQuoteErrorPage("Revisa los campos marcados e intentalo de nuevo.");
      return;
    }

    showQuoteLoading(form, true);

    var marketing = form.querySelector('input[name="legal-consent-marketing"]');
    var payload = {
      name: getFieldValue(form, ["your-name", "nombre"]),
      email: getFieldValue(form, ["your-email", "email"]),
      phone: getFieldValue(form, ["your-phone", "telefono"]),
      animalName: getFieldValue(form, ["your-animal-name"]),
      animalRace: getFieldValue(form, ["your-animal-race"]),
      animalWeight: getFieldValue(form, ["your-animal-weight"]),
      message: getFieldValue(form, ["your-message", "mensaje"]),
      marketing: !!(marketing && marketing.checked),
      source: window.location.pathname || "/"
    };

    fetch("/api/contact.php", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      credentials: "same-origin"
    })
      .then(function (response) {
        return response.text().then(function (text) {
          var data = null;
          try {
            data = text ? JSON.parse(text) : null;
          } catch (e) {
            data = null;
          }
          return { response: response, data: data };
        });
      })
      .then(function (result) {
        if (result.response.ok && result.data && result.data.ok) {
          form.reset();
          var required = form.querySelector('input[name="legal-consent-required"]');
          if (required) required.checked = false;
          setFormStatus(form, "ok", "");
          return;
        }
        var err = result.data && result.data.error ? result.data.error : "unknown";
        if (err === "mail_failed" || err === "domain_not_verified") {
          setFormStatus(
            form,
            "error",
            "No se pudo enviar el correo desde el servidor. Llama al +34 655 214 080 o escribe a cvpalmanord@cvpalmanord.es."
          );
          return;
        }
        if (err === "form_not_configured") {
          setFormStatus(
            form,
            "error",
            "Error de configuracion en el servidor. Contacta con la clinica por telefono o email."
          );
          return;
        }
        if (err === "invalid_email" || err === "invalid_phone" || err === "missing_required_fields") {
          setFormStatus(
            form,
            "error",
            "Revisa los datos del formulario (nombre, email, telefono y datos de la mascota)."
          );
          return;
        }
        if (err === "rate_limited") {
          setFormStatus(form, "error", "Has enviado demasiadas solicitudes. Espera unos minutos e intentalo de nuevo.");
          return;
        }
        setFormStatus(
          form,
          "error",
          "No se pudo completar el envio (codigo " + result.response.status + "). Intentalo de nuevo o contactanos por telefono."
        );
      })
      .catch(function () {
        setFormStatus(
          form,
          "error",
          "Error de conexion. Comprueba tu internet o llama al +34 655 214 080."
        );
      });
  }

  function setupFormConsent() {
    var forms = doc.querySelectorAll("form.wpcf7-form");
    for (var i = 0; i < forms.length; i += 1) {
      var form = forms[i];
      if (form.id === "quote-form") continue;
      if (form.querySelector(".legal-consent")) continue;

      var box = doc.createElement("div");
      box.className = "legal-consent";
      box.innerHTML =
        '<p class="legal-inline-notice"><strong>Información básica sobre Protección de Datos</strong><br>' +
        "Responsable: Clinica Veterinaria Palmanord.<br>" +
        "Finalidad: gestionar tu consulta y/o solicitud de cita o presupuesto.<br>" +
        "Legitimación: consentimiento del interesado.<br>" +
        "Destinatarios: no se cederan datos a terceros, salvo obligacion legal.<br>" +
        'Derechos: acceso, rectificacion, supresion y otros, segun informacion adicional en el <a href="/legal/aviso-legal-y-privacidad/" target="_blank" rel="noopener noreferrer">Aviso legal y politica de privacidad</a>.</p>' +
        '<label class="hp-field" aria-hidden="true"><span>Deja este campo vacio</span><input type="text" name="website" tabindex="-1" autocomplete="off"></label>' +
        '<label><input type="checkbox" name="legal-consent-required" value="1"> <span>He leido y acepto las condiciones (aviso legal y politica de privacidad).</span></label>' +
        '<label><input type="checkbox" name="legal-consent-marketing" value="1"> <span>Acepto recibir informacion comercial sobre promociones, productos y servicios.</span></label>' +
        '<div class="legal-consent-error">No puedes enviar la solicitud sin aceptar el aviso legal y politica de privacidad.</div>';

      var submit = form.querySelector('input[type="submit"], button[type="submit"]');
      if (submit && submit.parentNode) {
        submit.parentNode.parentNode.insertBefore(box, submit.parentNode);
      } else {
        form.appendChild(box);
      }

      form.addEventListener(
        "submit",
        function (ev) {
          var wrap = ev.currentTarget.querySelector(".legal-consent");
          var required = ev.currentTarget.querySelector('input[name="legal-consent-required"]');
          if (form.classList.contains("quote-form-modern")) {
            if (!validateQuoteForm(form)) {
              ev.preventDefault();
              ev.stopPropagation();
              showQuoteErrorPage("Revisa los campos marcados e intentalo de nuevo.");
              return;
            }
          } else if (!required || !required.checked) {
            ev.preventDefault();
            ev.stopPropagation();
            if (wrap) wrap.classList.add("error");
            return;
          }
          if (form.classList.contains("wpcf7-form")) {
            handleSecureFormSubmit(ev, form);
          }
        },
        true
      );

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

  function notifyConsentUpdated(consent) {
    try {
      window.dispatchEvent(
        new CustomEvent("cvpalmanord:consent-updated", { detail: consent || null })
      );
    } catch (e) {
      /* ignore */
    }
  }

  function applyConsent(consent) {
    if (!consent) return;
    if (consent.analytics) loadGoogleAnalytics();
    notifyConsentUpdated(consent);
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
        notifyConsentUpdated(reject);
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
  fixPresupuestoEmails();
  setupQuoteForm();
  setupFormConsent();
  renderCookieUI();
  setupProgressFallback();
  setupCarouselFallback();
  applyConsent(getConsent());
})();

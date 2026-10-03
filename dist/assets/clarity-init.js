/**
 * Microsoft Clarity — unica fuente de verdad (pageviews / sesiones / heatmaps / recordings).
 * No carga nada si falta CLARITY_PROJECT_ID o no hay consentimiento analitico.
 * Sin eventos custom.
 */
(function () {
  if (window.__cvClarityBooted__) return;
  window.__cvClarityBooted__ = true;

  var STORAGE_KEY = "cvpalmanord_cookie_consent_v1";
  var CONFIG_URL = "/api/clarity-config";

  function getConsent() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function hasAnalyticsConsent() {
    var consent = getConsent();
    return !!(consent && consent.analytics);
  }

  function isValidProjectId(id) {
    return typeof id === "string" && /^[A-Za-z0-9]+$/.test(id);
  }

  function injectOfficialSnippet(projectId) {
    if (window.__cvClarityInited__) return;
    window.__cvClarityInited__ = true;

    /* Official Microsoft Clarity snippet */
    (function (c, l, a, r, i, t, y) {
      c[a] =
        c[a] ||
        function () {
          (c[a].q = c[a].q || []).push(arguments);
        };
      t = l.createElement(r);
      t.async = 1;
      t.src = "https://www.clarity.ms/tag/" + i;
      y = l.getElementsByTagName(r)[0];
      y.parentNode.insertBefore(t, y);
    })(window, document, "clarity", "script", projectId);
  }

  function fetchConfig() {
    return fetch(CONFIG_URL, {
      credentials: "same-origin",
      headers: { Accept: "application/json" }
    }).then(function (res) {
      if (!res.ok) return null;
      return res.json();
    });
  }

  function syncWithConsent() {
    if (!hasAnalyticsConsent()) return;
    fetchConfig()
      .then(function (config) {
        var id = config && config.projectId;
        if (!isValidProjectId(id)) return;
        injectOfficialSnippet(id);
      })
      .catch(function () {
        /* No romper la web si falla la config */
      });
  }

  window.addEventListener("cvpalmanord:consent-updated", syncWithConsent);
  syncWithConsent();
})();

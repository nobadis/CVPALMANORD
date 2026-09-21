"use strict";

const http = require("http");
const path = require("path");
const { URL } = require("url");
const serveHandler = require("serve-handler");

const SITE_DIR = path.join(__dirname, "site");
const PORT = Number.parseInt(process.env.PORT || "3000", 10) || 3000;
const HOST = "0.0.0.0";

const CLARITY_PROJECT_ID = (process.env.CLARITY_PROJECT_ID || "").trim();
// Formspree: https://formspree.io/f/xxxxxxxx  → llega a cvpalmanord@cvpalmanord.es
const FORM_ENDPOINT = (process.env.FORM_ENDPOINT || "").trim();

const MAX_BODY_BYTES = 16 * 1024;
const BLOCKED_PATH =
  /^\/(?:wp-admin|wp-login\.php|xmlrpc\.php|\.env|\.git|node_modules)(?:\/|$)/i;

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 12;
const rateBuckets = new Map();

const SECURITY_HEADERS = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-site",
  "Content-Security-Policy": [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.clarity.ms https://scripts.clarity.ms",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://region1.google-analytics.com https://www.googletagmanager.com https://*.clarity.ms https://c.bing.com",
    "worker-src 'self' blob: data:",
    "frame-src 'self' https://www.google.com https://maps.google.com https://www.google.es",
    "upgrade-insecure-requests"
  ].join("; ")
};

const SERVE_CONFIG = {
  public: SITE_DIR,
  directoryListing: false,
  symlinks: false,
  trailingSlash: true,
  cleanUrls: true,
  headers: [
    {
      source: "**/*",
      headers: Object.entries(SECURITY_HEADERS).map(function (entry) {
        return { key: entry[0], value: entry[1] };
      })
    }
  ],
  redirects: [
    { source: "/wp-admin", destination: "/", permanent: false },
    { source: "/wp-admin/**", destination: "/", permanent: false },
    { source: "/wp-login.php", destination: "/", permanent: false },
    { source: "/xmlrpc.php", destination: "/", permanent: false }
  ]
};

function isFormConfigured() {
  if (!FORM_ENDPOINT) return false;
  try {
    var u = new URL(FORM_ENDPOINT);
    return u.protocol === "https:";
  } catch (e) {
    return false;
  }
}

function applySecurityHeaders(res) {
  for (var key in SECURITY_HEADERS) {
    if (Object.prototype.hasOwnProperty.call(SECURITY_HEADERS, key)) {
      res.setHeader(key, SECURITY_HEADERS[key]);
    }
  }
}

function getClientIp(req) {
  var forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "unknown";
}

function isRateLimited(ip) {
  var now = Date.now();
  var bucket = rateBuckets.get(ip);
  if (!bucket || now - bucket.start > RATE_LIMIT_WINDOW_MS) {
    rateBuckets.set(ip, { start: now, count: 1 });
    return false;
  }
  bucket.count += 1;
  if (bucket.count > RATE_LIMIT_MAX) return true;
  return false;
}

function readJsonBody(req) {
  return new Promise(function (resolve, reject) {
    var chunks = [];
    var total = 0;
    req.on("data", function (chunk) {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        reject(new Error("payload_too_large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", function () {
      try {
        var raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(new Error("invalid_json"));
      }
    });
    req.on("error", reject);
  });
}

function sanitizeText(value, maxLen) {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxLen);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

function isValidPhone(value) {
  return String(value).replace(/\D/g, "").length >= 8;
}

function validateContactPayload(body) {
  if (!body || typeof body !== "object") return { ok: false, error: "invalid_body" };
  if (body.website || body.url || body._gotcha) {
    return { ok: false, error: "spam_detected" };
  }

  var payload = {
    name: sanitizeText(body.name || body["your-name"], 120),
    email: sanitizeText(body.email || body["your-email"], 254),
    phone: sanitizeText(body.phone || body["your-phone"], 40),
    animalName: sanitizeText(body.animalName || body["your-animal-name"], 120),
    animalRace: sanitizeText(body.animalRace || body["your-animal-race"], 120),
    animalWeight: sanitizeText(
      body.animalWeight || body["your-animal-weight"],
      40
    ),
    message: sanitizeText(body.message || body["your-message"], 4000),
    marketing: !!(body.marketing || body["legal-consent-marketing"]),
    source: sanitizeText(body.source, 80) || "presupuesto"
  };

  if (
    !payload.name ||
    !payload.email ||
    !payload.phone ||
    !payload.animalName ||
    !payload.animalRace ||
    !payload.animalWeight
  ) {
    return { ok: false, error: "missing_required_fields" };
  }
  if (!isValidEmail(payload.email)) {
    return { ok: false, error: "invalid_email" };
  }
  if (!isValidPhone(payload.phone)) {
    return { ok: false, error: "invalid_phone" };
  }

  return { ok: true, payload: payload };
}

async function forwardToFormspree(payload) {
  if (!isFormConfigured()) {
    return { ok: false, status: 503, error: "form_not_configured" };
  }

  var response;
  try {
    response = await fetch(FORM_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        _subject: "[Presupuesto web] " + payload.name,
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        animalName: payload.animalName,
        animalRace: payload.animalRace,
        animalWeight: payload.animalWeight,
        message: payload.message || "(sin mensaje)",
        marketing: payload.marketing ? "Si" : "No",
        source: payload.source,
        _replyto: payload.email
      }),
      signal: AbortSignal.timeout(15000)
    });
  } catch (e) {
    console.error("Formspree network error:", e && e.message ? e.message : e);
    return { ok: false, status: 502, error: "mail_failed" };
  }

  if (!response.ok) {
    var detail = "";
    try {
      detail = await response.text();
    } catch (e) {
      detail = "";
    }
    console.error("Formspree rejected:", response.status, detail.slice(0, 300));
    return { ok: false, status: 502, error: "mail_failed" };
  }

  return { ok: true, status: 200 };
}

async function handleContactApi(req, res) {
  applySecurityHeaders(res);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "GET") {
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true, configured: isFormConfigured() }));
    return;
  }

  if (req.method !== "POST") {
    res.writeHead(405);
    res.end(JSON.stringify({ ok: false, error: "method_not_allowed" }));
    return;
  }

  var ip = getClientIp(req);
  if (isRateLimited(ip)) {
    res.writeHead(429);
    res.end(JSON.stringify({ ok: false, error: "rate_limited" }));
    return;
  }

  var body;
  try {
    body = await readJsonBody(req);
  } catch (e) {
    var code = e && e.message === "payload_too_large" ? 413 : 400;
    res.writeHead(code);
    res.end(JSON.stringify({ ok: false, error: e.message || "bad_request" }));
    return;
  }

  var validated = validateContactPayload(body);
  if (!validated.ok) {
    var status = validated.error === "spam_detected" ? 400 : 422;
    res.writeHead(status);
    res.end(JSON.stringify({ ok: false, error: validated.error }));
    return;
  }

  var result = await forwardToFormspree(validated.payload);
  res.writeHead(result.status || (result.ok ? 200 : 500));
  res.end(JSON.stringify({ ok: result.ok, error: result.error || null }));
}

const server = http.createServer(async function (req, res) {
  var pathname = "/";
  try {
    pathname = new URL(req.url || "/", "http://localhost").pathname;
  } catch (e) {
    res.writeHead(400);
    res.end("Bad Request");
    return;
  }

  if (BLOCKED_PATH.test(pathname)) {
    applySecurityHeaders(res);
    res.writeHead(404);
    res.end("Not Found");
    return;
  }

  if (pathname === "/api/contact" || pathname === "/api/contact.php") {
    await handleContactApi(req, res);
    return;
  }

  if (pathname === "/api/health") {
    applySecurityHeaders(res);
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(
      JSON.stringify({
        ok: true,
        formConfigured: isFormConfigured()
      })
    );
    return;
  }

  if (pathname === "/api/clarity-config") {
    applySecurityHeaders(res);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.writeHead(200);
    var clarityId =
      /^[A-Za-z0-9]+$/.test(CLARITY_PROJECT_ID) ? CLARITY_PROJECT_ID : null;
    res.end(JSON.stringify({ projectId: clarityId }));
    return;
  }

  await serveHandler(req, res, SERVE_CONFIG);
});

server.listen(PORT, HOST, function () {
  console.log(
    "CV Palmanord static server listening on http://" + HOST + ":" + PORT
  );
  if (!isFormConfigured()) {
    console.warn(
      "FORM_ENDPOINT no configurada: crea un form en Formspree y pon FORM_ENDPOINT=https://formspree.io/f/xxxx en Railway."
    );
  } else {
    console.log("Formulario listo via FORM_ENDPOINT");
  }
  if (!CLARITY_PROJECT_ID) {
    console.warn(
      "CLARITY_PROJECT_ID no configurada: Microsoft Clarity no se cargara en el cliente."
    );
  }
});

function shutdown(signal) {
  console.log("Recibida " + signal + ", cerrando servidor...");
  server.close(function () {
    process.exit(0);
  });
  setTimeout(function () {
    process.exit(1);
  }, 10000).unref();
}

process.on("SIGTERM", function () {
  shutdown("SIGTERM");
});
process.on("SIGINT", function () {
  shutdown("SIGINT");
});

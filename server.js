"use strict";

const http = require("http");
const path = require("path");
const { URL } = require("url");
const serveHandler = require("serve-handler");

const SITE_DIR = path.join(__dirname, "site");
const PORT = Number.parseInt(process.env.PORT || "3000", 10) || 3000;
const HOST = "0.0.0.0";

const CLARITY_PROJECT_ID = (process.env.CLARITY_PROJECT_ID || "").trim();

// Resend: unica via fiable desde Railway para From=dominio propio + no-spam.
const RESEND_API_KEY = String(process.env.RESEND_API_KEY || "").trim();
const MAIL_TO = (process.env.MAIL_TO || "cvpalmanord@cvpalmanord.es").trim();
const MAIL_FROM_EMAIL = (
  process.env.MAIL_FROM || "cvpalmanord@cvpalmanord.es"
).trim();
const MAIL_FROM_NAME = (
  process.env.MAIL_FROM_NAME || "Clinica Veterinaria Palmanord"
).trim();
const SITE_URL = (process.env.SITE_URL || "https://cvpalmanord.es").replace(
  /\/$/,
  ""
);
const SEND_CLIENT_COPY =
  String(process.env.SEND_CLIENT_COPY || "true").trim().toLowerCase() !==
  "false";

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

function isMailConfigured() {
  return RESEND_API_KEY.length > 10;
}

function fromHeader() {
  return (
    '"' + MAIL_FROM_NAME.replace(/"/g, "") + '" <' + MAIL_FROM_EMAIL + ">"
  );
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

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

function buildStaffText(payload) {
  return [
    "Nueva solicitud de presupuesto web",
    "",
    "Nombre: " + payload.name,
    "Email: " + payload.email,
    "Telefono: " + payload.phone,
    "Mascota: " + payload.animalName,
    "Especie/raza: " + payload.animalRace,
    "Peso: " + payload.animalWeight,
    "Mensaje: " + (payload.message || "(sin mensaje)"),
    "Marketing: " + (payload.marketing ? "Si" : "No"),
    "Origen: " + payload.source,
    "Fecha: " + new Date().toISOString()
  ].join("\n");
}

function buildStaffHtml(payload) {
  function row(label, value) {
    return (
      "<tr><td style=\"padding:8px 0;color:#64748b;width:140px;\">" +
      escapeHtml(label) +
      '</td><td style="padding:8px 0;color:#263246;"><strong>' +
      escapeHtml(value) +
      "</strong></td></tr>"
    );
  }
  return (
    '<!DOCTYPE html><html lang="es"><body style="font-family:Arial,sans-serif;background:#f7f9fb;color:#263246;padding:20px;">' +
    '<table width="100%" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e5e5;">' +
    '<tr><td style="background:#263246;color:#fff;padding:16px 20px;font-size:18px;">Nueva solicitud de presupuesto</td></tr>' +
    '<tr><td style="padding:20px;"><table width="100%">' +
    row("Nombre", payload.name) +
    row("Email", payload.email) +
    row("Telefono", payload.phone) +
    row("Mascota", payload.animalName) +
    row("Especie/raza", payload.animalRace) +
    row("Peso", payload.animalWeight) +
    row("Marketing", payload.marketing ? "Si" : "No") +
    row("Origen", payload.source) +
    "</table>" +
    '<p style="margin-top:16px;"><strong>Mensaje</strong><br>' +
    (payload.message
      ? escapeHtml(payload.message).replace(/\n/g, "<br>")
      : "(sin mensaje)") +
    "</p>" +
    '<p style="font-size:12px;color:#94a3b8;margin-top:20px;">Responde a este correo para contactar al cliente (Reply-To).</p>' +
    "</td></tr></table></body></html>"
  );
}

function buildClientHtml(payload) {
  var logo =
    SITE_URL + "/wp-content/uploads/2021/11/logo_palmanord_blusa.png";
  var msg = payload.message
    ? escapeHtml(payload.message).replace(/\n/g, "<br>")
    : "Sin mensaje adicional";
  return (
    '<!DOCTYPE html><html lang="es"><body style="font-family:Arial,sans-serif;background:#f7f9fb;color:#263246;padding:20px;">' +
    '<table width="100%" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e5e5;"><tr><td style="background:#263246;padding:20px;text-align:center;">' +
    '<img src="' +
    escapeHtml(logo) +
    '" alt="Palmanord" width="100" style="display:block;margin:0 auto 8px;"></td></tr>' +
    '<tr><td style="padding:24px;"><h1 style="margin:0 0 12px;font-size:22px;">Gracias, ' +
    escapeHtml(payload.name) +
    "</h1>" +
    "<p>Hemos recibido tu solicitud. <strong>Te contactaremos muy pronto</strong>.</p>" +
    '<p style="font-size:14px;color:#64748b;">Urgencias: <a href="tel:+34655214080">+34 655 214 080</a></p>' +
    '<hr style="border:none;border-top:1px solid #e5e5e5;margin:16px 0;">' +
    "<p><strong>Resumen:</strong><br>Telefono: " +
    escapeHtml(payload.phone) +
    "<br>Mascota: " +
    escapeHtml(payload.animalName) +
    " (" +
    escapeHtml(payload.animalRace) +
    ", " +
    escapeHtml(payload.animalWeight) +
    ")<br>" +
    msg +
    "</p>" +
    '<p style="text-align:center;margin-top:20px;"><a href="' +
    escapeHtml(SITE_URL) +
    '" style="background:#d83a3a;color:#fff;padding:10px 18px;text-decoration:none;border-radius:6px;">Visitar web</a></p>' +
    "</td></tr></table></body></html>"
  );
}

async function resendSend(mail) {
  var response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + RESEND_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(mail),
    signal: AbortSignal.timeout(15000)
  });

  var bodyText = "";
  try {
    bodyText = await response.text();
  } catch (e) {
    bodyText = "";
  }

  if (!response.ok) {
    console.error("Resend error:", response.status, bodyText.slice(0, 400));
    var lower = bodyText.toLowerCase();
    if (
      response.status === 403 ||
      lower.indexOf("domain") !== -1 ||
      lower.indexOf("not verified") !== -1
    ) {
      return { ok: false, error: "domain_not_verified" };
    }
    return { ok: false, error: "mail_failed" };
  }
  return { ok: true };
}

async function sendContactEmail(payload) {
  if (!isMailConfigured()) {
    return { ok: false, status: 503, error: "form_not_configured" };
  }

  var staff = await resendSend({
    from: fromHeader(),
    to: [MAIL_TO],
    reply_to: payload.email,
    subject: "[Presupuesto web] " + payload.name,
    text: buildStaffText(payload),
    html: buildStaffHtml(payload)
  });

  if (!staff.ok) {
    return {
      ok: false,
      status: staff.error === "domain_not_verified" ? 503 : 502,
      error: staff.error || "mail_failed"
    };
  }

  if (SEND_CLIENT_COPY) {
    var client = await resendSend({
      from: fromHeader(),
      to: [payload.email],
      reply_to: MAIL_TO,
      subject: "Gracias por contactar - Clinica Veterinaria Palmanord",
      text:
        "Gracias, " +
        payload.name +
        ".\n\nHemos recibido tu solicitud y te contactaremos muy pronto.\nUrgencias: +34 655 214 080\n",
      html: buildClientHtml(payload)
    });
    if (!client.ok) {
      console.error("Resend client copy failed:", client.error);
    }
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
    res.end(
      JSON.stringify({
        ok: true,
        configured: isMailConfigured(),
        from: MAIL_FROM_EMAIL,
        to: MAIL_TO
      })
    );
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

  var result = await sendContactEmail(validated.payload);
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
        formConfigured: isMailConfigured(),
        mailFrom: MAIL_FROM_EMAIL,
        mailTo: MAIL_TO
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
  if (!isMailConfigured()) {
    console.warn(
      "RESEND_API_KEY no configurada: el formulario no enviara correo hasta definirla en Railway (dominio verificado en Resend)."
    );
  } else {
    console.log(
      "Formulario listo via Resend: " + MAIL_FROM_EMAIL + " -> " + MAIL_TO
    );
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

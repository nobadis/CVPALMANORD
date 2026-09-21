"use strict";

const http = require("http");
const path = require("path");
const { URL } = require("url");
const nodemailer = require("nodemailer");
const serveHandler = require("serve-handler");

const SITE_DIR = path.join(__dirname, "site");
const PORT = Number.parseInt(process.env.PORT || "3000", 10) || 3000;
const HOST = "0.0.0.0";

const CLARITY_PROJECT_ID = (process.env.CLARITY_PROJECT_ID || "").trim();

const MAIL_TO = (process.env.MAIL_TO || "cvpalmanord@cvpalmanord.es").trim();
const MAIL_FROM = (process.env.MAIL_FROM || "cvpalmanord@cvpalmanord.es").trim();
const MAIL_FROM_NAME = (
  process.env.MAIL_FROM_NAME || "Clinica Veterinaria Palmanord"
).trim();
const SITE_URL = (process.env.SITE_URL || "https://cvpalmanord.es").replace(
  /\/$/,
  ""
);
const SEND_CLIENT_COPY = String(process.env.SEND_CLIENT_COPY || "true")
  .trim()
  .toLowerCase() !== "false";

// Defaults = panel Dinahosting (SMTPS 465). En Railway solo hace falta SMTP_PASS.
const SMTP_HOST = (
  process.env.SMTP_HOST || "cvpalmanord-es.correoseguro.dinaserver.com"
).trim();
const SMTP_PORT = Number.parseInt(process.env.SMTP_PORT || "465", 10) || 465;
const SMTP_USER = (
  process.env.SMTP_USER || "cvpalmanord@cvpalmanord.es"
).trim();
// Trim evita fallos por espacios/saltos al pegar la contraseña en Railway.
const SMTP_PASS = String(process.env.SMTP_PASS || "").trim();
const SMTP_SECURE =
  String(process.env.SMTP_SECURE || (SMTP_PORT === 465 ? "true" : "false"))
    .trim()
    .toLowerCase() !== "false";

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

var mailTransportPrimary = null;
var mailTransportFallback = null;
var lastSmtpErrorCode = null;

function isSmtpConfigured() {
  return !!(SMTP_HOST && SMTP_USER && SMTP_PASS && MAIL_TO && MAIL_FROM);
}

function createSmtpTransport(port, secure) {
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: port,
    secure: secure,
    requireTLS: !secure,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    },
    authMethod: "LOGIN",
    tls: {
      minVersion: "TLSv1.2",
      servername: SMTP_HOST
    },
    connectionTimeout: 12000,
    greetingTimeout: 12000,
    socketTimeout: 20000
  });
}

function getPrimaryTransport() {
  if (!isSmtpConfigured()) return null;
  if (!mailTransportPrimary) {
    mailTransportPrimary = createSmtpTransport(SMTP_PORT, SMTP_SECURE);
  }
  return mailTransportPrimary;
}

function getFallbackTransport() {
  if (!isSmtpConfigured()) return null;
  // Si el primario ya es 587, no hay fallback distinto.
  if (SMTP_PORT === 587 && !SMTP_SECURE) return null;
  if (!mailTransportFallback) {
    mailTransportFallback = createSmtpTransport(587, false);
  }
  return mailTransportFallback;
}

function classifySmtpError(err) {
  var code = String((err && (err.code || err.responseCode)) || "").toUpperCase();
  var msg = String((err && err.message) || "").toLowerCase();
  if (
    code === "EAUTH" ||
    code === "535" ||
    code === "534" ||
    msg.indexOf("invalid login") !== -1 ||
    msg.indexOf("authentication failed") !== -1 ||
    msg.indexOf("username and password not accepted") !== -1
  ) {
    return "smtp_auth_failed";
  }
  if (
    code === "ESOCKET" ||
    code === "ECONNECTION" ||
    code === "ETIMEDOUT" ||
    code === "ECONNREFUSED" ||
    code === "EENVELOPE" ||
    msg.indexOf("connect") !== -1 ||
    msg.indexOf("timeout") !== -1
  ) {
    return "smtp_unreachable";
  }
  return "mail_failed";
}

async function sendMailReliable(mailOptions) {
  var primary = getPrimaryTransport();
  if (!primary) {
    return { ok: false, status: 503, error: "form_not_configured" };
  }

  try {
    await primary.sendMail(mailOptions);
    lastSmtpErrorCode = null;
    return { ok: true };
  } catch (firstErr) {
    lastSmtpErrorCode = classifySmtpError(firstErr);
    console.error(
      "SMTP primary failed (" +
        SMTP_HOST +
        ":" +
        SMTP_PORT +
        "):",
      firstErr && firstErr.code ? firstErr.code : "",
      firstErr && firstErr.message ? firstErr.message : firstErr
    );

    var fallback = getFallbackTransport();
    if (!fallback) {
      return { ok: false, status: 502, error: lastSmtpErrorCode };
    }

    try {
      await fallback.sendMail(mailOptions);
      lastSmtpErrorCode = null;
      console.warn("SMTP fallback 587 STARTTLS succeeded after primary failure.");
      return { ok: true };
    } catch (secondErr) {
      lastSmtpErrorCode = classifySmtpError(secondErr);
      console.error(
        "SMTP fallback failed (587):",
        secondErr && secondErr.code ? secondErr.code : "",
        secondErr && secondErr.message ? secondErr.message : secondErr
      );
      return { ok: false, status: 502, error: lastSmtpErrorCode };
    }
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
    "Nueva solicitud web",
    "",
    "Nombre: " + payload.name,
    "Email: " + payload.email,
    "Telefono: " + payload.phone,
    "Mascota: " + payload.animalName,
    "Raza: " + payload.animalRace,
    "Peso: " + payload.animalWeight,
    "Mensaje: " + (payload.message || "(sin mensaje)"),
    "Marketing: " + (payload.marketing ? "Si" : "No"),
    "Origen: " + payload.source,
    "Fecha: " + new Date().toISOString()
  ].join("\n");
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

async function sendContactEmail(payload) {
  if (!isSmtpConfigured()) {
    return { ok: false, status: 503, error: "form_not_configured" };
  }

  var fromHeader = '"' + MAIL_FROM_NAME.replace(/"/g, "") + '" <' + MAIL_FROM + ">";
  var subject = "[Presupuesto web] " + payload.name;

  var staffResult = await sendMailReliable({
    from: fromHeader,
    to: MAIL_TO,
    replyTo: payload.email,
    subject: subject,
    text: buildStaffText(payload)
  });

  if (!staffResult.ok) {
    return {
      ok: false,
      status: staffResult.status || 502,
      error: staffResult.error || "mail_failed"
    };
  }

  if (SEND_CLIENT_COPY) {
    var clientResult = await sendMailReliable({
      from: fromHeader,
      to: payload.email,
      replyTo: MAIL_TO,
      subject: "Gracias por contactar - Clinica Veterinaria Palmanord",
      html: buildClientHtml(payload),
      text:
        "Gracias, " +
        payload.name +
        ".\n\nHemos recibido tu solicitud y te contactaremos muy pronto.\nUrgencias: +34 655 214 080\n"
    });
    if (!clientResult.ok) {
      // La clinica ya tiene el aviso; no fallar el envio principal.
      console.error(
        "SMTP client copy failed:",
        clientResult.error || "mail_failed"
      );
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
        configured: isSmtpConfigured()
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
        mailConfigured: isSmtpConfigured(),
        smtpHost: SMTP_HOST,
        smtpPort: SMTP_PORT,
        mailTo: MAIL_TO,
        lastSmtpError: lastSmtpErrorCode
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
  if (!isSmtpConfigured()) {
    console.warn(
      "SMTP_PASS no configurada: el formulario no enviara correo hasta definir SMTP_PASS en Railway."
    );
  } else {
    console.log(
      "Correo del formulario: " +
        MAIL_FROM +
        " -> " +
        MAIL_TO +
        " via " +
        SMTP_HOST +
        ":" +
        SMTP_PORT
    );
    var transport = getPrimaryTransport();
    if (transport) {
      transport.verify().then(
        function () {
          console.log("SMTP verify OK (" + SMTP_HOST + ":" + SMTP_PORT + ")");
        },
        function (err) {
          lastSmtpErrorCode = classifySmtpError(err);
          console.error(
            "SMTP verify FAILED:",
            err && err.code ? err.code : "",
            err && err.message ? err.message : err
          );
        }
      );
    }
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

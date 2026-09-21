# Clon estatico de CV Palmanord

Este proyecto contiene una copia estatica de `https://cvpalmanord.es` con las mismas paginas principales y assets (imagenes, CSS, JS, fuentes), lista para desplegar en Railway sin WordPress.

## Estructura

- `site/`: sitio clonado listo para servir.
- `clone_site.py`: script de clonado para regenerar la copia cuando quieras actualizar contenido.
- `package.json`: arranque del servidor seguro para Railway.
- `server.js`: servidor estatico con cabeceras de seguridad, limitacion de peticiones y API de formularios.
- `site/serve.json`: cabeceras y redirecciones si se usa `npm run start:legacy`.

## Ejecutar en local

```bash
npm install
npm start
```

El sitio se sirve en `http://localhost:3000` (o en el puerto definido por `PORT`).

## Despliegue en Railway

1. Sube este proyecto a un repositorio Git (**incluye** `server.js`, `railway.toml`, `nixpacks.toml` y `site/`).
2. Crea un nuevo proyecto en Railway y conecta ese repositorio.
3. Railway usa Nixpacks (Node 20), detecta `package.json` y arranca con `npm start`.
4. Healthcheck automatico en `/api/health` (definido en `railway.toml`).
5. Configura variables de entorno (ver tabla abajo). Minimo: `FORM_ENDPOINT` (Formspree) y opcional `CLARITY_PROJECT_ID`.

El servidor escucha en `0.0.0.0:$PORT` (requerido por Railway).

## Seguridad

Medidas aplicadas en este repositorio:

- Cabeceras HTTP endurecidas (HSTS, CSP, `X-Frame-Options`, `nosniff`, etc.) via `server.js` y `site/serve.json`.
- Bloqueo de rutas tipicas de WordPress (`/wp-admin`, `/wp-login.php`, `/xmlrpc.php`).
- Listado de directorios desactivado y enlaces simbolicos no servidos.
- Limitacion de peticiones al endpoint `/api/contact` (anti-abuso / spam).
- Validacion y saneamiento de datos del formulario en servidor.
- Campo honeypot anti-bots en formularios.
- Google Analytics solo tras consentimiento de cookies.
- Fichero `site/.well-known/security.txt` para reporte responsable de vulnerabilidades.

### Variables de entorno (Railway)

Copia `.env.example` y configura:

| Variable | Obligatoria | Descripcion |
| --- | --- | --- |
| `PORT` | No (Railway la define) | Puerto HTTP del servidor |
| `FORM_ENDPOINT` | Si (formulario) | URL Formspree `https://formspree.io/f/xxxxxxxx` |
| `CLARITY_PROJECT_ID` | No | Project ID de Microsoft Clarity (`…/tag/XXXX`) |

El SMTP de Dinahosting **no es alcanzable desde Railway**. La via mas simple es Formspree: el correo llega a `cvpalmanord@cvpalmanord.es`. Sin `FORM_ENDPOINT`, el formulario responde `form_not_configured`.

### Comprobaciones recomendadas tras desplegar

1. Visitar `https://tu-dominio/.well-known/security.txt`.
2. Probar el formulario en `/pide-tu-presupuesto/`.
3. Revisar cabeceras con [securityheaders.com](https://securityheaders.com).
4. Ejecutar `npm run audit:deps` antes de cada release.

Ninguna web es 100% invulnerable; el objetivo es reducir superficie de ataque y riesgos habituales (XSS, clickjacking, abuso de formularios, rutas WP obsoletas).

## Despliegue en Dinahosting (PHP 7.4)

1. Sube el **contenido de `site/`** a `www/` (incluye `.htaccess` y `api/`).
2. En el servidor, copia `api/contact-config.php.example` a `api/contact-config.php`.
3. Edita `contact-config.php` con los correos reales del dominio (`info@...`, `noreply@...`).
4. Prueba el formulario en `/pide-tu-presupuesto/`.

El formulario envia a `api/contact.php` (tambien accesible como `/api/contact` gracias al `.htaccess`).

## Deploy directo con Railway CLI (alternativa rapida)

```bash
# 1) Login
npx @railway/cli login

# 2) Crear o vincular proyecto
npx @railway/cli init

# 3) Deploy
npx @railway/cli up
```

Si quieres usar token en vez de login interactivo:

```bash
export RAILWAY_TOKEN="tu_token_railway"
npx @railway/cli whoami
npx @railway/cli init
npx @railway/cli up
```

## Checklist final de cumplimiento (produccion)

- [x] Aviso legal y politica de privacidad publicados en `/legal/aviso-legal-y-privacidad/`.
- [x] Politica de cookies publicada en `/legal/politica-cookies/`.
- [x] Enlaces legales visibles en footer de la web.
- [x] Banner de cookies con botones **Aceptar**, **Rechazar** y **Configurar**.
- [x] Cookies no necesarias desactivadas por defecto.
- [x] Panel para reconfigurar cookies en cualquier momento (`boton "Cookies"`).
- [x] Formularios con informacion basica de proteccion de datos y checkbox obligatoria.
- [x] Checkbox comercial separada y opcional.
- [x] Navegacion limpia funcionando en rutas:
  - `/servicios/`
  - `/instalaciones/`
  - `/team/`
  - `/contact/`
  - `/pide-tu-presupuesto/`
- [x] Fotos extra de instalaciones incorporadas en carrusel.
- [ ] Confirmar si se desea publicar explicitamente numero de autorizacion sanitaria y/o numero colegial.

## Checklist final Railway

1. `npm install`
2. `PORT=3010 npm start` (prueba local; debe loguear `0.0.0.0:3010`)
3. `curl -s localhost:3010/api/health` → `{"ok":true}`
4. Commit y push (incluye `server.js` y `railway.toml` si aun no estan en el repo)
5. Conectar repo en Railway y definir variables de entorno
6. Verificar dominio Railway y despues dominio propio
7. Prueba funcional final:
   - Navegacion completa
   - `/api/clarity-config` (con `CLARITY_PROJECT_ID` → ID; sin ella → `null`)
   - `/api/health` → `formConfigured: true` cuando `FORM_ENDPOINT` esta definida
   - Formularios (incluyendo consentimiento RGPD)
   - Banner y configuracion de cookies
   - Paginas legales y enlaces de footer

## Regenerar clon (opcional)

Si hay cambios en la web original y quieres volver a clonarla:

```bash
python3 -m venv .venv
. .venv/bin/activate
python -m pip install beautifulsoup4 requests
python clone_site.py
```

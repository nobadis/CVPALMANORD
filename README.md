# Clon estatico de CV Palmanord

Este proyecto contiene una copia estatica de `https://cvpalmanord.es` con las mismas paginas principales y assets (imagenes, CSS, JS, fuentes), lista para desplegar en Railway sin WordPress.

## Estructura

- `site/`: sitio clonado listo para servir.
- `clone_site.py`: script de clonado para regenerar la copia cuando quieras actualizar contenido.
- `package.json`: arranque de servidor estatico para Railway.

## Ejecutar en local

```bash
npm install
npm start
```

El sitio se sirve en `http://localhost:3000` (o en el puerto definido por `PORT`).

## Despliegue en Railway

1. Sube este proyecto a un repositorio Git.
2. Crea un nuevo proyecto en Railway y conecta ese repositorio.
3. Railway detectara `package.json` y ejecutara `npm start`.
4. La web quedara publicada como sitio estatico.

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
2. `PORT=3010 npm start` (prueba local)
3. Commit y push del repositorio
4. Conectar repo en Railway
5. Verificar dominio Railway y despues dominio propio
6. Prueba funcional final:
   - Navegacion completa
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

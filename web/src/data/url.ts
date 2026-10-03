// Prefija rutas internas con el base de Astro ("/" por defecto).
const base = import.meta.env.BASE_URL.replace(/\/$/, "");

export function u(path: string): string {
  if (/^(https?:|tel:|mailto:|#)/.test(path)) return path;
  return base + (path.startsWith("/") ? path : "/" + path);
}

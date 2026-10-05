type Day = { dow: number; open: string | null; close: string | null; day: string };

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const base = import.meta.env.BASE_URL.replace(/\/$/, "");

let pageObservers: IntersectionObserver[] = [];
let pageCleanups: Array<() => void> = [];

/* ---------- Header (persistente entre paginas) ---------- */
// Los listeners son globales y delegados: funcionan aunque Astro sustituya
// o reutilice el <header> al navegar (transition:persist, atras/adelante...).
let headerBound = false;
let lastY = 0;

const getHeader = () => document.querySelector<HTMLElement>("[data-header]");

function setMenu(open: boolean) {
  const header = getHeader();
  const btn = header?.querySelector<HTMLButtonElement>("[data-menu-btn]");
  const menu = document.querySelector<HTMLElement>("[data-menu]");
  if (!header || !btn || !menu) return;
  menu.hidden = false;
  menu.classList.toggle("is-open", open);
  menu.toggleAttribute("inert", !open);
  header.classList.toggle("menu-open", open);
  document.documentElement.classList.toggle("menu-lock", open);
  btn.setAttribute("aria-expanded", String(open));
  const label = btn.querySelector(".sr-only");
  if (label) label.textContent = open ? "Cerrar menú" : "Abrir menú";
}
const isMenuOpen = () => !!document.querySelector("[data-menu].is-open");

function initHeader() {
  // Cada instancia del header se deja en estado cerrado y coherente
  setMenu(false);
  if (headerBound) return;
  headerBound = true;

  // Astro sustituye los atributos de <html> al navegar: sin esto se pierde la clase "js"
  document.addEventListener("astro:after-swap", () => document.documentElement.classList.add("js"));

  lastY = window.scrollY;
  const onScroll = () => {
    const header = getHeader();
    if (!header) return;
    const y = window.scrollY;
    header.classList.toggle("is-scrolled", y > 24);
    const goingDown = y > lastY + 4;
    const goingUp = y < lastY - 4;
    if (goingDown && y > 400 && !header.classList.contains("menu-open")) header.classList.add("is-hidden");
    if (goingUp || y < 200) header.classList.remove("is-hidden");
    lastY = y;
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  document.addEventListener("click", (e) => {
    const target = e.target as Element | null;
    if (!target) return;
    if (target.closest("[data-menu-btn]")) {
      setMenu(!isMenuOpen());
      return;
    }
    if (!isMenuOpen()) return;
    // Cualquier enlace del menu lo cierra (tambien el de la pagina actual,
    // donde no hay navegacion que lo cierre por nosotros)
    if (target.closest("[data-menu] a")) setMenu(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isMenuOpen()) {
      setMenu(false);
      getHeader()?.querySelector<HTMLButtonElement>("[data-menu-btn]")?.focus();
    }
  });
  // Si se agranda la ventana (rotar el movil) el menu no puede quedar abierto
  window.matchMedia("(min-width: 1081px)").addEventListener("change", (m) => {
    if (m.matches) setMenu(false);
  });
  document.addEventListener("astro:before-swap", () => setMenu(false));
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) setMenu(false);
  });
}

function syncNav() {
  const path = location.pathname.replace(new RegExp("^" + base), "") || "/";
  document.querySelectorAll<HTMLAnchorElement>("[data-nav]").forEach((a) => {
    const href = a.dataset.nav!;
    const active = href === "/" ? path === "/" : path.startsWith(href);
    if (active) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  const header = document.querySelector<HTMLElement>("[data-header]");
  header?.classList.remove("is-hidden");
  header?.classList.toggle("is-scrolled", window.scrollY > 24);
}

/* ---------- Abierto / cerrado ahora (hora de Palma) ---------- */
function madridNow() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { dow, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}
const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export function openState() {
  const schedule: Day[] = (window as any).__PALMANORD_SCHEDULE__ ?? [];
  const { dow, minutes } = madridNow();
  const today = schedule.find((d) => d.dow === dow);
  if (today?.open && today.close && minutes >= toMin(today.open) && minutes < toMin(today.close)) {
    return { open: true, dow, text: `Abierto · hasta las ${today.close}` };
  }
  // Siguiente apertura
  for (let i = 0; i < 8; i++) {
    const d = schedule.find((s) => s.dow === (dow + i) % 7);
    if (!d?.open) continue;
    if (i === 0 && minutes >= toMin(d.open)) continue;
    const when = i === 0 ? "hoy" : i === 1 ? "mañana" : d.day.toLowerCase();
    return { open: false, dow, text: `Cerrado · abrimos ${when} a las ${d.open}` };
  }
  return { open: false, dow, text: "Cerrado" };
}

function renderOpenStatus() {
  const st = openState();
  document.querySelectorAll<HTMLElement>("[data-open-status]").forEach((el) => {
    el.dataset.state = st.open ? "open" : "closed";
    const t = el.querySelector("[data-open-text]");
    if (t) t.textContent = el.dataset.short === "1" ? (st.open ? "Abierto ahora" : "Cerrado ahora") : st.text;
  });
  document.querySelectorAll<HTMLElement>("[data-dow]").forEach((row) => {
    row.classList.toggle("is-today", Number(row.dataset.dow) === st.dow);
  });
}

/* ---------- Animaciones de pagina ---------- */
function splitWords() {
  document.querySelectorAll<HTMLElement>("[data-split]:not([data-split-done])").forEach((el) => {
    el.dataset.splitDone = "1";
    let i = 0;
    const walk = (node: Node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment();
          (child.textContent ?? "").split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) {
              frag.append(document.createTextNode(" "));
              return;
            }
            const w = document.createElement("span");
            w.className = "w";
            const inner = document.createElement("span");
            inner.textContent = part;
            inner.style.setProperty("--i", String(i++));
            w.append(inner);
            frag.append(w);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === Node.ELEMENT_NODE && !(child as Element).matches("br")) {
          walk(child);
        }
      });
    };
    walk(el);
    el.setAttribute("aria-label", el.textContent?.replace(/\s+/g, " ").trim() ?? "");
  });
}

function reveal() {
  const els = document.querySelectorAll<HTMLElement>("[data-reveal], [data-split]");
  if (reduced() || !("IntersectionObserver" in window)) {
    els.forEach((el) => el.classList.add("is-in"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        }
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
  );
  // Lo que ya esta en pantalla entra sin esperar al observer
  const vh = window.innerHeight;
  els.forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.top < vh && r.bottom > 0) el.classList.add("is-in");
    else io.observe(el);
  });
  pageObservers.push(io);
}

function counters() {
  const els = document.querySelectorAll<HTMLElement>("[data-count]");
  const run = (el: HTMLElement) => {
    const to = Number(el.dataset.count);
    const from = Number(el.dataset.from ?? 0);
    if (reduced()) {
      el.textContent = String(to);
      return;
    }
    const dur = 1600;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 4);
      el.textContent = String(Math.round(from + (to - from) * eased));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (e.isIntersecting) {
          run(e.target as HTMLElement);
          io.unobserve(e.target);
        }
      }),
    { threshold: 0.6 }
  );
  els.forEach((el) => io.observe(el));
  pageObservers.push(io);
}

// Brillo que sigue al cursor en botones y tarjetas (un calculo por frame)
function pointerGlow() {
  if (!window.matchMedia("(hover: hover)").matches) return;
  let raf = 0;
  let last: PointerEvent | null = null;
  const apply = () => {
    raf = 0;
    if (!last) return;
    const el = (last.target as Element).closest?.<HTMLElement>(".btn, [data-glow]");
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${last.clientX - r.left}px`);
    el.style.setProperty("--my", `${last.clientY - r.top}px`);
  };
  const handler = (e: PointerEvent) => {
    last = e;
    if (!raf) raf = requestAnimationFrame(apply);
  };
  document.addEventListener("pointermove", handler, { passive: true });
  pageCleanups.push(() => {
    document.removeEventListener("pointermove", handler);
    cancelAnimationFrame(raf);
  });
}

// Pausa las animaciones infinitas de lo que no esta en pantalla
function pauseOffscreen() {
  const els = document.querySelectorAll<HTMLElement>("[data-anim]");
  if (!els.length) return;
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => e.target.classList.toggle("anim-paused", !e.isIntersecting)),
    { rootMargin: "100px 0px" }
  );
  els.forEach((el) => io.observe(el));
  pageObservers.push(io);
}

// Parallax suave para elementos con data-parallax="0.1"
function parallax() {
  const els = Array.from(document.querySelectorAll<HTMLElement>("[data-parallax]"));
  if (!els.length || reduced()) return;
  let raf = 0;
  const update = () => {
    raf = 0;
    const vh = window.innerHeight;
    els.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) return;
      const speed = Number(el.dataset.parallax);
      const offset = (r.top + r.height / 2 - vh / 2) * speed;
      el.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`;
    });
  };
  const onScroll = () => {
    if (!raf) raf = requestAnimationFrame(update);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  update();
  pageCleanups.push(() => window.removeEventListener("scroll", onScroll));
}

export function initSite() {
  pageObservers.forEach((o) => o.disconnect());
  pageCleanups.forEach((fn) => fn());
  pageObservers = [];
  pageCleanups = [];

  initHeader();
  syncNav();
  renderOpenStatus();
  splitWords();
  reveal();
  counters();
  pointerGlow();
  pauseOffscreen();
  parallax();
}

export const clinic = {
  name: "Palmanord Clínica Veterinaria",
  short: "CV Palmanord",
  since: 2006,
  address: "Carrer dels Ocells, 36",
  city: "07011 Palma",
  email: "cvpalmanord@cvpalmanord.es",
  phone: { label: "971 45 25 92", href: "tel:+34971452592" },
  urgent: { label: "655 214 080", href: "tel:+34655214080" },
  mapsLink:
    "https://www.google.com/maps/search/?api=1&query=Carrer%20dels%20Ocells%2C%2036%2C%2007011%20Palma",
  mapsEmbed:
    "https://maps.google.com/maps?q=Carrer%20dels%20Ocells%2C%2036%2C%2007011%20Palma%2C%20Illes%20Balears&t=m&z=16&output=embed&iwloc=near"
};

// 0 = domingo. Horario de la clinica (las urgencias son 24h aparte).
export const schedule = [
  { day: "Lunes", short: "Lun", dow: 1, open: "10:00", close: "19:00" },
  { day: "Martes", short: "Mar", dow: 2, open: "10:00", close: "19:00" },
  { day: "Miércoles", short: "Mié", dow: 3, open: "10:00", close: "19:00" },
  { day: "Jueves", short: "Jue", dow: 4, open: "10:00", close: "19:00" },
  { day: "Viernes", short: "Vie", dow: 5, open: "10:00", close: "19:00" },
  { day: "Sábado", short: "Sáb", dow: 6, open: null, close: null },
  { day: "Domingo", short: "Dom", dow: 0, open: null, close: null }
];

export const nav = [
  { href: "/", label: "Inicio" },
  { href: "/servicios/", label: "Servicios" },
  { href: "/instalaciones/", label: "Instalaciones" },
  { href: "/equipo/", label: "Equipo" },
  { href: "/contacto/", label: "Contacto" }
];

export type Service = {
  id: string;
  icon: string;
  title: string;
  lead: string;
  body: string;
  featured?: boolean;
};

export const services: Service[] = [
  {
    id: "consulta",
    icon: "stethoscope",
    title: "Consulta general",
    lead: "Diagnóstico, tratamiento y prevención de todo tipo de patologías.",
    body: "Estamos en formación constante para diagnosticar y tratar las posibles enfermedades de tu mascota. Estudiamos cada caso de forma personalizada y contamos con las herramientas necesarias para hacer las pruebas complementarias.",
    featured: true
  },
  {
    id: "cirugia",
    icon: "scalpel",
    title: "Cirugía",
    lead: "Quirófano totalmente equipado y un equipo con gran experiencia.",
    body: "Realizamos todo tipo de intervenciones. Antes de cada cirugía evaluamos el caso con un estudio prequirúrgico para minimizar riesgos durante la intervención.",
    featured: true
  },
  {
    id: "preventiva",
    icon: "shield",
    title: "Medicina preventiva",
    lead: "Prevenir antes que curar, en cada etapa de su vida.",
    body: "Promovemos y preservamos la salud de tu animal, prevenimos posibles patologías y facilitamos un diagnóstico y tratamiento precoz antes de que la enfermedad le afecte."
  },
  {
    id: "vacunacion",
    icon: "syringe",
    title: "Vacunación",
    lead: "Su calendario de vacunas, al día y sin sustos.",
    body: "Vacunar pronto previene enfermedades graves en todas las etapas de su vida. Las vacunas protegen mucho cuando las aplica correctamente un profesional cualificado."
  },
  {
    id: "identificacion",
    icon: "chip",
    title: "Identificación",
    lead: "Microchip para encontrarle si se pierde.",
    body: "El marcaje electrónico es la mejor manera de proteger a tu mascota ante un extravío y localizarla, además de cumplir con la legislación vigente."
  },
  {
    id: "desparasitacion",
    icon: "bug",
    title: "Desparasitación",
    lead: "Por su salud y la de toda la familia.",
    body: "Algunos parásitos también pueden afectar a las personas que conviven con ellos. Por eso es tan importante desparasitar a tu mascota de forma regular."
  },
  {
    id: "dental",
    icon: "tooth",
    title: "Higiene dental",
    lead: "Revisiones y limpiezas bucodentales.",
    body: "Una boca sana es básica para su bienestar. Con revisiones odontológicas y una correcta limpieza bucodental prevenimos numerosas enfermedades."
  },
  {
    id: "hospitalizacion",
    icon: "bed",
    title: "Hospitalización",
    lead: "Cuidados intensivos y atención especial.",
    body: "Nuestras salas de hospitalización ofrecen la mejor asistencia cuando tu mascota necesita cuidados intensivos o una atención especial."
  },
  {
    id: "urgencias",
    icon: "clock",
    title: "Urgencias 24h para clientes",
    lead: "Si ya eres cliente, te atendemos a cualquier hora.",
    body: "Queremos poder atender cualquier problema en cualquier momento. Por eso, nuestros clientes disponen de un servicio de urgencias 24h, con la misma atención personalizada de siempre."
  },
  {
    id: "laboratorio",
    icon: "flask",
    title: "Laboratorio propio",
    lead: "Resultados rápidos y seguros, aquí mismo.",
    body: "Laboratorio completamente equipado con tecnología avanzada para hacer multitud de pruebas diagnósticas y obtener el resultado de la forma más rápida y segura."
  },
  {
    id: "tienda",
    icon: "bag",
    title: "Tienda",
    lead: "Todo lo que tu mascota necesita en casa.",
    body: "Nutrición, accesorios y juguetes para cuidar a tu animal como se merece, favorecer su aprendizaje durante el crecimiento y reforzar sus comportamientos."
  }
];

export const specialties = [
  "Dermatología",
  "Oftalmología",
  "Oncología",
  "Cardiología",
  "Etología",
  "Traumatología",
  "Endocrinología"
];

export const stats = [
  { value: 800, prefix: "+", label: "familias han confiado en nosotros" },
  { value: 100, prefix: "+", label: "razas atendidas" },
  { value: 2006, prefix: "", label: "cuidando del barrio desde", plain: true },
  { value: 20, prefix: "+", label: "años de experiencia" }
];

export const quotes = [
  {
    text: "Un veterinario no solo ama a los animales. Los cuida hasta silenciar un dolor mudo, que los humanos no podemos escuchar.",
    author: "Anónimo"
  },
  {
    text: "Ser veterinario es ser capaz de entender meneos de colas, arañazos cariñosos y mordiscos de afecto.",
    author: "Anónimo"
  }
];

// Catálogo de servicios dentales con precios reales del mercado dominicano (RD$).
// Provisional hasta la Tanda 9 (catálogo administrable). Datos reales, no placeholder.

export interface Servicio {
  nombre: string;
  precio: number;
}

export const SERVICIOS: Servicio[] = [
  { nombre: "Consulta / evaluación", precio: 1000 },
  { nombre: "Limpieza dental (profilaxis)", precio: 2500 },
  { nombre: "Radiografía periapical", precio: 800 },
  { nombre: "Resina compuesta (obturación)", precio: 3500 },
  { nombre: "Sellante dental", precio: 1500 },
  { nombre: "Extracción simple", precio: 2500 },
  { nombre: "Extracción quirúrgica", precio: 6000 },
  { nombre: "Endodoncia unirradicular", precio: 12000 },
  { nombre: "Endodoncia multirradicular", precio: 18000 },
  { nombre: "Incrustación", precio: 9000 },
  { nombre: "Corona metal-porcelana", precio: 15000 },
  { nombre: "Corona de porcelana", precio: 18000 },
  { nombre: "Blanqueamiento dental", precio: 8000 },
  { nombre: "Prótesis parcial removible", precio: 25000 },
  { nombre: "Ortodoncia (ajuste mensual)", precio: 2500 },
  { nombre: "Implante dental", precio: 45000 },
];

export const ITBIS_RATE = 0.18;

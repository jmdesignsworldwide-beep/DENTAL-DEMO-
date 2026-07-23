// Validaciones puras — compartidas entre cliente y servidor.
// El servidor SIEMPRE revalida; el cliente solo mejora la UX.

/** Valida cédula dominicana (11 dígitos + dígito verificador módulo 10). */
export function validarCedula(raw: string): boolean {
  const c = (raw ?? "").replace(/\D/g, "");
  if (c.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(c)) return false; // todos iguales
  let suma = 0;
  for (let i = 0; i < 10; i++) {
    let m = Number(c[i]) * (i % 2 === 0 ? 1 : 2);
    if (m > 9) m -= 9;
    suma += m;
  }
  const verificador = (10 - (suma % 10)) % 10;
  return verificador === Number(c[10]);
}

/** Formatea a ###-#######-# mientras se escribe. */
export function formatCedula(raw: string): string {
  const c = (raw ?? "").replace(/\D/g, "").slice(0, 11);
  const parts = [c.slice(0, 3), c.slice(3, 10), c.slice(10, 11)].filter(Boolean);
  return parts.join("-");
}

export function validarEmail(email: string): boolean {
  if (!email) return true; // opcional
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

export function validarTelefono(tel: string): boolean {
  if (!tel) return true; // opcional
  const d = tel.replace(/\D/g, "");
  return d.length === 10; // 809/829/849 + 7
}

export interface PatientInput {
  nombre: string;
  cedula: string;
  fecha_nacimiento: string;
  telefono: string;
  email: string;
  direccion: string;
  tipo_sangre: string;
  alergias: string;
  medicamentos: string;
  condiciones: string;
  seguro: string;
  poliza: string;
  contacto_emergencia_nombre: string;
  contacto_emergencia_telefono: string;
  es_vip: boolean;
  notas: string;
}

export type FieldErrors = Partial<Record<keyof PatientInput, string>>;

/** Valida el expediente. Devuelve errores por campo (vacío = válido). */
export function validarPaciente(input: Partial<PatientInput>): FieldErrors {
  const e: FieldErrors = {};

  const nombre = (input.nombre ?? "").trim();
  if (nombre.length < 3) e.nombre = "El nombre completo es requerido.";
  else if (nombre.length > 120) e.nombre = "Nombre demasiado largo.";

  const cedula = (input.cedula ?? "").trim();
  if (cedula && !validarCedula(cedula))
    e.cedula = "Cédula inválida (verifica el dígito verificador).";

  if (input.email && !validarEmail(input.email))
    e.email = "Correo con formato inválido.";

  if (input.telefono && !validarTelefono(input.telefono))
    e.telefono = "Teléfono debe tener 10 dígitos.";

  if (
    input.contacto_emergencia_telefono &&
    !validarTelefono(input.contacto_emergencia_telefono)
  )
    e.contacto_emergencia_telefono = "Teléfono debe tener 10 dígitos.";

  if (input.fecha_nacimiento) {
    const d = new Date(input.fecha_nacimiento);
    const now = new Date();
    if (isNaN(d.getTime())) e.fecha_nacimiento = "Fecha inválida.";
    else if (d > now) e.fecha_nacimiento = "La fecha no puede ser futura.";
    else if (d < new Date("1900-01-01"))
      e.fecha_nacimiento = "Fecha fuera de rango.";
  }

  return e;
}

/** Calcula edad en años a partir de una fecha ISO. */
export function calcularEdad(fechaISO: string | null): number | null {
  if (!fechaISO) return null;
  const d = new Date(fechaISO);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let edad = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) edad--;
  return edad;
}

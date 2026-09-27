/**
 * Common UN/ECE Rec 20 codes (SUNAT Catálogo N° 03).
 * `label` is short for closed `<select>` display; `description` is for titles.
 */
export const UNIT_CODES = [
  { code: "NIU", label: "NIU", description: "Unidad (bienes)" },
  { code: "ZZ", label: "ZZ", description: "Unidad (servicios)" },
  { code: "KGM", label: "KGM", description: "Kilogramo" },
  { code: "GRM", label: "GRM", description: "Gramo" },
  { code: "LTR", label: "LTR", description: "Litro" },
  { code: "MTR", label: "MTR", description: "Metro" },
  { code: "MTK", label: "MTK", description: "Metro cuadrado" },
  { code: "MTQ", label: "MTQ", description: "Metro cúbico" },
  { code: "TNE", label: "TNE", description: "Tonelada" },
  { code: "BX", label: "BX", description: "Caja" },
  { code: "DZN", label: "DZN", description: "Docena" },
  { code: "PR", label: "PR", description: "Par" },
  { code: "SET", label: "SET", description: "Juego" },
  { code: "BG", label: "BG", description: "Bolsa" },
  { code: "PK", label: "PK", description: "Paquete" },
  { code: "BO", label: "BO", description: "Botella" },
  { code: "CT", label: "CT", description: "Cartón" },
  { code: "RO", label: "RO", description: "Rollo" },
  { code: "HUR", label: "HUR", description: "Hora" },
  { code: "DAY", label: "DAY", description: "Día" },
  { code: "MON", label: "MON", description: "Mes" },
  { code: "GLL", label: "GLL", description: "Galón" },
  { code: "ONZ", label: "ONZ", description: "Onza" },
  { code: "CMT", label: "CMT", description: "Centímetro" },
  { code: "MMT", label: "MMT", description: "Milímetro" },
  { code: "FOT", label: "FOT", description: "Pie" },
  { code: "INH", label: "INH", description: "Pulgada" },
  { code: "YRD", label: "YRD", description: "Yarda" },
  { code: "MIL", label: "MIL", description: "Millar" },
] as const;

export type UnitCode = (typeof UNIT_CODES)[number]["code"];

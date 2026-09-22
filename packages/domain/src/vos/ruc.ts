/**
 * Peruvian RUC (11 digits) with checksum (módulo 11).
 */
export function isValidRuc(ruc: string): boolean {
  if (!/^\d{11}$/.test(ruc)) {
    return false;
  }
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2] as const;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const digit = ruc[i];
    const weight = weights[i];
    if (digit === undefined || weight === undefined) {
      return false;
    }
    sum += Number(digit) * weight;
  }
  const mod = 11 - (sum % 11);
  const check = mod === 10 ? 0 : mod === 11 ? 1 : mod;
  return check === Number(ruc[10]);
}

export function assertValidRuc(ruc: string): void {
  if (!isValidRuc(ruc)) {
    throw new Error(`Invalid RUC checksum: ${ruc}`);
  }
}

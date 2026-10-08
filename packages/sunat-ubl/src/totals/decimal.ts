import { ublValidationError } from "../errors";

/** Exact decimal arithmetic for JSON numbers, up to ten fractional digits. */
function decimal(value: number): { units: bigint; scale: bigint } {
  if (!Number.isFinite(value) || value < 0) throw ublValidationError("Invalid decimal amount");
  const [mantissa = "0", exp = "0"] = String(value).toLowerCase().split("e");
  const [whole = "0", fraction = ""] = mantissa.split(".");
  const places = fraction.length - Number(exp);
  if (places > 10) throw ublValidationError("Amounts allow at most 10 decimal places");
  const units = BigInt(whole + fraction);
  return places < 0
    ? { units: units * 10n ** BigInt(-places), scale: 1n }
    : { units, scale: 10n ** BigInt(places) };
}

function halfUp(units: bigint, scale: bigint, places: number): number {
  const multiplier = 10n ** BigInt(places);
  const rounded = (units * multiplier * 2n + scale) / (scale * 2n);
  if (units * 100n > BigInt(Number.MAX_SAFE_INTEGER) * scale)
    throw ublValidationError("Amount exceeds safe precision");
  const digits = rounded.toString().padStart(places + 1, "0");
  return Number(places ? `${digits.slice(0, -places)}.${digits.slice(-places)}` : digits);
}

export function decimalRound(value: number, places = 2): number {
  const d = decimal(value);
  return halfUp(d.units, d.scale, places);
}

export function decimalMultiply(a: number, b: number, divisor = 1, places = 2): number {
  const left = decimal(a);
  const right = decimal(b);
  return halfUp(left.units * right.units, left.scale * right.scale * BigInt(divisor), places);
}

export function sumMoney(values: number[]): number {
  const cents = values.reduce((sum, value) => {
    const d = decimal(value);
    return sum + (d.units * 200n + d.scale) / (d.scale * 2n);
  }, 0n);
  if (cents > BigInt(Number.MAX_SAFE_INTEGER))
    throw ublValidationError("Total exceeds safe precision");
  return halfUp(cents, 100n, 2);
}

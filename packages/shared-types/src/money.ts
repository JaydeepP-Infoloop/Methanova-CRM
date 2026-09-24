/**
 * Monetary amounts are ALWAYS integer paise. Never store rupees as float.
 * 1 rupee = 100 paise.
 */
export type Paise = number;

export function assertPaise(value: unknown): asserts value is Paise {
  if (typeof value !== "number" || !Number.isInteger(value) || !Number.isFinite(value)) {
    throw new Error("Monetary values must be finite integers in paise");
  }
}

export function rupeesToPaise(rupees: number): Paise {
  if (!Number.isInteger(rupees * 100) && !Number.isInteger(rupees)) {
    throw new Error("Rupee inputs must convert to an integer paise amount without rounding");
  }
  const paise = Math.round(rupees * 100);
  if (Math.abs(rupees * 100 - paise) > Number.EPSILON) {
    throw new Error("Rupee inputs must convert to an integer paise amount without rounding");
  }
  assertPaise(paise);
  return paise;
}

/**
 * Groups in the Indian system (lakh/crore), so 250000000 paise reads
 * "₹25,00,000.00" rather than "₹2500000.00". Every figure in this product is
 * quoted to Indian buyers and regulators, and an EPC contract value is large
 * enough that ungrouped digits are genuinely hard to read correctly.
 *
 * The rupee part is grouped from an integer rather than formatting
 * `paise / 100` as a float, because that division is exactly the kind of
 * rounding the paise convention exists to avoid.
 */
export function paiseToDisplay(paise: Paise): string {
  assertPaise(paise);
  const sign = paise < 0 ? "-" : "";
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const remainder = abs % 100;
  const grouped = rupees.toLocaleString("en-IN", { useGrouping: true, maximumFractionDigits: 0 });
  return `${sign}₹${grouped}.${remainder.toString().padStart(2, "0")}`;
}

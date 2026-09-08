/**
 * Display formatting for money and percentages. Presentation only: these
 * functions turn integer paise into strings and never feed arithmetic
 * (docs/ENGINE_RULES.md). Indian digit grouping: ₹12,34,567.89.
 */

function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  let rest = digits.slice(0, -3);
  const groups: string[] = [];
  while (rest.length > 2) {
    groups.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest) groups.unshift(rest);
  return `${groups.join(",")},${last3}`;
}

/** `formatINR(123456789n)` → "₹12,34,567.89". Negative values get a true minus sign. */
export function formatINR(
  paise: bigint,
  options: { sign?: boolean } = {},
): string {
  const negative = paise < 0n;
  const abs = negative ? -paise : paise;
  const rupees = abs / 100n;
  const p = abs % 100n;
  const body = `₹${groupIndian(rupees.toString())}.${p.toString().padStart(2, "0")}`;
  if (negative) return `−${body}`;
  return options.sign && paise > 0n ? `+${body}` : body;
}

/** Whole rupees, no paise: "₹12,34,568". */
export function formatINRWhole(paise: bigint): string {
  const negative = paise < 0n;
  const abs = negative ? -paise : paise;
  const rounded = (abs + 50n) / 100n;
  const body = `₹${groupIndian(rounded.toString())}`;
  return negative ? `−${body}` : body;
}

/** Basis points to a percentage string: 234 → "2.34%", -1250 → "−12.50%". */
export function formatBps(
  bps: number,
  options: { sign?: boolean } = {},
): string {
  const negative = bps < 0;
  const abs = Math.abs(bps);
  const whole = Math.floor(abs / 100);
  const frac = (abs % 100).toString().padStart(2, "0");
  const body = `${whole}.${frac}%`;
  if (negative) return `−${body}`;
  return options.sign && bps > 0 ? `+${body}` : body;
}

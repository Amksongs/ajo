// XLM <-> stroop conversion, shared by the CLI and frontend (#107).
export const STROOPS_PER_XLM = 10_000_000n;

/** Format a stroop amount as XLM, trimming trailing zeros ("15000000" -> "1.5"). */
export function formatXlm(stroops: bigint): string {
  const whole = stroops / STROOPS_PER_XLM;
  const frac = stroops % STROOPS_PER_XLM;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(7, "0").replace(/0+$/, "");
  return `${whole}.${fracStr}`;
}

/**
 * Parse a user-entered XLM amount into stroops, throwing on non-numeric or
 * invalid strings (#67) instead of silently returning NaN.
 *
 * Returns `bigint` stroops like every other amount path in the SDK: a JS
 * `number` can't hold 7 decimals on a large whole part exactly
 * ("90071992547.4099999" became 90071992547.41), and money must not round (#268).
 * More than 7 decimal places is rejected rather than silently truncated.
 */
export function parseAmount(amount: string): bigint {
  const trimmed = amount.trim();
  if (!/^\d+(\.\d{1,7})?$/.test(trimmed)) {
    throw new Error(`Invalid numeric amount: "${amount}"`);
  }
  return xlmToStroops(trimmed);
}

/** Parse a decimal XLM string into stroops, truncating past 7 decimal places. */
export function xlmToStroops(xlm: string): bigint {
  const trimmed = xlm.trim();
  if (trimmed === "." || trimmed === "") return 0n;
  if (!/^\d*(\.\d*)?$/.test(trimmed)) {
    throw new Error(`Invalid XLM amount: "${xlm}"`);
  }
  const [whole = "", frac = ""] = trimmed.split(".");
  const paddedFrac = (frac + "0000000").slice(0, 7);
  return BigInt(whole || "0") * STROOPS_PER_XLM + BigInt(paddedFrac || "0");
}

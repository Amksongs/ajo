// CLI flag validation helpers.
import { MAX_CYCLE_LENGTH_SECS } from "@ajo/sdk";

/**
 * Parse `--cycle-secs` into a BigInt. `BigInt()` on arbitrary input throws a
 * raw `SyntaxError: Cannot convert abc to a BigInt`, so validate the string
 * first and throw a clear message the top-level handler can print as-is.
 */
export function parseCycleSecs(value: string): bigint {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`--cycle-secs must be a whole number of seconds (got "${value}").`);
  }
  const secs = BigInt(trimmed);
  if (secs === 0n) {
    throw new Error("--cycle-secs must be greater than 0.");
  }
  // The contract rejects longer cycles with a generic InvalidParams at
  // simulation time; catch it here with a specific message (#292).
  if (secs > MAX_CYCLE_LENGTH_SECS) {
    throw new Error(
      `--cycle-secs must be at most ${MAX_CYCLE_LENGTH_SECS} (366 days, the contract's limit; got ${secs}).`,
    );
  }
  return secs;
}

/** The contract requires at least two members (`max_members < 2` is rejected). */
export const MIN_MEMBERS = 2;
/** `max_members` is a u32 on-chain. */
export const MAX_MEMBERS = 4_294_967_295;

/**
 * Parse `--members` into a whole number the contract will accept. Without
 * this, `Number("0")`, `Number("-3")` or `Number("abc")` (NaN) were passed
 * straight to the transaction and only failed on-chain.
 */
export function parseMembers(value: string): number {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`--members must be a whole number (got "${value}").`);
  }
  const members = Number(trimmed);
  if (members < MIN_MEMBERS) {
    throw new Error(`--members must be at least ${MIN_MEMBERS}.`);
  }
  if (members > MAX_MEMBERS) {
    throw new Error(`--members must be at most ${MAX_MEMBERS}.`);
  }
  return members;
}

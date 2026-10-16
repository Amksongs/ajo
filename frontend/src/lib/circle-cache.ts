// Circle cache.
import { cacheScope } from "./network-config";

/** Pre-#303 unscoped key; its ids may belong to another contract/network. */
export const LEGACY_STORAGE_KEY = "ajo_known_circle_ids";

/** Ids are scoped to the current network + contract (#303). */
export function knownCircleIdsKey(scope: string = cacheScope()): string {
  return `${LEGACY_STORAGE_KEY}:${scope}`;
}

/**
 * discoverCircleIds() only scans ~7 days of ledger events, so a circle
 * older than that silently drops out of the browse list even though it's
 * still perfectly reachable at /circles/[id]. This is a client-side cache
 * of every id this browser has ever seen — via discovery, direct visit, or
 * creating/joining one — so the list stays complete locally regardless of
 * the RPC lookback window. It's a convenience cache, not a source of
 * truth: every id still gets its live state from the contract.
 */
export function rememberCircleId(id: bigint): void {
  if (typeof window === "undefined") return;
  const known = readKnownIds();
  known.add(id.toString());
  window.localStorage.setItem(knownCircleIdsKey(), JSON.stringify([...known]));
}

export function rememberCircleIds(ids: bigint[]): void {
  if (typeof window === "undefined") return;
  const known = readKnownIds();
  for (const id of ids) known.add(id.toString());
  window.localStorage.setItem(knownCircleIdsKey(), JSON.stringify([...known]));
}

export function getKnownCircleIds(): bigint[] {
  return [...readKnownIds()].map((id) => BigInt(id));
}

function readKnownIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    // Drop the unscoped pre-#303 entry rather than reusing ids that may point
    // at a different contract's circles.
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    const raw = window.localStorage.getItem(knownCircleIdsKey());
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : []);
  } catch {
    return new Set();
  }
}
import type { Circle } from "./contract";

export interface CircleListSources {
  discoverCircleIds: () => Promise<bigint[]>;
  getTotalCircles: () => Promise<bigint>;
  getKnownCircleIds: () => bigint[];
  getCircle: (id: bigint) => Promise<Circle>;
}

export interface CircleListResult {
  /** Loaded circles, newest id first. */
  circles: Circle[];
  /** `null` when `total_circles` couldn't be read; the badge is then hidden. */
  totalCircles: bigint | null;
  /** Ids found by event discovery this time; empty if discovery failed. */
  discovered: bigint[];
  /** Set only when nothing could be loaded at all. */
  error: string | null;
}

/**
 * Load the circles list so no single failing read blanks the page (#117, #301):
 * discovery and the total count are fetched with `allSettled`, cached ids
 * still load if discovery fails, and per-circle reads tolerate stale ids.
 */
export async function loadCircleList(src: CircleListSources): Promise<CircleListResult> {
  const [discoveredRes, totalRes] = await Promise.allSettled([
    src.discoverCircleIds(),
    src.getTotalCircles(),
  ]);
  const discovered = discoveredRes.status === "fulfilled" ? discoveredRes.value : [];
  const totalCircles = totalRes.status === "fulfilled" ? totalRes.value : null;

  const idSet = new Map<string, bigint>();
  for (const id of [...discovered, ...src.getKnownCircleIds()]) idSet.set(id.toString(), id);

  // Cached ids can predate a contract redeploy and no longer resolve —
  // load with allSettled so one stale id can't blank out the whole list.
  const results = await Promise.allSettled([...idSet.values()].map((id) => src.getCircle(id)));
  const circles = results
    .filter((r): r is PromiseFulfilledResult<Circle> => r.status === "fulfilled")
    .map((r) => r.value)
    .sort((a, b) => (a.id < b.id ? 1 : -1));

  const error =
    discoveredRes.status === "rejected" && circles.length === 0
      ? discoveredRes.reason instanceof Error
        ? discoveredRes.reason.message
        : "Could not load circles."
      : null;

  return { circles, totalCircles, discovered, error };
}

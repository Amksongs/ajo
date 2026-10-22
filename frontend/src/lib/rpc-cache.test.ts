// RPC cache test tests.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rpcCache } from "./rpc-cache";

function fakeHasContributed(): () => Promise<boolean> {
  return vi.fn().mockResolvedValue(true);
}

function fakeMissedCount(): () => Promise<number> {
  let calls = 0;
  return vi.fn().mockImplementation(async () => {
    calls += 1;
    return calls === 1 ? 3 : 7;
  });
}

describe("rpc-cache TTL expiry", () => {
  beforeEach(() => {
    rpcCache.clear();
    rpcCache.defaultTTL = 30000;
  });

  it("returns cached values within the TTL", async () => {
    const hasContributed = fakeHasContributed();
    const result = await rpcCache.hasContributedCached(hasContributed, 1n, 7, "GM");
    expect(await rpcCache.hasContributedCached(hasContributed, 1n, 7, "GM")).toBe(result);
    expect(hasContributed).toHaveBeenCalledTimes(1);
  });

  it("ignores stale entries created before a short TTL", async () => {
    const hasContributed = fakeHasContributed();
    const key = rpcCache.contributionKey(9n, 1, "GM");
    rpcCache.set(key, true);
    rpcCache.defaultTTL = -1; // Force immediate expiry

    const result = await rpcCache.hasContributedCached(hasContributed, 9n, 1, "GM");
    expect(result).toBe(true);
    expect(hasContributed).toHaveBeenCalledTimes(1);

    const second = await rpcCache.hasContributedCached(hasContributed, 9n, 1, "GM");
    expect(second).toBe(true);
    // Stale entry should be evicted before the next real call.
    expect(hasContributed).toHaveBeenCalledTimes(2);
  });

  it("evicts expired entries from the internal map", async () => {
    const hasContributed = fakeHasContributed();
    const key = rpcCache.contributionKey(11n, 1, "GM");
    rpcCache.set(key, true);
    rpcCache.defaultTTL = -1; // Force immediate expiry

    // Check that expired entry is evicted on get()
    expect(rpcCache.get(key)).toBeNull();
    expect(rpcCache.getStats().size).toBe(0);

    // Now the RPC should be called and store a new entry
    await rpcCache.hasContributedCached(hasContributed, 11n, 1, "GM");
    expect(hasContributed).toHaveBeenCalledTimes(1);
    expect(rpcCache.getStats().size).toBe(1);
  });

  it("returns null for uncached keys", () => {
    expect(rpcCache.get(rpcCache.contributionKey(1n, 1, "GM"))).toBeNull();
    expect(rpcCache.get(rpcCache.missedKey(1n, "GM"))).toBeNull();
  });
});

describe("rpc-cache cached vs fresh calls", () => {
  beforeEach(() => {
    rpcCache.clear();
    rpcCache.defaultTTL = 30000;
  });

  it("returns the same value without re-executing the RPC function", async () => {
    const hasContributed = fakeHasContributed();
    const result = await rpcCache.hasContributedCached(hasContributed, 2n, 3, "GM");
    expect(result).toBe(true);

    const cached = await rpcCache.hasContributedCached(hasContributed, 2n, 3, "GM");
    expect(cached).toBe(true);
    expect(hasContributed).toHaveBeenCalledTimes(1);
  });

  it("executes the RPC function again after an invalidation", async () => {
    const hasContributed = fakeHasContributed();
    const first = await rpcCache.hasContributedCached(hasContributed, 3n, 5, "GM");
    expect(first).toBe(true);

    rpcCache.clearCircle(3n);

    const second = await rpcCache.hasContributedCached(hasContributed, 3n, 5, "GM");
    expect(second).toBe(true);
    expect(hasContributed).toHaveBeenCalledTimes(2);
  });

  it("returns the same number without re-executing the RPC function", async () => {
    const missedCount = fakeMissedCount();
    expect(await rpcCache.missedCountCached(missedCount, 4n, "GM")).toBe(3);
    expect(await rpcCache.missedCountCached(missedCount, 4n, "GM")).toBe(3);
    expect(missedCount).toHaveBeenCalledTimes(1);
  });

  it("re-executes the RPC function after its cache key is invalidated", async () => {
    const missedCount = fakeMissedCount();
    expect(await rpcCache.missedCountCached(missedCount, 5n, "GM")).toBe(3);

    rpcCache.clearCircle(5n);

    expect(await rpcCache.missedCountCached(missedCount, 5n, "GM")).toBe(7);
    expect(missedCount).toHaveBeenCalledTimes(2);
  });

  it("does not share entries between different circle/cycle/member keys", async () => {
    const hasContributed = fakeHasContributed();
    expect(await rpcCache.hasContributedCached(hasContributed, 7n, 1, "GM")).toBe(true);
    expect(hasContributed).toHaveBeenCalledTimes(1);

    expect(await rpcCache.hasContributedCached(hasContributed, 7n, 2, "GM")).toBe(true);
    // Same circle, different cycle: should be a separate RPC.
    expect(hasContributed).toHaveBeenCalledTimes(2);
  });

  it("does not share entries between hasContributed and missedCount", async () => {
    const hasContributed = fakeHasContributed();
    const missedCount = fakeMissedCount();
    expect(await rpcCache.hasContributedCached(hasContributed, 8n, 1, "GM")).toBe(true);
    expect(await rpcCache.missedCountCached(missedCount, 8n, "GM")).toBe(3);

    // Both should have run exactly once.
    expect(hasContributed).toHaveBeenCalledTimes(1);
    expect(missedCount).toHaveBeenCalledTimes(1);
  });
});

describe("rpc-cache invalidation scoping", () => {
  beforeEach(() => {
    rpcCache.clear();
    rpcCache.defaultTTL = 30000;
  });

  it("invalidateCircleCache only clears entries for the requested circle", async () => {
    const hasContributed = fakeHasContributed();
    const hasContributed2 = fakeHasContributed();

    expect(await rpcCache.hasContributedCached(hasContributed, 1n, 1, "GM")).toBe(true);
    expect(await rpcCache.hasContributedCached(hasContributed2, 2n, 1, "GM")).toBe(true);

    rpcCache.clearCircle(1n);
    expect(rpcCache.get(rpcCache.contributionKey(1n, 1, "GM"))).toBeNull();
    expect(rpcCache.get(rpcCache.contributionKey(1n, 1, "GM2"))).toBeNull();
    expect(rpcCache.get(rpcCache.contributionKey(2n, 1, "GM"))).not.toBeNull();

    expect(hasContributed).toHaveBeenCalledTimes(1);
    expect(hasContributed2).toHaveBeenCalledTimes(1);
  });

  it("invalidateCircleCache clears only that circle's entries, not others", async () => {
    const hasContributed = fakeHasContributed();
    const hasContributed2 = fakeHasContributed();

    expect(await rpcCache.hasContributedCached(hasContributed, 3n, 1, "GM")).toBe(true);
    expect(await rpcCache.hasContributedCached(hasContributed2, 4n, 1, "GM")).toBe(true);

    rpcCache.clearCircle(3n);

    expect(rpcCache.get(rpcCache.contributionKey(3n, 1, "GM"))).toBeNull();
    expect(rpcCache.get(rpcCache.contributionKey(4n, 1, "GM"))).not.toBeNull();

    expect(hasContributed).toHaveBeenCalledTimes(1);
    expect(hasContributed2).toHaveBeenCalledTimes(1);
  });

  it("invalidation does not accidentally clear entries with a circle id that is a substring of another key", async () => {
    const hasContributed = fakeHasContributed();
    const hasContributed2 = fakeHasContributed();

    expect(await rpcCache.hasContributedCached(hasContributed, 31n, 2, "GM")).toBe(true);
    expect(await rpcCache.hasContributedCached(hasContributed2, 3n, 2, "GM")).toBe(true);

    // `:31:` should match the 31n key but not the 3n key.
    rpcCache.clearCircle(31n);
    expect(rpcCache.get(rpcCache.contributionKey(31n, 2, "GM"))).toBeNull();
    expect(rpcCache.get(rpcCache.contributionKey(3n, 2, "GM"))).not.toBeNull();

    expect(hasContributed).toHaveBeenCalledTimes(1);
    expect(hasContributed2).toHaveBeenCalledTimes(1);
  });

  it("different circles share no entries even when cached under the same member", async () => {
    const hasContributed = fakeHasContributed();
    expect(await rpcCache.hasContributedCached(hasContributed, 11n, 1, "GM")).toBe(true);
    expect(hasContributed).toHaveBeenCalledTimes(1);

    expect(await rpcCache.hasContributedCached(hasContributed, 12n, 1, "GM")).toBe(true);
    expect(hasContributed).toHaveBeenCalledTimes(2);
  });

  it("scoped contribution keys do not leak across network/contract scopes", async () => {
    const hasContributed = fakeHasContributed();
    const a = rpcCache.contributionKey(1n, 1, "GM", "network-a:contract-a");
    const b = rpcCache.contributionKey(1n, 1, "GM", "network-b:contract-b");

    rpcCache.set(a, true);
    expect(rpcCache.get<boolean>(a)).toBe(true);
    expect(rpcCache.get<boolean>(b)).toBeNull();
    expect(hasContributed).toHaveBeenCalledTimes(0);

    rpcCache.clearPattern(b);
    expect(rpcCache.get<boolean>(a)).toBe(true);
    expect(rpcCache.get<boolean>(b)).toBeNull();
  });
});

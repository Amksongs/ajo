// Circle cache test tests.
import { beforeEach, describe, expect, it } from "vitest";
import {
  LEGACY_STORAGE_KEY,
  getKnownCircleIds,
  knownCircleIdsKey,
  rememberCircleId,
  rememberCircleIds,
} from "./circle-cache";
import { rpcCache } from "./rpc-cache";
import { cacheScope } from "./network-config";

function installMockLocalStorage() {
  const store = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
      clear: () => void store.clear(),
    },
  });
}

describe("circle-cache", () => {
  beforeEach(() => {
    installMockLocalStorage();
  });

  it("returns an empty list when nothing has been remembered", () => {
    expect(getKnownCircleIds()).toEqual([]);
  });

  it("remembers a single id", () => {
    rememberCircleId(5n);
    expect(getKnownCircleIds()).toEqual([5n]);
  });

  it("remembers a batch of ids and de-duplicates across calls", () => {
    rememberCircleIds([1n, 2n, 3n]);
    rememberCircleIds([2n, 3n, 4n]);
    expect(new Set(getKnownCircleIds())).toEqual(new Set([1n, 2n, 3n, 4n]));
  });

  it("ignores corrupted storage instead of throwing", () => {
    window.localStorage.setItem(knownCircleIdsKey(), "not valid json");
    expect(getKnownCircleIds()).toEqual([]);
  });

  // #303 — ids are only meaningful for one contract on one network.
  it("scopes the storage key by network and contract", () => {
    rememberCircleId(5n);
    expect(window.localStorage.getItem(knownCircleIdsKey())).toBe(JSON.stringify(["5"]));
    expect(knownCircleIdsKey(cacheScope("Test SDF Network ; September 2015", "CA"))).not.toBe(
      knownCircleIdsKey(cacheScope("Test SDF Network ; September 2015", "CB")),
    );
    expect(knownCircleIdsKey(cacheScope("Test SDF Network ; September 2015", "CA"))).not.toBe(
      knownCircleIdsKey(cacheScope("Public Global Stellar Network ; September 2015", "CA")),
    );
  });

  it("does not reuse ids from the unscoped pre-#303 key, and removes it", () => {
    window.localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(["1", "2"]));
    expect(getKnownCircleIds()).toEqual([]);
    expect(window.localStorage.getItem(LEGACY_STORAGE_KEY)).toBeNull();
  });
});

describe("rpc-cache keys (#303)", () => {
  it("differ across contracts and networks for the same circle", () => {
    const a = cacheScope("Test SDF Network ; September 2015", "CA");
    const b = cacheScope("Test SDF Network ; September 2015", "CB");
    expect(rpcCache.contributionKey(3n, 0, "GM", a)).not.toBe(rpcCache.contributionKey(3n, 0, "GM", b));
    expect(rpcCache.missedKey(3n, "GM", a)).not.toBe(rpcCache.missedKey(3n, "GM", b));
    expect(rpcCache.missedKey(3n, "GM")).toBe(`${cacheScope()}:missed:3:GM`);
  });
});

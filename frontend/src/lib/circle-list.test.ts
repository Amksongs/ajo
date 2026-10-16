import { describe, expect, it, vi } from "vitest";
import { loadCircleList, type CircleListSources } from "./circle-list";
import type { Circle } from "./contract";

const circle = (id: bigint) => ({ id }) as unknown as Circle;

function sources(overrides: Partial<CircleListSources> = {}): CircleListSources {
  return {
    discoverCircleIds: vi.fn(async () => [1n, 2n]),
    getTotalCircles: vi.fn(async () => 2n),
    getKnownCircleIds: vi.fn(() => []),
    getCircle: vi.fn(async (id: bigint) => circle(id)),
    ...overrides,
  };
}

describe("loadCircleList (#301)", () => {
  it("still lists discovered circles when total_circles fails, with no total", async () => {
    const result = await loadCircleList(
      sources({ getTotalCircles: vi.fn(async () => Promise.reject(new Error("RPC 503"))) }),
    );
    expect(result.circles.map((c) => c.id)).toEqual([2n, 1n]);
    expect(result.totalCircles).toBeNull();
    expect(result.error).toBeNull();
  });

  it("falls back to cached ids when discovery fails", async () => {
    const result = await loadCircleList(
      sources({
        discoverCircleIds: vi.fn(async () => Promise.reject(new Error("getEvents failed"))),
        getKnownCircleIds: vi.fn(() => [7n]),
      }),
    );
    expect(result.circles.map((c) => c.id)).toEqual([7n]);
    expect(result.discovered).toEqual([]);
    expect(result.totalCircles).toBe(2n);
    expect(result.error).toBeNull();
  });

  it("reports an error only when nothing could be loaded", async () => {
    const result = await loadCircleList(
      sources({
        discoverCircleIds: vi.fn(async () => Promise.reject(new Error("getEvents failed"))),
        getTotalCircles: vi.fn(async () => Promise.reject(new Error("RPC 503"))),
      }),
    );
    expect(result.circles).toEqual([]);
    expect(result.error).toBe("getEvents failed");
  });

  it("skips ids that no longer resolve", async () => {
    const result = await loadCircleList(
      sources({
        getCircle: vi.fn(async (id: bigint) =>
          id === 1n ? Promise.reject(new Error("CircleNotFound")) : circle(id),
        ),
      }),
    );
    expect(result.circles.map((c) => c.id)).toEqual([2n]);
  });
});

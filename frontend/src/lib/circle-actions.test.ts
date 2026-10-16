import { describe, expect, it } from "vitest";
import { CircleStatus } from "./contract";
import { canCancelCircle } from "./circle-actions";

describe("canCancelCircle (#323)", () => {
  it("allows the creator who is still a member while Forming", () => {
    expect(canCancelCircle({ status: CircleStatus.Forming, isCreator: true, isMember: true })).toBe(true);
  });

  it("hides cancel from a creator who has left their own circle", () => {
    expect(canCancelCircle({ status: CircleStatus.Forming, isCreator: true, isMember: false })).toBe(false);
  });

  it("hides cancel from non-creators, even members", () => {
    expect(canCancelCircle({ status: CircleStatus.Forming, isCreator: false, isMember: true })).toBe(false);
    expect(canCancelCircle({ status: CircleStatus.Forming, isCreator: false, isMember: false })).toBe(false);
  });

  it("hides cancel once the circle is no longer Forming", () => {
    for (const status of [CircleStatus.Active, CircleStatus.Completed, CircleStatus.Cancelled]) {
      expect(canCancelCircle({ status, isCreator: true, isMember: true })).toBe(false);
    }
  });
});

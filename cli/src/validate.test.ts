// --cycle-secs validation tests.
import { describe, expect, it } from "vitest";
import { MAX_CYCLE_LENGTH_SECS } from "@ajo/sdk";
import { parseCycleSecs, parseMembers } from "./validate";

describe("parseCycleSecs", () => {
  it("parses whole numbers of seconds", () => {
    expect(parseCycleSecs("604800")).toBe(604800n);
    expect(parseCycleSecs(" 60 ")).toBe(60n);
  });

  it("rejects non-numeric input with a friendly message", () => {
    for (const bad of ["abc", "", "1.5", "-5", "1e3", "0x10"]) {
      expect(() => parseCycleSecs(bad)).toThrow(/--cycle-secs must be a whole number of seconds/);
    }
  });

  it("rejects zero", () => {
    expect(() => parseCycleSecs("0")).toThrow("--cycle-secs must be greater than 0.");
  });

  it("accepts the contract's maximum and rejects anything longer (#292)", () => {
    expect(parseCycleSecs(MAX_CYCLE_LENGTH_SECS.toString())).toBe(31_622_400n);
    expect(() => parseCycleSecs("31622401")).toThrow(/--cycle-secs must be at most 31622400 \(366 days/);
    expect(() => parseCycleSecs("40000000")).toThrow(/at most 31622400/);
  });
});

describe("parseMembers", () => {
  it("parses a valid member count", () => {
    expect(parseMembers("2")).toBe(2);
    expect(parseMembers(" 12 ")).toBe(12);
  });

  it("rejects zero, one and negative counts", () => {
    expect(() => parseMembers("0")).toThrow("--members must be at least 2.");
    expect(() => parseMembers("1")).toThrow("--members must be at least 2.");
    expect(() => parseMembers("-3")).toThrow(/--members must be a whole number/);
  });

  it("rejects non-numeric input", () => {
    for (const bad of ["abc", "", "2.5", "1e3", "0x10"]) {
      expect(() => parseMembers(bad)).toThrow(/--members must be a whole number/);
    }
  });

  it("rejects counts above the on-chain u32 maximum", () => {
    expect(() => parseMembers("4294967296")).toThrow("--members must be at most 4294967295.");
  });
});

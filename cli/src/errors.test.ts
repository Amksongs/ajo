// Top-level error reporting tests (#284).
import { describe, expect, it } from "vitest";
import { AjoContractError, ContractErrorCode } from "@ajo/sdk";
import {
  CONTRACT_ERROR_HINTS,
  EXIT_CONTRACT_BASE,
  EXIT_CONTRACT_UNKNOWN,
  EXIT_GENERIC,
  reportError,
} from "./errors";

describe("reportError", () => {
  it("gives a known contract error its hint and a distinct exit code", () => {
    const err = AjoContractError.fromSimulationError("HostError: Error(Contract, #8)");
    expect(reportError(err)).toEqual({
      message: "This cycle isn't ready for payout yet.",
      hint: CONTRACT_ERROR_HINTS[ContractErrorCode.CycleNotReady],
      exitCode: EXIT_CONTRACT_BASE + ContractErrorCode.CycleNotReady,
    });
  });

  it("has a hint for every contract error code, and the exit codes don't collide", () => {
    const codes = Object.values(ContractErrorCode).filter((v): v is number => typeof v === "number");
    for (const code of codes) expect(CONTRACT_ERROR_HINTS[code as ContractErrorCode]).toBeTruthy();
    const exits = codes.map((c) => EXIT_CONTRACT_BASE + c);
    expect(new Set(exits).size).toBe(codes.length);
    expect(exits).not.toContain(EXIT_GENERIC);
    expect(exits).not.toContain(EXIT_CONTRACT_UNKNOWN);
  });

  it("uses the unknown-contract exit code when the code isn't recognised", () => {
    const err = new AjoContractError("Something odd happened on-chain");
    expect(reportError(err)).toEqual({
      message: "Something odd happened on-chain",
      hint: null,
      exitCode: EXIT_CONTRACT_UNKNOWN,
    });
  });

  it("falls back to exit 1 for ordinary errors and non-Error throws", () => {
    expect(reportError(new Error("bad config"))).toEqual({ message: "bad config", hint: null, exitCode: EXIT_GENERIC });
    expect(reportError("boom").exitCode).toBe(EXIT_GENERIC);
  });
});

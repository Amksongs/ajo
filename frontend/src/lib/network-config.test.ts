import { describe, expect, it } from "vitest";
import { networkDisplayName, networkName, networkShortLabel } from "./network-config";

const MAINNET = "Public Global Stellar Network ; September 2015";
const TESTNET = "Test SDF Network ; September 2015";
const FUTURENET = "Test SDF Future Network ; October 2022";
const CUSTOM = "Standalone Network ; February 2017";

describe("network naming (#328)", () => {
  it("names the public Stellar networks from their passphrases", () => {
    expect(networkName(MAINNET)).toBe("mainnet");
    expect(networkName(TESTNET)).toBe("testnet");
    expect(networkName(FUTURENET)).toBe("futurenet");
  });

  it("returns null for a custom network and tolerates surrounding whitespace", () => {
    expect(networkName(CUSTOM)).toBeNull();
    expect(networkName(`  ${MAINNET}\n`)).toBe("mainnet");
  });

  it("builds the long form used in sentences", () => {
    expect(networkDisplayName(MAINNET)).toBe("Stellar mainnet");
    expect(networkDisplayName(TESTNET)).toBe("Stellar testnet");
    expect(networkDisplayName(CUSTOM)).toBe("a custom Stellar network");
  });

  it("builds the short form used in the circle counter", () => {
    expect(networkShortLabel(MAINNET)).toBe("mainnet");
    expect(networkShortLabel(CUSTOM)).toBe("this network");
  });

  it("a mainnet deployment never says testnet", () => {
    expect(networkDisplayName(MAINNET)).not.toMatch(/testnet/i);
    expect(networkShortLabel(MAINNET)).not.toMatch(/testnet/i);
  });

  it("defaults to the configured passphrase (testnet when unset)", () => {
    expect(networkShortLabel()).toBe("testnet");
  });
});

// Network config shared by the contract client and the client-side caches.

export const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE ?? "Test SDF Network ; September 2015";
export const CONTRACT_ID = process.env.NEXT_PUBLIC_AJO_CONTRACT_ID ?? "";

/**
 * Prefix for every client-side cache key (#120, #303). Circle ids are only
 * meaningful for one contract on one network: after a redeploy or a network
 * switch, circle 3 is a different circle (or none), so caches must not share
 * entries across `NETWORK_PASSPHRASE` / `CONTRACT_ID`.
 */
export function cacheScope(
  networkPassphrase: string = NETWORK_PASSPHRASE,
  contractId: string = CONTRACT_ID,
): string {
  return `${networkPassphrase}:${contractId}`;
}

const KNOWN_NETWORKS: Record<string, string> = {
  "Public Global Stellar Network ; September 2015": "mainnet",
  "Test SDF Network ; September 2015": "testnet",
  "Test SDF Future Network ; October 2022": "futurenet",
};

/**
 * Short name of the Stellar network a passphrase belongs to ("mainnet",
 * "testnet", "futurenet"), or `null` for a custom/standalone network (#328).
 * User-facing copy uses this instead of hard-coding "testnet".
 */
export function networkName(networkPassphrase: string = NETWORK_PASSPHRASE): string | null {
  return KNOWN_NETWORKS[networkPassphrase.trim()] ?? null;
}

/** "Stellar testnet", "Stellar mainnet", or "a custom Stellar network". */
export function networkDisplayName(networkPassphrase: string = NETWORK_PASSPHRASE): string {
  const name = networkName(networkPassphrase);
  return name ? `Stellar ${name}` : "a custom Stellar network";
}

/** Short form for counters: "testnet", "mainnet", or "this network". */
export function networkShortLabel(networkPassphrase: string = NETWORK_PASSPHRASE): string {
  return networkName(networkPassphrase) ?? "this network";
}

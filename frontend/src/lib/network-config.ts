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

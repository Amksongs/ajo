// Top-level error reporting: contract failures get a hint and a distinct exit code (#284).
import { AjoContractError, ContractErrorCode } from "@ajo/sdk";

/** Any non-contract failure (bad input, network, config). */
export const EXIT_GENERIC = 1;
/** A contract failure whose code isn't recognised. */
export const EXIT_CONTRACT_UNKNOWN = 2;
/** Known contract errors exit with `EXIT_CONTRACT_BASE + code` (11–20), so scripts can branch on them. */
export const EXIT_CONTRACT_BASE = 10;

/** What to do next for each contract error. */
export const CONTRACT_ERROR_HINTS: Record<ContractErrorCode, string> = {
  [ContractErrorCode.CircleNotFound]: "Check the circle id with `ajo circles list`.",
  [ContractErrorCode.CircleFull]: "Pick another circle, or create your own with `ajo circles create`.",
  [ContractErrorCode.AlreadyMember]: "No action needed — you're already in. See `ajo circles show <id>`.",
  [ContractErrorCode.CircleNotForming]: "Membership is locked once a circle starts; join or leave only while it's forming.",
  [ContractErrorCode.CircleNotActive]: "Contributions and payouts only work once the circle is full and active.",
  [ContractErrorCode.NotAMember]: "Join the circle first, or check you're logged in with the right key (`ajo whoami`).",
  [ContractErrorCode.AlreadyContributed]: "You're paid up for this cycle — wait for the payout.",
  [ContractErrorCode.CycleNotReady]: "Wait for the cycle deadline, or for every member to contribute, then retry.",
  [ContractErrorCode.InvalidParams]: "Check the amount, member count and --cycle-secs (see `ajo circles create --help`).",
  [ContractErrorCode.NotAuthorized]: "Only the circle's creator can do that.",
  [ContractErrorCode.Overflow]: "A running total overflowed the contract's accounting — retry with smaller amounts.",
};

export interface CliErrorReport {
  message: string;
  hint: string | null;
  exitCode: number;
}

/** Turn any thrown value into what the CLI prints and the status it exits with. */
export function reportError(err: unknown): CliErrorReport {
  if (err instanceof AjoContractError) {
    if (err.code === null) {
      return { message: err.message, hint: null, exitCode: EXIT_CONTRACT_UNKNOWN };
    }
    return {
      message: err.message,
      hint: CONTRACT_ERROR_HINTS[err.code],
      exitCode: EXIT_CONTRACT_BASE + err.code,
    };
  }
  return {
    message: err instanceof Error ? err.message : String(err),
    hint: null,
    exitCode: EXIT_GENERIC,
  };
}

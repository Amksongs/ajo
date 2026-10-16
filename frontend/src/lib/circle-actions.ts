import { CircleStatus } from "./contract";

/**
 * Whether the connected address may cancel the circle (#323).
 *
 * Mirrors `cancel_circle` in contracts/ajo-circle/src/lib.rs: the circle must
 * still be Forming, and the caller must be the creator *and* still a member
 * (`caller != creator || !is_member` → NotAuthorized, since #103). A creator
 * who has left their own circle can no longer cancel it, so offering the
 * button would only lead to a signed transaction that fails.
 */
export function canCancelCircle(args: {
  status: CircleStatus;
  isCreator: boolean;
  isMember: boolean;
}): boolean {
  return args.status === CircleStatus.Forming && args.isCreator && args.isMember;
}

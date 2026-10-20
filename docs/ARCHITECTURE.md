# Architecture

## No backend, on purpose

Most dApps quietly reintroduce a trusted third party through the back door:
a backend that indexes contract state into a database, builds transactions
on the user's behalf, or gatekeeps which reads/writes are allowed. That
backend's uptime, honesty, and security become part of the trust model —
even though the contract itself is trustless.

Ajo doesn't have one. There is no server between a user's wallet and the
Soroban contract. This has three concrete consequences:

1. **Every write is a direct wallet-signed call.** `frontend/src/lib/contract.ts`
   builds an unsigned transaction, simulates it against Soroban RPC to
   compute fees and footprint, and hands the assembled transaction to the
   connected wallet (Freighter) to sign. The signed transaction is submitted
   straight to RPC — Ajo's own infrastructure never touches it.
2. **Every read is a simulated call, not a database query.** `getCircle`,
   `hasContributed`, `missedCount`, and `totalCircles` all `simulateTransaction`
   against a throwaway, zero-balance account. No funds or prior state are
   required to read — only to write.
3. **Discovery reads the contract's own event log.** "What circles exist?"
   is answered by `getEvents`, filtered to this contract's `(circle,
   created)` topic, not by a database Ajo maintains and could misrepresent.
   See `discoverCircleIds` in `frontend/src/lib/contract.ts`.

## Why join order is payout order

A circle's payout order is fixed the instant it fills, and it's simply
join order: whoever joined first is paid first. This was a deliberate
choice over two alternatives:

- **Creator-assigned order** would require trusting the creator not to pay
  themselves first, or pay a favored member early.
- **On-chain randomization** (e.g. hashing the ledger sequence at
  activation) is well-understood on Stellar but adds a source of
  complexity and a plausible "was this manipulated?" question for a
  reviewer to have to independently verify.

Join order is simpler to reason about, trivially verifiable by reading
`Circle.members` directly, and removes an entire category of "trust the
implementation" concern.

## Why a missed deadline still triggers a partial payout

Requiring every member to contribute before `disburse` can succeed sounds
safer, but it creates a real failure mode: one member who never contributes
freezes everyone else's money in the pot indefinitely, since Soroban
contracts have no way to unilaterally seize a missing member's would-be
contribution.

Instead, `disburse` succeeds once *either* every member has paid, *or* the
cycle deadline has passed — paying out whatever was actually collected.
A non-payer is recorded with a strike (`missed_count`) rather than being
able to hold the group's money hostage. This substantially reduces the
failure mode where one member can freeze everyone else's contributions, but
it is not a guarantee that funds can never get permanently stuck.

Known gaps remain: a `pot +=` overflow can panic during `disburse`, `Circle`
entries can archive without TTL management, a non-token `token` address can
still create an unusable state, and there is no cancel path for an Active
circle. Those issues are tracked separately, and this guarantee should be
requalified until they are fixed.

## Native XLM by default

Circles default to Stellar's native asset. A Stellar Asset Contract (SAC)
token — including a stablecoin — works identically, since `contribute` and
`disburse` both go through the generic `token::Client` interface. Native
XLM is the default specifically so that joining a circle doesn't require a
new trustline first: any wallet already funded with XLM to pay network fees
can join without an extra setup step.

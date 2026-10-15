# Ajo — Rotating Savings Circles on Stellar

**A trustless Ajo/Esusu/Chama/Tanda circle, held by a smart contract instead of a person.**

Ajo digitizes the rotating savings and credit association (ROSCA) — the informal
savings circle known by dozens of names across the world (Ajo/Esusu in
Nigeria, Chama in Kenya, Tanda in Mexico, Susu in Ghana and the Caribbean,
committee/kameti in South Asia). A fixed group of members each contribute the
same amount every cycle; one member takes the full pot per cycle, in
rotation, until everyone's had a turn.

The mechanic works. What's always been fragile is the trust model: an
organizer, or whoever's turn it is to collect, physically holds everyone's
money until payout. If they vanish, get sick, or spend it, there's no
recourse — which is why these circles rarely extend past people who already
know and trust each other.

Ajo keeps the mechanic and removes that single point of failure. A Soroban
smart contract custodies the pot instead of a person, enforces the
contribution schedule, and pays out automatically — trustless by
construction, not by promise.

- **Network:** Stellar / Soroban, testnet


## How it works

1. **Start or join a circle.** Set a contribution amount, a cycle length, and
   a member count. Join order becomes payout order — fixed the moment the
   circle fills, verifiable on-chain, no separate randomization step to
   trust.
2. **Contribute every cycle.** Once full, every member pays their fixed
   contribution into the contract each cycle. Wallets sign directly — Ajo
   never takes custody of a private key.
3. **The contract pays out automatically.** As soon as every member has
   contributed (or the cycle deadline passes, so one non-payer can't freeze
   everyone else's money), the contract releases the full pot to that
   cycle's member. No organizer collects or distributes anything by hand.

## Why this belongs on Stellar

- **Fees in fractions of a cent.** A weekly contribution shouldn't cost more
  in gas than the amount being saved.
- **The contract holds the pot, not a backend.** Every contribution and
  payout is a direct transfer between a member's wallet and the Soroban
  contract — there is no backend in this project with custody of anything.
- **No trustline setup for the common case.** Circles default to Stellar's
  native asset, so joining doesn't require a new token trustline first.
- **A public, permissionless payout history.** Every contribution and payout
  is a Stellar event log entry — independently verifiable, no dashboard to
  trust.

## Architecture

There is deliberately no backend. The frontend talks to the deployed Soroban
contract directly over Stellar RPC, and a connected wallet (e.g.
[Freighter](https://www.freighter.app/)) signs every state-changing call.
Even circle discovery — "what circles exist?" — is read from the contract's
own on-chain event log rather than an indexer database, so there's no
off-chain system whose downtime or dishonesty the trust model has to route
around. See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for the reasoning
behind this and a few other deliberate design choices (join order as payout
order, the missed-deadline partial-payout behavior).

```
contracts/     Soroban contract (Rust) — circle creation, join, contribute,
                disburse, all authorized via require_auth().
frontend/       Next.js web app — landing page and the app itself (create,
                join, contribute, trigger payout). Talks to the contract
                directly; no backend.
sdk/            @ajo/sdk — the same non-custodial client logic that backs
                the frontend, packaged for any third-party app to use.
cli/            @ajo/cli — a terminal client built on @ajo/sdk (create,
                join, contribute, disburse from a script or a shell).
```

## Quick start

```bash
git clone https://github.com/presidoclintonbased-alt/ajo.git
cd ajo

# Smart contract
cd contracts
cargo test --workspace
stellar contract build

# Frontend
cd ../frontend
npm install
cp .env.example .env.local
# fill in NEXT_PUBLIC_AJO_CONTRACT_ID with your deployed contract id
npm run dev
```

See [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) for actually deploying the
contract (there's no upgrade mechanism, so redeploying always means a new
contract id).

The app runs on `:3000`. Install [Freighter](https://www.freighter.app/),
switch it to Stellar testnet, and fund a testnet account via
[the Laboratory](https://laboratory.stellar.org/#account-creator?network=test)
before creating or joining a circle.

## The contract

`contracts/ajo-circle` — core functions:

| Function | What it does |
|---|---|
| `create_circle` | Starts a new circle; the creator is its first member. |
| `join_circle` | Joins a forming circle. Auto-activates once full. |
| `leave_circle` | A member backs out while still `Forming` — no funds are ever at risk here. |
| `cancel_circle` | Creator closes out a circle that never filled. |
| `contribute` | Pays this cycle's contribution into the pot. |
| `disburse` | Pays out the current cycle's recipient once everyone's paid, or the deadline passes. Callable by anyone — no privileged keeper. |
| `get_circle` / `has_contributed` / `missed_count` / `total_circles` | Read-only state, including a per-member missed-contribution strike count. |

Unit tests cover the full rotation (every member paid exactly once,
circle completion, including a 10-member circle), the missed-deadline path
(partial payout, strikes accumulating across repeated misses), leave/cancel,
and every rejected-input case. See `contracts/ajo-circle/src/test.rs`.

## SDK

`sdk/` — the same client logic that backs the frontend, packaged as
`@ajo/sdk` for any third-party app to integrate with directly. See
[sdk/README.md](./sdk/README.md).

## CLI

`cli/` — `@ajo/cli`, a terminal client built on `@ajo/sdk`: create, join,
leave, cancel, contribute, and disburse from a script or a shell instead of
the web app. See [cli/README.md](./cli/README.md).

## Roadmap

- Mainnet deployment.
- Optional off-chain notifications (a cycle deadline is approaching) without
  weakening the fully on-chain trust model above.

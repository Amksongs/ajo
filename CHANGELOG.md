# Changelog

All notable changes to this project are documented here. Format loosely
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). No
versioned releases yet — everything below is unreleased, testnet-only work.

## Unreleased

### Added
- `ajo-circle` Soroban contract: `create_circle`, `join_circle`,
  `leave_circle`, `cancel_circle`, `contribute`, `disburse`, plus read-only
  `get_circle`, `has_contributed`, `missed_count`, and `total_circles`, with
  unit tests in `contracts/ajo-circle/src/test.rs`.
- Frontend: landing page (problem, how it works, why Stellar, FAQ), an
  `/about` page, and the app itself (`/circles`, `/circles/[id]`) — create,
  join, contribute, and trigger payout, all via a directly wallet-signed
  transaction with no backend in between.
- On-chain circle discovery via the contract's own event log — no indexer.
- Frontend test suite (vitest) for the pure formatting and class-merging
  utilities.
- Repo health: `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`,
  issue/PR templates, CI (contract tests + frontend lint/typecheck/test/build).
- `docs/ARCHITECTURE.md` — the reasoning behind the no-backend design, join
  order as payout order, and the missed-deadline partial-payout behavior.
- Repo hygiene: `.editorconfig`, `.nvmrc`, `CODEOWNERS`, Dependabot config
  (npm, cargo, GitHub Actions), a CI concurrency group so overlapping
  pushes cancel the stale run instead of racing it.
- `frontend`: `robots.ts` / `sitemap.ts`, and baseline response security
  headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`,
  `Permissions-Policy`).

### Fixed
- `sdk`: removed the `Circle.securityDeposit` field, which the contract
  doesn't have and was always reported as `0n` (#260).
- CI referenced `npm run typecheck` in the frontend job, but the script
  didn't exist in `frontend/package.json` — the step was silently a no-op.
- The closing CTA section originally used a near-black inverted background,
  the same dark-section convention as other projects rather than Ajo's own
  identity; replaced with the terracotta accent used throughout the rest of
  the site.
- `frontend` typecheck ran `tsc` before `next build` generated `.next/types`,
  so `layout.tsx`'s `LayoutProps<"/">` reference failed CI on every push
  since typed layout props landed; replaced with an explicit `ReactNode` prop
  type that doesn't depend on generated types.
- `submitSignedTx` (both `frontend/src/lib/contract.ts` and
  `sdk/src/client.ts`) polled `getTransaction` in an unbounded loop — a
  dropped transaction that never lands on-chain hung the caller forever.
  Capped at ~60s with a real error on timeout.
- Circle invite links now point at `/circles/join?id=<id>` and land on a join
  CTA instead of silently redirecting to the detail page, so the link that
  the app copies is the one the app actually handles (#177).
- Navbar account dropdown now supports Escape (returning focus to its
  trigger), arrow-key navigation, and `menu`/`menuitem` roles (#114).
- CI jobs now set `timeout-minutes`, so a hung install or build can't hold a
  runner for the default six hours (#170).
- `frontend/.env.example` now documents each variable (including where the
  contract and token ids come from), and the changelog points redeploys at
  `docs/DEPLOYMENT.md`.
- The frontend, SDK, and CLI error maps were missing `ContractError::Overflow`
  (added to the contract in #243), so `Error(Contract, #11)` was surfaced as a
  raw RPC string instead of a readable message. Restored the mapping in all
  three copies, which is what `contract-errors.test.ts` / `errors.test.ts`
  assert against.

### Deployed
- `ajo-circle` contract to Stellar testnet. Redeployed once, after adding
  `total_circles` — redeploying always produces a new contract id, so
  `NEXT_PUBLIC_AJO_CONTRACT_ID` must be updated and the frontend rebuilt and
  redeployed. See `docs/DEPLOYMENT.md` (and `frontend/.env.example` for the
  variables).

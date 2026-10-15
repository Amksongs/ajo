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

### Deployed
- `ajo-circle` contract to Stellar testnet. Redeployed once, after adding
  `total_circles` — see `frontend/.env.example` for which env var to set.

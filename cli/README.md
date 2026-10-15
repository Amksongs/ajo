# @ajo/cli

A terminal client for Ajo rotating savings circles, built on
[`@ajo/sdk`](../sdk). Manage circles from a script or a terminal instead of
the web app.

## Install

```bash
cd sdk && npm install && npm run build   # @ajo/cli depends on the built sdk
cd ../cli && npm install && npm run build
npm link   # optional: makes `ajo` available globally
```

## Usage

```bash
ajo login <secret-key>      # stored in ~/.ajo/config.json, mode 0600 — same
                             # plaintext-on-disk model as the stellar CLI's
                             # own key store
ajo whoami
ajo logout

ajo circles list
ajo circles show <id>
ajo circles create --amount 10 --members 4 --cycle-secs 604800
ajo circles join <id>
ajo circles leave <id>          # only while the circle is still Forming
ajo circles cancel <id>         # creator only, only while Forming
ajo circles contribute <id>
ajo circles disburse <id>       # callable by anyone, not just members
```

Every write command builds the transaction via `@ajo/sdk`, signs it locally
with the stored key, and submits it — the CLI itself never holds custody of
anything beyond the key you explicitly gave it on your own machine.

## Config

`ajo config` prints the current contract id, RPC url, and network
passphrase (defaults to testnet). Edit `~/.ajo/config.json` directly to
point at a different deployment.

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success |
| `1` | Any non-contract failure (bad input, network, config) |
| `2` | The contract rejected the call with an unrecognised error |
| `11`–`20` | The contract rejected the call: `10 + ContractErrorCode` (e.g. `18` = `CycleNotReady`), with a `hint:` line on stderr |

#!/usr/bin/env node
import { Command } from "commander";
import { Keypair, TransactionBuilder } from "@stellar/stellar-sdk";
import { AjoClient, CircleStatus, formatXlm, xlmToStroops } from "@ajo/sdk";
import { loadConfig, saveConfig, configPath } from "./config";
import { parseCycleSecs, parseMembers } from "./validate";
import { reportError } from "./errors";

const STATUS_NAMES: Record<CircleStatus, string> = {
  [CircleStatus.Forming]: "Forming",
  [CircleStatus.Active]: "Active",
  [CircleStatus.Completed]: "Completed",
  [CircleStatus.Cancelled]: "Cancelled",
};

function client(): AjoClient {
  const config = loadConfig();
  return new AjoClient({
    contractId: config.contractId,
    rpcUrl: config.rpcUrl,
    networkPassphrase: config.networkPassphrase,
  });
}

function requireSecretKey(): { secretKey: string; publicKey: string } {
  const config = loadConfig();
  if (!config.secretKey) {
    console.error("Not logged in. Run `ajo login <secret-key>` first.");
    process.exit(1);
  }
  const kp = Keypair.fromSecret(config.secretKey);
  return { secretKey: config.secretKey, publicKey: kp.publicKey() };
}

function signXdr(unsignedXdr: string, secretKey: string): string {
  const config = loadConfig();
  const kp = Keypair.fromSecret(secretKey);
  const tx = TransactionBuilder.fromXDR(unsignedXdr, config.networkPassphrase);
  tx.sign(kp);
  return tx.toXDR();
}

const program = new Command();
/** Shared help text for every `<id>` argument (#72). */
const ID_ARG_HELP = "circle id (see `ajo circles list`)";

program.name("ajo").description("Command-line client for Ajo rotating savings circles").version("0.1.0");

program
  .command("login <secret-key>")
  .description("Store a Stellar secret key locally for signing (kept in ~/.ajo/config.json, mode 0600)")
  .action((secretKey: string) => {
    const kp = Keypair.fromSecret(secretKey); // throws on an invalid key
    const config = loadConfig();
    saveConfig({ ...config, secretKey });
    console.log(`Logged in as ${kp.publicKey()}`);
    console.log(`Stored at ${configPath()} — this file holds your secret key in plaintext, same as the stellar CLI's own key store. Don't commit it or share it.`);
  });

program
  .command("logout")
  .description("Remove the stored secret key")
  .action(() => {
    const config = loadConfig();
    delete config.secretKey;
    saveConfig(config);
    console.log("Logged out.");
  });

program
  .command("whoami")
  .description("Show the currently logged-in public key")
  .action(() => {
    const { publicKey } = requireSecretKey();
    console.log(publicKey);
  });

program
  .command("config")
  .description("Show the current configuration (contract id, network, RPC url)")
  .action(() => {
    const config = loadConfig();
    console.log(JSON.stringify({ ...config, secretKey: config.secretKey ? "[stored]" : undefined }, null, 2));
  });

const circles = program.command("circles").description("Manage rotating savings circles");

circles
  .command("list")
  .description("List circles discovered from the contract's event log")
  .action(async () => {
    const ajo = client();
    const ids = await ajo.discoverCircleIds();
    if (ids.length === 0) {
      console.log("No circles found.");
      return;
    }
    for (const id of ids) {
      const c = await ajo.getCircle(id);
      console.log(
        `#${c.id}  ${STATUS_NAMES[c.status].padEnd(10)}  ${formatXlm(c.contributionAmount)} per member  ${c.members.length}/${c.maxMembers} members`,
      );
    }
  });

async function showCircle(id: string) {
  const ajo = client();
  const c = await ajo.getCircle(BigInt(id));
  console.log(`Circle #${c.id} — ${STATUS_NAMES[c.status]}`);
  console.log(`  Creator:      ${c.creator}`);
  console.log(`  Token:        ${c.token}`);
  console.log(`  Contribution: ${formatXlm(c.contributionAmount)} per member`);
  console.log(`  Members:      ${c.members.length}/${c.maxMembers}`);
  console.log(`  Cycle:        ${c.currentCycle + 1} of ${c.maxMembers}`);
  console.log(`  Payout order:`);
  c.members.forEach((m, i) => console.log(`    ${i + 1}. ${m}${i === c.currentCycle ? "  (next payout)" : ""}`));
}

circles
  .command("show")
  .argument("<id>", ID_ARG_HELP)
  .alias("status")
  .description("Show a circle's full state")
  .action(showCircle);

circles
  .command("create")
  .description("Create a new circle")
  .requiredOption("-a, --amount <xlm>", "contribution per member, in XLM")
  .requiredOption("-m, --members <n>", "number of members")
  .option("-c, --cycle-secs <seconds>", "cycle length in seconds", "604800")
  .option("-t, --token <contractId>", "asset contract id (defaults to native XLM)")
  .action(async (opts: { amount: string; members: string; cycleSecs: string; token?: string }) => {
    const cycleSecs = parseCycleSecs(opts.cycleSecs);
    const members = parseMembers(opts.members);
    const { secretKey, publicKey } = requireSecretKey();
    const config = loadConfig();
    const ajo = client();
    const unsigned = await ajo.buildCreateCircleTx(
      publicKey,
      opts.token ?? config.nativeTokenId,
      xlmToStroops(opts.amount),
      members,
      cycleSecs,
    );
    const circleId = await ajo.submitSignedTx<bigint>(signXdr(unsigned, secretKey));
    console.log(
      circleId === undefined
        ? "Circle created. Run `ajo circles list` to find its id."
        : `Circle created with id ${circleId}.`,
    );
  });

function memberAction(name: "join" | "leave" | "contribute", build: (ajo: AjoClient, id: bigint, pk: string) => Promise<string>) {
  circles
    .command(name)
    .argument("<id>", ID_ARG_HELP)
    .description(`${name[0].toUpperCase()}${name.slice(1)} a circle`)
    .action(async (id: string) => {
      const { secretKey, publicKey } = requireSecretKey();
      const ajo = client();
      const unsigned = await build(ajo, BigInt(id), publicKey);
      await ajo.submitSignedTx(signXdr(unsigned, secretKey));
      console.log(`Done: ${name} on circle #${id}.`);
    });
}

memberAction("join", (ajo, id, pk) => ajo.buildJoinCircleTx(id, pk));
memberAction("leave", (ajo, id, pk) => ajo.buildLeaveCircleTx(id, pk));
memberAction("contribute", (ajo, id, pk) => ajo.buildContributeTx(id, pk));

circles
  .command("cancel")
  .argument("<id>", ID_ARG_HELP)
  .description("Cancel a circle you created, while it's still Forming")
  .action(async (id: string) => {
    const { secretKey, publicKey } = requireSecretKey();
    const ajo = client();
    const unsigned = await ajo.buildCancelCircleTx(BigInt(id), publicKey);
    await ajo.submitSignedTx(signXdr(unsigned, secretKey));
    console.log(`Circle #${id} cancelled.`);
  });

async function disburseCircle(id: string) {
  const { secretKey, publicKey } = requireSecretKey();
  const ajo = client();
  const unsigned = await ajo.buildDisburseTx(BigInt(id), publicKey);
  await ajo.submitSignedTx(signXdr(unsigned, secretKey));
  console.log(`Payout triggered for circle #${id}.`);
}

circles
  .command("disburse")
  .argument("<id>", ID_ARG_HELP)
  .alias("payout")
  .description("Trigger the current cycle's payout — callable by anyone, not just members")
  .action(disburseCircle);

// Top-level shortcuts (#72): `ajo status` / `ajo payout` previously weren't
// commands at all, so `--help` on them fell through to the generic help.
program
  .command("status")
  .argument("<id>", ID_ARG_HELP)
  .description("Show a circle's status, members and payout order (same as `ajo circles show`)")
  .addHelpText("after", "\nExample:\n  $ ajo status 3\n")
  .action(showCircle);

program
  .command("payout")
  .argument("<id>", ID_ARG_HELP)
  .description(
    "Trigger the current cycle's payout for a circle — callable by anyone (same as `ajo circles disburse`). Requires `ajo login`.",
  )
  .addHelpText("after", "\nExample:\n  $ ajo payout 3\n")
  .action(disburseCircle);

// Unknown commands / bad arguments print the relevant usage, not just an error (#72).
program.showHelpAfterError("(run `ajo --help` or `ajo <command> --help` for usage)");

program.parseAsync(process.argv).catch((err) => {
  const { message, hint, exitCode } = reportError(err);
  console.error(message);
  if (hint) console.error(`hint: ${hint}`);
  process.exit(exitCode);
});

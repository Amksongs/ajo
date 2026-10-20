"use client";
// Join page — the target for invite links (`/circles/join?id=<id>`). Resolves
// the id to its circle and offers a join CTA; joining is the point of the
// link, so this page must not just bounce to the detail page (#177).

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button, Card } from "@/components/ui";
import { CircleNotFound } from "@/components/circle-not-found";
import { CircleDetailSkeleton } from "../[id]/circle-detail-skeleton";
import { useWallet } from "@/context/wallet-context";
import {
  Circle,
  CircleStatus,
  ContractCallError,
  NATIVE_TOKEN_ID,
  buildJoinCircleTx,
  getCircle,
  submitSignedTx,
} from "@/lib/contract";
import { ContractErrorCode } from "@/lib/contract-errors";
import { parseCircleId } from "@/lib/circle-id";
import { rememberCircleId } from "@/lib/circle-cache";
import { invalidateCircleCache } from "@/lib/rpc-cache";
import { assetLabel, formatCount, formatCycleLength, formatXlm } from "@/lib/format";
import { signWithWallet, WalletError } from "@/lib/wallet";

type JoinState =
  | { kind: "checking" }
  | { kind: "not-found" }
  | { kind: "error"; message: string }
  | { kind: "ready"; circle: Circle };

export default function JoinCirclePage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
          <Suspense fallback={<CircleDetailSkeleton />}>
            <JoinCircleResolver />
          </Suspense>
        </div>
      </main>
      <Footer />
    </>
  );
}

function JoinCircleResolver() {
  const router = useRouter();
  const rawId = useSearchParams().get("id");
  const circleId = parseCircleId(rawId);
  const { address, connectWallet } = useWallet();
  const [joining, setJoining] = useState(false);

  // Validate before rendering anything circle-specific: a malformed id is
  // rejected immediately, a well-formed one is checked against the contract.
  const [state, setState] = useState<JoinState>(
    circleId === null ? { kind: "not-found" } : { kind: "checking" },
  );

  const title =
    state.kind === "not-found"
      ? "Circle not found · Ajo"
      : state.kind === "ready"
        ? `Join circle #${state.circle.id} · Ajo`
        : "Join a circle · Ajo";

  useEffect(() => {
    document.title = title;
  }, [title]);

  useEffect(() => {
    if (circleId === null) return;
    let cancelled = false;
    getCircle(circleId)
      .then((circle) => {
        if (cancelled) return;
        rememberCircleId(circleId);
        setState({ kind: "ready", circle });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ContractCallError && err.code === ContractErrorCode.CircleNotFound) {
          setState({ kind: "not-found" });
        } else {
          setState({ kind: "error", message: err instanceof Error ? err.message : "Could not load this circle." });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [circleId]);

  async function handleJoin(circle: Circle) {
    setJoining(true);
    try {
      // connectWallet returns the address it just connected, but the context's
      // signTransaction closes over the pre-render `address` — sign with the
      // returned address directly so a first-time visitor can join in one go.
      const wallet = address ?? (await connectWallet());
      const unsignedXdr = await buildJoinCircleTx(circle.id, wallet);
      const signedXdr = await signWithWallet(unsignedXdr, wallet);
      await submitSignedTx(signedXdr);
      toast.success("Joined circle");
      invalidateCircleCache(circle.id);
      router.replace(`/circles/${circle.id}`);
    } catch (err) {
      toast.error(errorMessage(err, "Could not join circle."));
    } finally {
      setJoining(false);
    }
  }

  if (state.kind === "not-found") return <CircleNotFound rawId={rawId} />;
  if (state.kind === "checking") return <CircleDetailSkeleton />;
  if (state.kind === "error") {
    return (
      <Card className="p-6 text-sm text-accent-rose" role="alert">
        {state.message}
      </Card>
    );
  }

  const { circle } = state;
  const isMember = address !== null && circle.members.includes(address);
  const isFull = circle.members.length >= circle.maxMembers;
  const canJoin = circle.status === CircleStatus.Forming && !isMember && !isFull;

  return (
    <Card className="p-8 sm:p-10">
      <p className="eyebrow">Invite</p>
      <h1 className="font-display mt-3 text-3xl italic tracking-tight">Join circle #{circle.id.toString()}</h1>
      <p className="mt-3 max-w-lg text-sm text-muted">
        You&apos;ve been invited to a rotating savings circle. The contract holds the contributions and pays out in
        join order — no organizer in between.
      </p>

      <dl className="mt-8 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted">Contribution</dt>
          <dd className="mt-1 font-medium">
            {formatXlm(circle.contributionAmount)} {assetLabel(circle.token, NATIVE_TOKEN_ID)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Cycle</dt>
          <dd className="mt-1 font-medium">{formatCycleLength(circle.cycleLengthSecs)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Members</dt>
          <dd className="mt-1 font-medium">
            {formatCount(circle.members.length)}/{formatCount(circle.maxMembers)}
          </dd>
        </div>
      </dl>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        {canJoin && (
          <Button onClick={() => handleJoin(circle)} disabled={joining}>
            {joining ? "Joining…" : "Join this circle"}
          </Button>
        )}
        <Link
          href={`/circles/${circle.id}`}
          className="rounded-full border border-border-strong px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-foreground hover:text-background"
        >
          View circle
        </Link>
      </div>

      {!canJoin && <p className="mt-4 text-sm text-muted">{joinUnavailableReason(circle, isMember)}</p>}
    </Card>
  );
}

function joinUnavailableReason(circle: Circle, isMember: boolean): string {
  if (isMember) return "You're already a member of this circle.";
  switch (circle.status) {
    case CircleStatus.Forming:
      return "This circle is already full.";
    case CircleStatus.Active:
      return "This circle is already active, so it isn't accepting new members.";
    case CircleStatus.Completed:
      return "This circle has already completed.";
    case CircleStatus.Cancelled:
      return "This circle was cancelled.";
    default:
      return "This circle isn't accepting new members.";
  }
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof WalletError || err instanceof ContractCallError) return err.message;
  return fallback;
}

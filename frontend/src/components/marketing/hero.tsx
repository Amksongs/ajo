"use client";
// Hero component.

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { getTotalCircles } from "@/lib/contract";
import { networkDisplayName, networkShortLabel } from "@/lib/network-config";

export function Hero() {
  const [totalCircles, setTotalCircles] = useState<bigint | null>(null);

  useEffect(() => {
    getTotalCircles()
      .then(setTotalCircles)
      .catch(() => undefined);
  }, []);

  return (
    <section className="dot-grid relative overflow-hidden border-b border-border">
      <div className="mx-auto max-w-3xl px-4 pb-20 pt-20 text-center sm:px-6 sm:pt-28">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <span className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-card px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-green" />
            <span className="eyebrow !text-foreground">
              {totalCircles !== null
                ? `${totalCircles.toString()} circles created on ${networkShortLabel()}`
                : `Live on ${networkDisplayName()}`}
            </span>
          </span>

          <h1 className="font-display mt-8 text-5xl leading-[1.08] tracking-tight sm:text-7xl">
            Ajo, without
            <br />
            <span className="accent-text italic">trusting a person.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted">
            Ajo, Esusu, Chama, Tanda, Susu — every culture has a version of the rotating savings circle. Ajo keeps
            the tradition and removes the one risk it always carried: the organizer disappearing with the pot.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/circles"
              className="rounded-full bg-accent px-7 py-3 text-center text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
            >
              Start a circle &rarr;
            </Link>
            <a
              href="#how-it-works"
              className="rounded-full px-7 py-3 text-center text-sm font-medium text-foreground transition-colors hover:bg-card"
            >
              See how it works
            </a>
          </div>

          <CircleWheel />
        </motion.div>
      </div>
    </section>
  );
}

const CYCLE = [
  { angle: -90, label: "You", state: "paid" as const },
  { angle: -18, label: "2", state: "paid" as const },
  { angle: 54, label: "3", state: "next" as const },
  { angle: 126, label: "4", state: "waiting" as const },
  { angle: 198, label: "5", state: "waiting" as const },
];

const ORBIT_DURATION = 36;

function CircleWheel() {
  const radius = 42;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, delay: 0.15 }}
      className="relative mx-auto mt-14 aspect-square w-[min(90vw,22rem)] sm:w-[24rem]"
    >
      {/* Fixed center — doesn't participate in the orbit. */}
      <motion.div
        className="card absolute inset-[32%] z-10 flex items-center justify-center text-center"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 0.5 }}
      >
        <div>
          <p className="eyebrow !text-[10px]">Cycle</p>
          <p className="font-display text-2xl italic accent-text">2 of 5</p>
        </div>
      </motion.div>

      {/* Everything below actually orbits — the ring and the members move together. */}
      <motion.div
        className="absolute inset-0"
        animate={{ rotate: 360 }}
        transition={{ duration: ORBIT_DURATION, repeat: Infinity, ease: "linear" }}
      >
        <div className="ring-motif absolute inset-0" />

        {CYCLE.map((member, index) => {
          const rad = (member.angle * Math.PI) / 180;
          const x = 50 + radius * Math.cos(rad);
          const y = 50 + radius * Math.sin(rad);
          return (
            <motion.div
              key={member.label}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${x}%`, top: `${y}%` }}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1, rotate: -360 }}
              transition={{
                opacity: { duration: 0.4, delay: 0.25 + index * 0.1 },
                scale: { duration: 0.4, delay: 0.25 + index * 0.1, type: "spring", stiffness: 260, damping: 18 },
                rotate: { duration: ORBIT_DURATION, repeat: Infinity, ease: "linear" },
              }}
            >
              {/* Counter-rotates against the orbit so the label stays upright while its position travels around the ring. */}
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-full text-sm font-medium sm:h-12 sm:w-12 ${
                  member.state === "paid"
                    ? "bg-accent text-accent-foreground"
                    : member.state === "next"
                      ? "border-2 border-accent bg-card text-accent"
                      : "border border-border-strong bg-card text-muted"
                }`}
              >
                {member.label}
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </motion.div>
  );
}
"use client";
// Navbar component.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, LogOut, Menu, Wallet, X } from "lucide-react";
import { toast } from "sonner";
import { LogoMark } from "./logo-mark";
import { Button } from "./ui/button";
import { useWallet } from "@/context/wallet-context";
import { shortenAddress } from "@/lib/format";
import { WalletError } from "@/lib/wallet";

const NAV_LINKS = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#why-stellar", label: "Why Stellar" },
  { href: "/about", label: "About" },
];

export function Navbar() {
  const pathname = usePathname();
  const { address, connecting, restoring, connectWallet, disconnectWallet } = useWallet();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [lastPathname, setLastPathname] = useState(pathname);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const accountMenuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);

  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    if (menuOpen) setMenuOpen(false);
    if (accountMenuOpen) setAccountMenuOpen(false);
  }

  useEffect(() => {
    if (!accountMenuOpen) return;
    function onClick(event: MouseEvent) {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [accountMenuOpen]);

  useEffect(() => {
    if (!accountMenuOpen) return;
    const container = accountMenuRef.current;
    if (!container) return;

    const items = Array.from(container.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    items[0]?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setAccountMenuOpen(false);
        accountMenuButtonRef.current?.focus();
        return;
      }
      if (items.length === 0) return;
      if (event.key === "Tab") {
        // Let focus move on, but don't leave an invisible menu behind it.
        setAccountMenuOpen(false);
        return;
      }
      if (
        event.key !== "ArrowDown" &&
        event.key !== "ArrowUp" &&
        event.key !== "Home" &&
        event.key !== "End"
      ) {
        return;
      }
      event.preventDefault();
      const current = items.indexOf(document.activeElement as HTMLElement);
      let next = 0;
      if (event.key === "Home") next = 0;
      else if (event.key === "End") next = items.length - 1;
      else if (event.key === "ArrowDown") next = current < 0 ? 0 : (current + 1) % items.length;
      else next = current <= 0 ? items.length - 1 : current - 1;
      items[next]?.focus();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [accountMenuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const container = mobileMenuRef.current;
    if (!container) return;

    const focusables = Array.from(
      container.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
    );
    focusables[0]?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setMenuOpen(false);
        mobileMenuButtonRef.current?.focus();
        return;
      }
      if (event.key !== "Tab" || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  async function handleConnect() {
    try {
      await connectWallet();
      toast.success("Wallet connected");
    } catch (err) {
      toast.error(err instanceof WalletError ? err.message : "Could not connect wallet.");
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full px-3 pt-3 sm:px-6 sm:pt-5">
      <div className="card mx-auto flex max-w-4xl items-center justify-between gap-3 rounded-full px-3 py-2.5 pl-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <LogoMark size={26} />
          <span className="font-display text-[17px] italic text-foreground">Ajo</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-3.5 py-2 text-sm text-muted transition-colors hover:bg-background hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {address ? (
            <div ref={accountMenuRef} className="relative">
              <button
                ref={accountMenuButtonRef}
                id="account-menu-button"
                onClick={() => setAccountMenuOpen((open) => !open)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                    event.preventDefault();
                    setAccountMenuOpen(true);
                  }
                }}
                aria-haspopup="menu"
                aria-expanded={accountMenuOpen}
                aria-controls={accountMenuOpen ? "account-menu" : undefined}
                className="flex items-center gap-2 rounded-full bg-background px-3.5 py-2 text-sm text-foreground transition-colors hover:opacity-80"
              >
                <span className="h-2 w-2 rounded-full bg-accent-green" />
                {shortenAddress(address)}
                <ChevronDown size={14} className={`transition-transform ${accountMenuOpen ? "rotate-180" : ""}`} />
              </button>

              {accountMenuOpen && (
                <motion.div
                  id="account-menu"
                  role="menu"
                  aria-labelledby="account-menu-button"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15 }}
                  className="card absolute right-0 mt-2 w-52 overflow-hidden py-1"
                >
                  <p role="presentation" className="truncate border-b border-border px-3.5 py-2.5 text-xs text-muted">
                    {address}
                  </p>
                  <button
                    role="menuitem"
                    tabIndex={-1}
                    onClick={() => {
                      disconnectWallet();
                      toast.success("Wallet disconnected");
                    }}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-foreground hover:bg-background"
                  >
                    <LogOut size={15} className="text-muted" />
                    Disconnect
                  </button>
                </motion.div>
              )}
            </div>
          ) : restoring ? (
            <WalletPlaceholder className="h-9 w-36" />
          ) : (
            <Button onClick={handleConnect} disabled={connecting} size="sm">
              <Wallet size={14} />
              {connecting ? "Connecting…" : "Connect wallet"}
            </Button>
          )}
          <Link
            href="/circles"
            className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-85"
          >
            Circles
          </Link>
        </div>

        <button
          ref={mobileMenuButtonRef}
          className="flex h-9 w-9 items-center justify-center text-foreground md:hidden"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {menuOpen && (
        <motion.div
          ref={mobileMenuRef}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="card mx-auto mt-2 max-w-4xl px-4 py-4 md:hidden"
        >
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="rounded-full px-3.5 py-2 text-sm text-muted hover:text-foreground">
                {link.label}
              </Link>
            ))}
            <Link href="/circles" className="rounded-full px-3.5 py-2 text-sm text-muted hover:text-foreground">
              Circles
            </Link>
            <div className="my-2 h-px bg-border" />
            {address ? (
              <>
                <p className="truncate px-3.5 py-1 text-xs text-muted">{address}</p>
                <button onClick={disconnectWallet} className="flex items-center gap-2.5 px-3.5 py-2 text-left text-sm text-foreground">
                  <LogOut size={15} className="text-muted" />
                  Disconnect
                </button>
              </>
            ) : restoring ? (
              <WalletPlaceholder className="mt-1 h-10 w-full" />
            ) : (
              <Button onClick={handleConnect} disabled={connecting} className="mt-1">
                <Wallet size={14} />
                {connecting ? "Connecting…" : "Connect wallet"}
              </Button>
            )}
          </nav>
        </motion.div>
      )}
    </header>
  );
}

/**
 * Neutral stand-in for the wallet control while the silent reconnect is in
 * flight, so neither "Connect wallet" nor an address is shown prematurely.
 */
function WalletPlaceholder({ className = "" }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Checking wallet connection"
      className={`block animate-pulse rounded-full bg-border ${className}`}
    />
  );
}

import { EventEmitter } from "node:events";
import { PassThrough, Readable } from "node:stream";
import { describe, expect, it } from "vitest";

import { chooseSecretSource, promptHidden, readSecretFromStream } from "./secretInput";

describe("chooseSecretSource (#287)", () => {
  it("prompts on a TTY when no argument or flag is given", () => {
    expect(chooseSecretSource({ stdinIsTTY: true })).toBe("prompt");
  });

  it("reads stdin when it is piped", () => {
    expect(chooseSecretSource({ stdinIsTTY: false })).toBe("stdin");
  });

  it("--stdin wins even on a TTY or alongside an argument", () => {
    expect(chooseSecretSource({ stdinFlag: true, stdinIsTTY: true })).toBe("stdin");
    expect(chooseSecretSource({ stdinFlag: true, positional: "S...", stdinIsTTY: true })).toBe("stdin");
  });

  it("still honours the deprecated positional argument", () => {
    expect(chooseSecretSource({ positional: "S...", stdinIsTTY: true })).toBe("argument");
  });
});

describe("readSecretFromStream (#287)", () => {
  it("returns the first line, trimmed", async () => {
    await expect(readSecretFromStream(Readable.from(["  SABC123  \n", "ignored\n"]))).resolves.toBe("SABC123");
  });

  it("handles CRLF and empty input", async () => {
    await expect(readSecretFromStream(Readable.from(["SXYZ\r\n"]))).resolves.toBe("SXYZ");
    await expect(readSecretFromStream(Readable.from([]))).resolves.toBe("");
  });
});

// Minimal TTY stand-in: records raw-mode toggles and lets the test type keys.
function fakeTty() {
  const tty = Object.assign(new EventEmitter(), {
    isRaw: false,
    rawCalls: [] as boolean[],
    setRawMode(mode: boolean) {
      this.rawCalls.push(mode);
      this.isRaw = mode;
    },
    resume() {},
    pause() {},
    setEncoding() {},
  });
  return tty;
}

describe("promptHidden (#287)", () => {
  it("never echoes the typed secret and restores the terminal", async () => {
    const tty = fakeTty();
    const out = new PassThrough();
    let written = "";
    out.on("data", (d) => (written += d.toString()));

    const pending = promptHidden("Secret key: ", tty as never, out);
    tty.emit("data", "SSECRET");
    tty.emit("data", "X\u007f"); // typo + backspace
    tty.emit("data", "\r");

    await expect(pending).resolves.toBe("SSECRET");
    expect(written).toContain("Secret key: ");
    expect(written).not.toContain("SSECRET");
    expect(tty.rawCalls).toEqual([true, false]);
    expect(tty.listenerCount("data")).toBe(0);
  });

  it("rejects on Ctrl-C", async () => {
    const tty = fakeTty();
    const pending = promptHidden("Secret key: ", tty as never, new PassThrough());
    tty.emit("data", "\u0003");
    await expect(pending).rejects.toThrow("Login cancelled.");
    expect(tty.isRaw).toBe(false);
  });
});

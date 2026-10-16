// Reading the login secret without putting it on the command line (#287).
//
// A positional `ajo login S…` lands in shell history and is visible to other
// local users via `ps` while the process runs, which defeats the 0600
// permissions on ~/.ajo/config.json. These helpers read it from a hidden TTY
// prompt or from stdin instead.

export type SecretSource = "argument" | "stdin" | "prompt";

/**
 * Decide where the secret comes from. An explicit `--stdin` wins; otherwise a
 * (deprecated) positional argument is honoured; otherwise prompt on a TTY, or
 * read stdin when it's piped (e.g. `pass show ajo | ajo login`).
 */
export function chooseSecretSource(opts: {
  positional?: string;
  stdinFlag?: boolean;
  stdinIsTTY: boolean;
}): SecretSource {
  if (opts.stdinFlag) return "stdin";
  if (opts.positional) return "argument";
  return opts.stdinIsTTY ? "prompt" : "stdin";
}

/** Read all of a stream and return it trimmed (first line only). */
export async function readSecretFromStream(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : (chunk as Buffer));
  }
  return Buffer.concat(chunks).toString("utf8").split(/\r?\n/)[0].trim();
}

type RawInput = NodeJS.ReadStream & { setRawMode?: (mode: boolean) => unknown };

/**
 * Prompt for a secret on a TTY without echoing it. The prompt goes to
 * `output` (stderr by default) so stdout stays clean for scripting.
 */
export function promptHidden(
  question: string,
  input: RawInput = process.stdin,
  output: NodeJS.WritableStream = process.stderr,
): Promise<string> {
  return new Promise((resolve, reject) => {
    output.write(question);
    let value = "";
    const wasRaw = Boolean(input.isRaw);
    input.setRawMode?.(true);
    input.resume();
    input.setEncoding("utf8");

    const cleanup = () => {
      input.setRawMode?.(wasRaw);
      input.pause();
      input.removeListener("data", onData);
      output.write("\n");
    };

    function onData(data: string) {
      for (const ch of data) {
        if (ch === "\r" || ch === "\n" || ch === "\u0004") {
          cleanup();
          resolve(value.trim());
          return;
        }
        if (ch === "\u0003") {
          cleanup();
          reject(new Error("Login cancelled."));
          return;
        }
        if (ch === "\u007f" || ch === "\b") {
          value = value.slice(0, -1);
          continue;
        }
        value += ch;
      }
    }

    input.on("data", onData);
  });
}

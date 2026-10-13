import { type ChildProcess, type SpawnOptions, spawn, spawnSync } from "node:child_process";

type ShutdownSignal = "SIGINT" | "SIGTERM";

interface ManagedProcessOptions extends SpawnOptions {
  onSignal?: (signal: ShutdownSignal) => void;
}

const quoteWindowsCmdArg = (value: string) => {
  if (value.length === 0) return '""';
  if (!/[\s"]/.test(value) && !/[%^&<>|()]/.test(value)) return value;
  return `"${value.replaceAll('"', '""')}"`;
};

function spawnCommand(command: string, args: string[], options: SpawnOptions): ChildProcess {
  if (process.platform !== "win32") {
    return spawn(command, args, { ...options, detached: true });
  }

  const commandLine = [command, ...args].map(quoteWindowsCmdArg).join(" ");
  return spawn("cmd.exe", ["/d", "/s", "/c", commandLine], {
    ...options,
    shell: false,
    windowsHide: false,
  });
}

export function signalTree(pid: number, signal: ShutdownSignal, force = false): void {
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(pid), "/t", ...(force ? ["/f"] : [])], {
      stdio: "ignore",
      windowsHide: true,
    });
    return;
  }

  try {
    process.kill(-pid, force ? "SIGKILL" : signal);
  } catch {
    try {
      process.kill(pid, force ? "SIGKILL" : signal);
    } catch {
      // The process may have exited between the close event and cleanup.
    }
  }
}

function waitForClose(child: ChildProcess, timeoutMs: number): Promise<boolean> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = setTimeout(() => finish(false), timeoutMs);
    const finish = (closed: boolean) => {
      clearTimeout(timer);
      child.off("close", onClose);
      resolve(closed);
    };
    const onClose = () => finish(true);
    child.once("close", onClose);
  });
}

export async function stopTree(
  child: ChildProcess,
  signal: ShutdownSignal = "SIGTERM",
): Promise<void> {
  if (!child.pid) return;

  signalTree(child.pid, signal);
  if (await waitForClose(child, 5000)) return;

  signalTree(child.pid, signal, true);
  await waitForClose(child, 1000);
}

/** Runs a long-lived command with signal forwarding and process-tree cleanup. */
export async function runManagedProcess(
  command: string,
  args: string[],
  { onSignal, ...options }: ManagedProcessOptions,
): Promise<number> {
  const child = spawnCommand(command, args, options);
  let receivedSignal: ShutdownSignal | undefined;
  let shutdown: Promise<void> | undefined;
  let spawnError: Error | undefined;
  child.once("error", (error) => {
    spawnError = error;
    console.error(`Could not start ${command}: ${error.message}`);
  });

  const close = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
    child.once("close", (code, signal) => resolve({ code, signal }));
  });
  const stop = (signal: ShutdownSignal) => {
    if (receivedSignal) return;
    receivedSignal = signal;
    onSignal?.(signal);
    shutdown = stopTree(child, signal);
  };
  const onInterrupt = () => stop("SIGINT");
  const onTerminate = () => stop("SIGTERM");
  process.once("SIGINT", onInterrupt);
  process.once("SIGTERM", onTerminate);

  try {
    const result = await close;
    await shutdown;
    if (receivedSignal) return receivedSignal === "SIGINT" ? 130 : 143;
    if (spawnError) return 1;
    if (result.code !== null) return result.code;
    if (result.signal === "SIGINT") return 130;
    if (result.signal === "SIGTERM") return 143;
    if (result.signal === "SIGKILL") return 137;
    return result.signal ? 1 : 0;
  } finally {
    process.off("SIGINT", onInterrupt);
    process.off("SIGTERM", onTerminate);
  }
}

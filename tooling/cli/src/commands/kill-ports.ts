import { run } from "../lib/exec.ts";

/**
 * Standard development ports for uguroezdamar.com apps and Next.js fallbacks:
 * 3100: Web app (@ugur/site)
 * 3101: Admin portal (@ugur/portal)
 * 3102: Next.js standard alternate/fallback port
 * 3103: Next.js secondary alternate port
 * 4983: Drizzle Studio (@ugur/server)
 */
export const DEFAULT_PORTS = [3100, 3101, 3102, 3103, 4983] as const;

/**
 * Full range of development ports used by local web servers and tooling.
 */
export const ALL_DEV_PORTS = [
  3100, 3101, 3102, 3103, 3104, 3105, 3106, 3107, 3108, 3109, 3110, 4983,
] as const;

export interface KillPortsOptions {
  ports?: Array<number | string>;
  all?: boolean;
}

export function resolvePorts(options: KillPortsOptions = {}): number[] {
  if (options.all) {
    return [...ALL_DEV_PORTS];
  }
  if (options.ports && options.ports.length > 0) {
    const parsed = options.ports
      .flatMap((p) => String(p).split(","))
      .map((p) => Number(p.trim()))
      .filter((p) => Number.isInteger(p) && p > 0 && p <= 65535);
    if (parsed.length > 0) {
      return [...new Set(parsed)].sort((a, b) => a - b);
    }
  }
  return [...DEFAULT_PORTS];
}

/** Stops processes listening on the local development ports used by uguroezdamar.com apps or specified by the user. */
export function killPorts(options: KillPortsOptions = {}): number {
  const targetPorts = resolvePorts(options);

  if (process.platform === "win32") {
    const script = [
      "$ProgressPreference = 'SilentlyContinue'",
      `$targetPorts = @(${targetPorts.join(", ")})`,
      "$conns = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |",
      "  Where-Object { $targetPorts -contains $_.LocalPort }",
      "$results = @()",
      "foreach ($c in $conns) {",
      "  $procId = $c.OwningProcess",
      "  if ($procId -gt 4) {",
      "    $p = Get-Process -Id $procId -ErrorAction SilentlyContinue",
      "    $pName = if ($p) { $p.ProcessName } else { 'process' }",
      "    $localPort = $c.LocalPort",
      "    try {",
      "      & taskkill.exe /T /PID $procId 2>$null | Out-Null",
      "      Start-Sleep -Milliseconds 500",
      "      if (Get-Process -Id $procId -ErrorAction SilentlyContinue) {",
      "        & taskkill.exe /F /T /PID $procId 2>$null | Out-Null",
      "      }",
      "    } catch {}",
      '    $results += "$localPort|$procId|$pName"',
      "  }",
      "}",
      "$results | Select-Object -Unique | Write-Output",
    ].join("\n");
    const encoded = Buffer.from(script, "utf16le").toString("base64");
    const result = run("powershell", ["-NoProfile", "-EncodedCommand", encoded], {
      capture: true,
    });
    if (result.code !== 0) {
      process.stderr.write(result.stderr);
      return result.code;
    }
    const lines = result.stdout
      .trim()
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      console.log(`No processes listening on target ports (${targetPorts.join(", ")}).`);
      return 0;
    }

    const seen = new Set<string>();
    console.log(`Stopped ${lines.length} listener${lines.length === 1 ? "" : "s"}:`);
    for (const line of lines) {
      const [port, pid, name] = line.split("|");
      const key = `${port}:${pid}`;
      if (!seen.has(key)) {
        seen.add(key);
        console.log(`  ✓ ${name || "process"} (PID ${pid}) on port ${port}`);
      }
    }
    return 0;
  }

  const portArgs = targetPorts.flatMap((port) => ["-i", `:${port}`]);
  const result = run("lsof", ["-tiTCP", ...portArgs, "-sTCP:LISTEN"], { capture: true });
  if (result.code !== 0 && result.stderr.trim()) {
    process.stderr.write(result.stderr);
    return result.code;
  }

  const pids = [
    ...new Set(
      result.stdout
        .trim()
        .split(/\s+/)
        .filter((pid) => /^\d+$/.test(pid) && Number(pid) > 1),
    ),
  ];
  if (pids.length === 0) {
    console.log(`No processes listening on target ports (${targetPorts.join(", ")}).`);
    return 0;
  }

  run("kill", ["-TERM", ...pids]);
  const gracefulDeadline = Date.now() + 1500;
  while (Date.now() < gracefulDeadline) {
    const alive = pids.filter((pid) => run("kill", ["-0", pid], { capture: true }).code === 0);
    if (alive.length === 0) break;
    // Give development servers a short window to close sockets and child processes cleanly.
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  }
  const remaining = pids.filter((pid) => run("kill", ["-0", pid], { capture: true }).code === 0);
  if (remaining.length > 0) run("kill", ["-KILL", ...remaining]);
  console.log(
    `Stopped ${pids.length} process${pids.length === 1 ? "" : "es"} on ports (${targetPorts.join(", ")}): PIDs ${pids.join(", ")}`,
  );
  return 0;
}

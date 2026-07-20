import { execFile, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { basename } from "node:path";

export type ManagedProcess = {
  child: ChildProcessWithoutNullStreams;
  exit: Promise<{ code: number | null; signal: NodeJS.Signals | null }>;
};

export function spawnManagedProcess(input: {
  command: string;
  args: readonly string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
}): ManagedProcess {
  const child = spawn(input.command, [...input.args], {
    cwd: input.cwd,
    env: input.env,
    detached: process.platform !== "win32",
    shell: false,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const exit = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
    (resolvePromise, rejectPromise) => {
      child.once("error", rejectPromise);
      child.once("exit", (code, signal) => resolvePromise({ code, signal }));
    },
  );
  return { child, exit };
}

function execFilePromise(command: string, args: readonly string[]) {
  return new Promise<void>((resolvePromise) => {
    execFile(
      command,
      [...args],
      { windowsHide: true, timeout: 10_000 },
      () => resolvePromise(),
    );
  });
}

function captureProcess(
  command: string,
  args: readonly string[],
): Promise<{ code: number | null; stdout: string }> {
  return new Promise((resolvePromise) => {
    execFile(
      command,
      [...args],
      { windowsHide: true, timeout: 10_000, encoding: "utf8" },
      (error, stdout) => {
        resolvePromise({
          code:
            error && typeof error === "object" && "code" in error
              ? Number(error.code)
              : 0,
          stdout,
        });
      },
    );
  });
}

export type StaleProcessReaperResult =
  | "missing"
  | "terminated"
  | "unverified"
  | "failed";

export type StaleProcessReaper = (input: {
  processId: number;
  workspacePath: string;
  providerRunId: string | null;
}) => Promise<StaleProcessReaperResult>;

export const reapStaleCodexProcess: StaleProcessReaper = async (input) => {
  if (!Number.isSafeInteger(input.processId) || input.processId <= 0) {
    return "unverified";
  }
  let name = "";
  let commandLine = "";
  if (process.platform === "win32") {
    const script = [
      `$p = Get-CimInstance Win32_Process -Filter \"ProcessId = ${input.processId}\" -ErrorAction SilentlyContinue`,
      "if ($null -eq $p) { exit 3 }",
      "$p | Select-Object ProcessId,Name,ExecutablePath,CommandLine | ConvertTo-Json -Compress",
    ].join("; ");
    const inspected = await captureProcess("powershell.exe", [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      script,
    ]);
    if (inspected.code === 3 || !inspected.stdout.trim()) return "missing";
    if (inspected.code !== 0) return "failed";
    try {
      const value = JSON.parse(inspected.stdout) as {
        Name?: unknown;
        ExecutablePath?: unknown;
        CommandLine?: unknown;
      };
      name = String(value.Name ?? basename(String(value.ExecutablePath ?? "")));
      commandLine = String(value.CommandLine ?? "");
    } catch {
      return "failed";
    }
  } else {
    const inspected = await captureProcess("ps", [
      "-p",
      String(input.processId),
      "-o",
      "comm=",
      "-o",
      "args=",
    ]);
    if (inspected.code !== 0 || !inspected.stdout.trim()) return "missing";
    const [firstLine = "", ...rest] = inspected.stdout.trim().split(/\r?\n/u);
    name = firstLine.trim().split(/\s+/u)[0] ?? "";
    commandLine = [firstLine, ...rest].join(" ");
  }

  const normalizedName = basename(name).toLowerCase();
  const normalizedCommand = commandLine.toLowerCase();
  const markers = [input.workspacePath, input.providerRunId]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase());
  if (
    !/^codex(?:\.exe)?$/u.test(normalizedName) ||
    !normalizedCommand.includes("exec") ||
    !markers.some((marker) => normalizedCommand.includes(marker))
  ) {
    return "unverified";
  }

  if (process.platform === "win32") {
    const terminated = await captureProcess("taskkill.exe", [
      "/PID",
      String(input.processId),
      "/T",
      "/F",
    ]);
    return terminated.code === 0 ? "terminated" : "failed";
  }
  try {
    process.kill(-input.processId, "SIGTERM");
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await new Promise<void>((resolvePromise) =>
        setTimeout(resolvePromise, 50),
      );
      try {
        process.kill(-input.processId, 0);
      } catch {
        return "terminated";
      }
    }
    process.kill(-input.processId, "SIGKILL");
    await new Promise<void>((resolvePromise) => setTimeout(resolvePromise, 50));
    try {
      process.kill(-input.processId, 0);
      return "failed";
    } catch {
      return "terminated";
    }
  } catch {
    return "failed";
  }
};

export async function terminateProcessTree(
  child: Pick<ChildProcessWithoutNullStreams, "pid" | "kill" | "killed">,
) {
  if (!child.pid || child.killed) return;

  if (process.platform === "win32") {
    await execFilePromise("taskkill.exe", [
      "/PID",
      String(child.pid),
      "/T",
      "/F",
    ]);
    if (!child.killed) child.kill();
    return;
  }

  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}

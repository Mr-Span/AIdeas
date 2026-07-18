import { execFile } from "node:child_process";

import type { ProviderHealth } from "./contracts";

const SAFE_ENVIRONMENT_KEYS = [
  "APPDATA",
  "CODEX_HOME",
  "CODEX_SQLITE_HOME",
  "COMSPEC",
  "HOME",
  "HOMEDRIVE",
  "HOMEPATH",
  "LANG",
  "LC_ALL",
  "LOCALAPPDATA",
  "PATH",
  "PATHEXT",
  "SYSTEMROOT",
  "TEMP",
  "TMP",
  "USERPROFILE",
  "WINDIR",
] as const;

export type CodexLocalProbe = () => Promise<ProviderHealth>;

export function buildCodexEnvironment(
  source: Readonly<Record<string, string | undefined>> = process.env,
): Record<string, string> {
  const environment: Record<string, string> = {};
  for (const key of SAFE_ENVIRONMENT_KEYS) {
    const value = source[key];
    if (value) environment[key] = value;
  }
  return environment;
}

function runCodexCommand(args: readonly string[], environment: Record<string, string>) {
  const command = process.platform === "win32" ? environment.COMSPEC ?? "cmd.exe" : "codex";
  const commandArgs =
    process.platform === "win32"
      ? ["/d", "/s", "/c", `codex.cmd ${args.join(" ")}`]
      : [...args];

  return new Promise<string>((resolvePromise, rejectPromise) => {
    execFile(
      command,
      commandArgs,
      {
        env: environment as NodeJS.ProcessEnv,
        timeout: 10_000,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        const output = `${stdout}\n${stderr}`.trim();
        if (error) {
          rejectPromise(new Error("Codex local preflight failed."));
          return;
        }
        resolvePromise(output);
      },
    );
  });
}

export function createCodexLocalProbe(
  environment = buildCodexEnvironment(),
): CodexLocalProbe {
  return async () => {
    try {
      const [versionOutput, authOutput] = await Promise.all([
        runCodexCommand(["--version"], environment),
        runCodexCommand(["login", "status"], environment),
      ]);
      const normalizedAuth = authOutput.toLowerCase();
      const authMode = normalizedAuth.includes("chatgpt")
        ? "chatgpt"
        : normalizedAuth.includes("api key")
          ? "api_key"
          : "unknown";
      const authenticated = normalizedAuth.includes("logged in");

      if (!authenticated) {
        return {
          provider: "codex",
          status: "blocked",
          version: versionOutput || null,
          authMode,
          code: "auth_required",
          detail: "Codex is not authenticated on the trusted host.",
        } satisfies ProviderHealth;
      }

      return {
        provider: "codex",
        status: "ready",
        version: versionOutput || null,
        authMode,
        detail: "Codex is installed and authenticated on the trusted host.",
      } satisfies ProviderHealth;
    } catch {
      return {
        provider: "codex",
        status: "blocked",
        version: null,
        authMode: "unknown",
        code: "provider_unavailable",
        detail: "Codex CLI is unavailable on the trusted host.",
      } satisfies ProviderHealth;
    }
  };
}

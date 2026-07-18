import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type AI003WorkspaceFixture = {
  root: string;
  workspace: string;
  cleanup: () => void;
};

export function createAI003WorkspaceFixture(): AI003WorkspaceFixture {
  const root = mkdtempSync(join(tmpdir(), "aideas-ai003-"));
  const workspace = join(root, "fixture-repository");
  mkdirSync(workspace);
  writeFileSync(
    join(workspace, "README.md"),
    "# AI-003 synthetic fixture\n\nThis repository contains synthetic public-safe data only.\n",
    "utf8",
  );
  execFileSync("git", ["init", "--initial-branch=main"], {
    cwd: workspace,
    stdio: "ignore",
  });
  execFileSync("git", ["add", "README.md"], { cwd: workspace, stdio: "ignore" });
  execFileSync(
    "git",
    [
      "-c",
      "user.name=AIdeas Fixture",
      "-c",
      "user.email=fixture@example.invalid",
      "commit",
      "-m",
      "Add synthetic fixture",
    ],
    { cwd: workspace, stdio: "ignore" },
  );

  return {
    root,
    workspace,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

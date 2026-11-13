import { describe, it, expect } from "vitest";
import { drizzleGuardProblem } from "../../../drizzle.config";

const run = (...a: string[]) => ["node", "drizzle-kit", ...a];

describe("drizzle manual-command guard", () => {
  for (const cmd of ["push", "pull", "migrate", "generate", "studio", "drop"]) {
    it(`blocks ${cmd} without platform URL`, () => {
      expect(drizzleGuardProblem(run(cmd), undefined)).toMatch(/disabled/);
      expect(drizzleGuardProblem(run(cmd), "  ")).toMatch(/disabled/);
    });
  }
  it("allows platform check and custom generate", () => {
    expect(drizzleGuardProblem(run("check"), undefined)).toBeNull();
    expect(drizzleGuardProblem(run("generate", "--custom"), undefined)).toBeNull();
  });
  it("allows any command when platform URL is present", () => {
    expect(drizzleGuardProblem(run("migrate"), "postgres://platform")).toBeNull();
  });
});

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const packageJsonPath = fileURLToPath(new URL("../package.json", import.meta.url));
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { bin: Record<string, string> };

describe("root package.json bin map", () => {
  test("#given the renamed bin map #when inspecting entries #then the omo bin entry is absent", () => {
    // when
    const hasOmoEntry = Object.prototype.hasOwnProperty.call(packageJson.bin, "omo");

    // then
    expect(hasOmoEntry).toBe(false);
  });

  test("#given the OpenCode-only bin map #when inspecting entries #then hustler-opencode points at its launcher", () => {
    // then
    expect(packageJson.bin["hustler-opencode"]).toBe("bin/hustler-opencode.js");
  });

  test("#given the OpenCode-only bin map #when inspecting entries #then no deleted harness aliases remain", () => {
    // then
    expect(Object.keys(packageJson.bin)).toEqual(["hustler-opencode"]);
  });
});

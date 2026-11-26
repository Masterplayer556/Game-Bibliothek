import { describe, expect, it } from "vitest";
import { normalizeBasePath, withBasePath } from "./base-path";

describe("base path", () => {
  it("cleans the configured value", () => {
    expect(normalizeBasePath(undefined)).toBe("");
    expect(normalizeBasePath("")).toBe("");
    expect(normalizeBasePath("/")).toBe("");
    expect(normalizeBasePath("/Game-Bibliothek")).toBe("/Game-Bibliothek");
    expect(normalizeBasePath("/Game-Bibliothek/")).toBe("/Game-Bibliothek");
    expect(normalizeBasePath("Game-Bibliothek")).toBe("/Game-Bibliothek");
  });

  it("builds file URLs without double slashes", () => {
    expect(withBasePath("/icon-96.png", "/Game-Bibliothek")).toBe("/Game-Bibliothek/icon-96.png");
    expect(withBasePath("icon-96.png", "")).toBe("/icon-96.png");
    expect(withBasePath("/icon-96.png", normalizeBasePath("/"))).toBe("/icon-96.png");
  });
});

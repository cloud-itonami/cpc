/**
 * Pure-helper tests — CPC numeric hierarchy decomposition.
 *
 * These lock the strict prefix-hierarchy of CPC Ver.2.1 (section 1-digit …
 * subclass 5-digit) so the seeder cannot mis-level or mis-parent a code. CPC's
 * structure is a constitutional fact of the revision; if these fail it's a
 * deliberate revision change, not a regression.
 */

import { describe, expect, it } from "vitest";
import {
  ancestorsOf,
  cpcLevel,
  hierarchyOf,
  isValidCpcCode,
  parentOf,
} from "./types.js";
import { toCpcProduct } from "./seed.js";

describe("isValidCpcCode", () => {
  it.each(["0", "01", "011", "0111", "01110"])("accepts %s", (c) => {
    expect(isValidCpcCode(c)).toBe(true);
  });
  it.each(["", "012345", "0a", "abc", " 01", "01.1"])("rejects %s", (c) => {
    expect(isValidCpcCode(c)).toBe(false);
  });
});

describe("cpcLevel", () => {
  it.each([
    ["0", "section"],
    ["01", "division"],
    ["011", "group"],
    ["0111", "class"],
    ["01110", "subclass"],
  ])("%s → %s", (code, level) => {
    expect(cpcLevel(code)).toBe(level);
  });
  it("throws on invalid code", () => {
    expect(() => cpcLevel("012345")).toThrow();
  });
});

describe("parentOf", () => {
  it("section has null parent", () => {
    expect(parentOf("0")).toBeNull();
  });
  it.each([
    ["01", "0"],
    ["011", "01"],
    ["0111", "011"],
    ["01110", "0111"],
  ])("%s → %s", (code, parent) => {
    expect(parentOf(code)).toBe(parent);
  });
});

describe("ancestorsOf", () => {
  it("section-first ancestor chain, excluding self", () => {
    expect(ancestorsOf("01110")).toEqual(["0", "01", "011", "0111"]);
  });
  it("section has no ancestors", () => {
    expect(ancestorsOf("0")).toEqual([]);
  });
});

describe("hierarchyOf", () => {
  it("decomposes a subclass fully", () => {
    expect(hierarchyOf("01110")).toEqual({
      level: "subclass",
      section: "0",
      division: "01",
      group: "011",
      class: "0111",
      parent: "0111",
    });
  });
  it("a section has only section + null parent", () => {
    expect(hierarchyOf("0")).toEqual({
      level: "section",
      section: "0",
      division: undefined,
      group: undefined,
      class: undefined,
      parent: null,
    });
  });
});

describe("toCpcProduct (seeder derivation)", () => {
  it("derives level/section/parent from code", () => {
    const p = toCpcProduct({ code: "0111", titleEn: "Cereals" });
    expect(p.level).toBe("class");
    expect(p.section).toBe("0");
    expect(p.parent).toBe("011");
    expect(p.publishedAt).toBe("2015-01-01T00:00:00Z");
  });
  it("rejects an invalid code", () => {
    expect(() => toCpcProduct({ code: "999999", titleEn: "x" })).toThrow();
  });
});

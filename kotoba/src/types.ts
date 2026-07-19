/**
 * cpc kotoba — record types + pure hierarchy helpers.
 *
 * Mirrors the com.etzhayyim.apps.cpc.product Lexicon record shape. UN Central
 * Product Classification (CPC Ver.2.1) — a public, 3-axis-clean product
 * taxonomy. Per ADR-2605203000 Option B + ADR-2605172000 (kotoba substrate).
 *
 * CPC is purely numeric and strictly prefix-hierarchical (unlike ISIC, whose
 * sections are letters): each level is a 1-digit-longer prefix of the next.
 *
 *   Section  1 digit   (0–9)
 *   Division 2 digits
 *   Group    3 digits
 *   Class    4 digits
 *   Subclass 5 digits
 *
 * Identity hierarchy:
 *   did:web:cpc.etzhayyim.com                       — controller
 *   did:web:cpc.etzhayyim.com:product:{code}        — a CPC product node
 */

export const CPC_DID_PREFIX = "did:web:cpc.etzhayyim.com:" as const;

export type CpcLevel =
  | "section"
  | "division"
  | "group"
  | "class"
  | "subclass";

export interface CpcProduct {
  /** CPC code, 1–5 digits (canonical key). */
  code: string;
  /** Canonical English title. */
  titleEn: string;
  /** Hierarchy level, derived from code length. */
  level: CpcLevel;
  /** 1-digit section (= code[0]). */
  section: string;
  /** Parent code (one digit shorter), or null for a section. */
  parent: string | null;
  description?: string;
  /** Cross-references to ISIC Rev.4 activity codes, where published. */
  isicRefs?: string[];
  source?: string;
  /** ISO datetime the code was published in the CPC version. */
  publishedAt: string;
}

const CPC_LEVELS: CpcLevel[] = [
  "section",
  "division",
  "group",
  "class",
  "subclass",
];

/** True for a 1–5 digit numeric CPC code. */
export function isValidCpcCode(code: string): boolean {
  return /^\d{1,5}$/.test(code);
}

/** Hierarchy level for a CPC code, by length. */
export function cpcLevel(code: string): CpcLevel {
  if (!isValidCpcCode(code)) {
    throw new Error(`invalid CPC code: ${code}`);
  }
  return CPC_LEVELS[code.length - 1];
}

/** Parent code (one digit shorter), or null for a section (length 1). */
export function parentOf(code: string): string | null {
  if (!isValidCpcCode(code)) {
    throw new Error(`invalid CPC code: ${code}`);
  }
  return code.length <= 1 ? null : code.slice(0, code.length - 1);
}

/** All ancestor codes, section-first (excludes the code itself). */
export function ancestorsOf(code: string): string[] {
  if (!isValidCpcCode(code)) {
    throw new Error(`invalid CPC code: ${code}`);
  }
  const out: string[] = [];
  for (let len = 1; len < code.length; len++) {
    out.push(code.slice(0, len));
  }
  return out;
}

/** Decompose a code into its named hierarchy prefixes (those that exist). */
export function hierarchyOf(code: string): {
  level: CpcLevel;
  section: string;
  division?: string;
  group?: string;
  class?: string;
  parent: string | null;
} {
  if (!isValidCpcCode(code)) {
    throw new Error(`invalid CPC code: ${code}`);
  }
  const L = code.length;
  return {
    level: cpcLevel(code),
    section: code.slice(0, 1),
    division: L >= 2 ? code.slice(0, 2) : undefined,
    group: L >= 3 ? code.slice(0, 3) : undefined,
    class: L >= 4 ? code.slice(0, 4) : undefined,
    parent: parentOf(code),
  };
}

export function productDid(code: string): string {
  return `${CPC_DID_PREFIX}product:${code}`;
}

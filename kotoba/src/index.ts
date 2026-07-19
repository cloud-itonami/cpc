/**
 * cpc kotoba — barrel + programmatic read API.
 *
 * Per ADR-2605203000 Option B Phase E reference impl. UN CPC Ver.2.1 product
 * taxonomy on the etzhayyim substrate (AT PDS records; no RW). Mirrors the
 * open-isic kotoba read pattern.
 *
 *   import { queryByPrefix, getByCode, getChildren } from "@etzhayyim/cpc-kotoba";
 */

export type { CpcProduct, CpcLevel } from "./types.js";
export {
  cpcLevel,
  parentOf,
  ancestorsOf,
  hierarchyOf,
  isValidCpcCode,
  productDid,
} from "./types.js";

import { Etzhayyim } from "@etzhayyim/sdk";
import { isValidCpcCode, type CpcProduct } from "./types.js";

const COLLECTION = "com.etzhayyim.apps.cpc.product";

function defaultClient(): Etzhayyim {
  return new Etzhayyim({
    did: "did:web:etzhayyim.com",
    pdsUrl: "https://pds.etzhayyim.com",
    ipfsGateway: "https://ipfs.etzhayyim.com",
    l2RpcUrl: "https://mainnet.base.org",
  });
}

/** Read CPC products whose code starts with `prefix` (rkey prefix scan). */
export async function queryByPrefix(
  prefix: string,
  opts: { limit?: number; client?: Etzhayyim } = {}
): Promise<CpcProduct[]> {
  const e = opts.client ?? defaultClient();
  const { records } = await e.read<CpcProduct>({
    collection: COLLECTION,
    prefix,
    limit: opts.limit ?? 50,
    fetchBlobs: false,
  });
  return records.map((r) => r.value);
}

/** Read a single CPC product by exact code (rkey = code). */
export async function getByCode(
  code: string,
  opts: { client?: Etzhayyim } = {}
): Promise<CpcProduct | null> {
  if (!isValidCpcCode(code)) return null;
  const e = opts.client ?? defaultClient();
  const { records } = await e.read<CpcProduct>({
    collection: COLLECTION,
    rkey: code,
    fetchBlobs: false,
  });
  return records[0]?.value ?? null;
}

/**
 * Direct children of `code` (codes one digit longer with `code` as prefix).
 * A subclass (5-digit) has no children → returns []. Filters the prefix scan
 * to exact child length client-side.
 */
export async function getChildren(
  code: string,
  opts: { limit?: number; client?: Etzhayyim } = {}
): Promise<CpcProduct[]> {
  if (!isValidCpcCode(code) || code.length >= 5) return [];
  const childLen = code.length + 1;
  const rows = await queryByPrefix(code, { limit: opts.limit ?? 100, client: opts.client });
  return rows.filter((p) => p.code.length === childLen && p.code.startsWith(code));
}

/**
 * Seeder: CPC product JSONs → AT Records via @etzhayyim/sdk.
 *
 * Replaces the RW seed path (was `vertex_cpc_catalog`) with a straight-line
 * PDS write loop. Idempotent: rkey = code, so re-running is a no-op past the
 * first run. Reads product JSONs from a directory (default ../data/products,
 * overridable with --dir= or ETZ_CPC_DATA_DIR) — each file is one CpcProduct
 * (or a SourceProduct with at least { code, titleEn }; level/section/parent are
 * derived).
 *
 * Usage:
 *   pnpm tsx src/seed.ts                 # all products under the data dir
 *   pnpm tsx src/seed.ts --only=0111     # one code
 *   pnpm tsx src/seed.ts --dir=/path     # custom data dir
 */

import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Etzhayyim } from "@etzhayyim/sdk";
import { cpcLevel, isValidCpcCode, parentOf, type CpcProduct } from "./types.js";

const COLLECTION = "com.etzhayyim.apps.cpc.product";
const CPC_PUBLISHED_AT_DEFAULT = "2015-01-01T00:00:00Z"; // CPC Ver.2.1

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATA_DIR =
  process.env.ETZ_CPC_DATA_DIR ?? join(__dirname, "..", "..", "data", "products");

const e = new Etzhayyim({
  did: process.env.ETZ_SEEDER_DID ?? "did:web:etzhayyim.com",
  pdsUrl: process.env.ETZ_PDS_URL ?? "https://pds.etzhayyim.com",
  ipfsApiUrl: process.env.ETZ_IPFS_API_URL,
  l2RpcUrl: process.env.ETZ_L2_RPC_URL ?? "https://mainnet.base.org",
});

interface SourceProduct {
  code: string;
  titleEn: string;
  description?: string;
  isicRefs?: string[];
  source?: string;
  publishedAt?: string;
}

interface Args {
  dir?: string;
  only?: string;
}

function parseArgs(argv: string[]): Args {
  const out: Args = {};
  for (const a of argv) {
    const m = a.match(/^--(\w+)(?:=(.*))?$/);
    if (m) (out as Record<string, string | undefined>)[m[1]] = m[2];
  }
  return out;
}

/** Derive the full CpcProduct (level/section/parent) from a source row. */
export function toCpcProduct(src: SourceProduct): CpcProduct {
  if (!isValidCpcCode(src.code)) {
    throw new Error(`invalid CPC code: ${src.code}`);
  }
  return {
    code: src.code,
    titleEn: src.titleEn,
    level: cpcLevel(src.code),
    section: src.code.slice(0, 1),
    parent: parentOf(src.code),
    description: src.description,
    isicRefs: src.isicRefs,
    source: src.source,
    publishedAt: src.publishedAt ?? CPC_PUBLISHED_AT_DEFAULT,
  };
}

async function loadProducts(dir: string): Promise<SourceProduct[]> {
  const entries = await readdir(dir);
  const out: SourceProduct[] = [];
  for (const entry of entries) {
    if (!entry.endsWith(".json")) continue;
    out.push(JSON.parse(await readFile(join(dir, entry), "utf8")) as SourceProduct);
  }
  out.sort((a, b) => a.code.localeCompare(b.code));
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const dir = args.dir ?? DEFAULT_DATA_DIR;
  const products = (await loadProducts(dir)).filter((p) =>
    args.only ? p.code === args.only : true
  );
  console.log(`[seed] writing ${products.length} CPC products from ${dir}`);

  let ok = 0;
  let err = 0;
  for (const src of products) {
    try {
      const record = toCpcProduct(src);
      await e.write({
        collection: COLLECTION,
        record: record as unknown as Record<string, unknown>,
        rkey: record.code,
      });
      ok += 1;
      if (ok % 100 === 0) console.log(`[seed] ${ok}/${products.length} …`);
    } catch (e2) {
      err += 1;
      console.error(`[seed] FAILED code=${src.code}: ${(e2 as Error).message}`);
    }
  }
  console.log(`[seed] DONE ok=${ok} err=${err}`);
}

const isMain =
  import.meta.url.startsWith("file:") &&
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"));
if (isMain) {
  main().catch((err) => {
    console.error("[seed] fatal:", err);
    process.exit(2);
  });
}

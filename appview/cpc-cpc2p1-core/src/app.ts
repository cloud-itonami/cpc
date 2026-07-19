import {
  asAgentTool,
  createWorkerExport,
  withCapabilityTags,
  type AppDef,
  type HostSDK,
  createCadenceState,
  createInboxBuffer,
  resolveHeartbeatCadence,
  nowISO,
  nsid,
  createKyselyDb,
} from "@etzhayyim/kotodama-host-sdk";

type SectionInfo = {
  code: number;
  name: string;
  divisionFrom: number;
  divisionTo: number;
};

type DivisionInfo = {
  section: number;
  code: number;
  name: string;
};

type ProductInfo = {
  code: string;
  name: string;
  section: number;
  division: number;
  group: string;
  classCode: string;
  subclass: string;
};

type ConcordanceInfo = {
  cpc_code: string;
  isic4: string[];
  hs2017: string[];
  sitc4?: string[];
};

type ProcessInfo = {
  process: string;
  tsukuru_path: string;
  confidence: number;
};

const APP_DEF: AppDef = {
  id: "cpc-cpc2p1-core",
  name: "cpc",
  description: "UN CPC Ver.2.1 core catalog, concordance and process linker",
};

const SECTION_INFO: SectionInfo[] = [
  { code: 0, name: "Agriculture, forestry and fishery products", divisionFrom: 1, divisionTo: 4 },
  { code: 1, name: "Ores, minerals, electricity, gas and water", divisionFrom: 11, divisionTo: 18 },
  { code: 2, name: "Food products, beverages, textiles and apparel", divisionFrom: 21, divisionTo: 29 },
  { code: 3, name: "Other transportable goods", divisionFrom: 31, divisionTo: 39 },
  { code: 4, name: "Metal products, machinery and equipment", divisionFrom: 41, divisionTo: 49 },
  { code: 5, name: "Constructions and construction services", divisionFrom: 51, divisionTo: 54 },
  { code: 6, name: "Trade and transport services", divisionFrom: 61, divisionTo: 69 },
  { code: 7, name: "Financial and real estate services", divisionFrom: 71, divisionTo: 73 },
  { code: 8, name: "Business and production services", divisionFrom: 81, divisionTo: 89 },
  { code: 9, name: "Community, social and personal services", divisionFrom: 91, divisionTo: 99 },
];

const DIVISION_NAME_OVERRIDES: Record<number, string> = {
  1: "Products of agriculture, horticulture and market gardening",
  2: "Live animals and animal products",
  3: "Forestry and logging products",
  4: "Fish and other fishing products",
  11: "Coal and lignite; peat",
  12: "Crude petroleum and natural gas",
  17: "Electricity, gas and steam",
  18: "Water collection and distribution",
  21: "Meat, fish, fruit, vegetables, oils and fats",
  24: "Tobacco products",
  31: "Wood and products of wood and cork",
  32: "Pulp, paper and paper products",
  34: "Chemicals and chemical products",
  41: "Basic metals",
  42: "Fabricated metal products",
  45: "Office, accounting and computing machinery",
  47: "Radio, television and communication equipment",
  49: "Transport equipment",
  51: "Construction work for buildings",
  54: "General construction services",
  61: "Sale, maintenance and repair services",
  62: "Retail trade services",
  63: "Accommodation, food and beverage services",
  64: "Land transport services",
  67: "Supporting and auxiliary transport services",
  71: "Financial and related services",
  72: "Real estate services",
  73: "Leasing and rental services",
  81: "Research and development services",
  83: "Telecommunications, broadcasting and information supply",
  84: "Financial and related services",
  85: "Support services",
  91: "Public administration and other services",
  92: "Education services",
  93: "Human health and social care services",
  96: "Recreational, cultural and sporting services",
  99: "Other services",
};

function buildDivisions(): DivisionInfo[] {
  const out: DivisionInfo[] = [];
  for (const s of SECTION_INFO) {
    for (let code = s.divisionFrom; code <= s.divisionTo; code += 1) {
      out.push({
        section: s.code,
        code,
        name: DIVISION_NAME_OVERRIDES[code] ?? `Division ${code}`,
      });
    }
  }
  return out;
}

const DIVISIONS = buildDivisions();

const PRODUCTS: ProductInfo[] = [
  { code: "01110", name: "Wheat", section: 0, division: 1, group: "011", classCode: "0111", subclass: "01110" },
  { code: "01120", name: "Maize", section: 0, division: 1, group: "011", classCode: "0112", subclass: "01120" },
  { code: "02111", name: "Live cattle", section: 0, division: 2, group: "021", classCode: "0211", subclass: "02111" },
  { code: "04111", name: "Fish, live", section: 0, division: 4, group: "041", classCode: "0411", subclass: "04111" },
  { code: "11010", name: "Coal", section: 1, division: 11, group: "110", classCode: "1101", subclass: "11010" },
  { code: "12011", name: "Crude petroleum", section: 1, division: 12, group: "120", classCode: "1201", subclass: "12011" },
  { code: "17100", name: "Electric power", section: 1, division: 17, group: "171", classCode: "1710", subclass: "17100" },
  { code: "21111", name: "Meat of mammals", section: 2, division: 21, group: "211", classCode: "2111", subclass: "21111" },
  { code: "24310", name: "Cigarettes", section: 2, division: 24, group: "243", classCode: "2431", subclass: "24310" },
  { code: "32111", name: "Newsprint", section: 3, division: 32, group: "321", classCode: "3211", subclass: "32111" },
  { code: "34111", name: "Industrial gases", section: 3, division: 34, group: "341", classCode: "3411", subclass: "34111" },
  { code: "41111", name: "Basic iron and steel", section: 4, division: 41, group: "411", classCode: "4111", subclass: "41111" },
  { code: "42120", name: "Metal structures", section: 4, division: 42, group: "421", classCode: "4212", subclass: "42120" },
  { code: "45220", name: "Computers and peripheral equipment", section: 4, division: 45, group: "452", classCode: "4522", subclass: "45220" },
  { code: "47210", name: "Telephone sets and mobile communication equipment", section: 4, division: 47, group: "472", classCode: "4721", subclass: "47210" },
  { code: "49113", name: "Passenger motor cars", section: 4, division: 49, group: "491", classCode: "4911", subclass: "49113" },
  { code: "51111", name: "Residential building construction", section: 5, division: 51, group: "511", classCode: "5111", subclass: "51111" },
  { code: "54111", name: "General construction services of residential buildings", section: 5, division: 54, group: "541", classCode: "5411", subclass: "54111" },
  { code: "71131", name: "Commercial banking services", section: 7, division: 71, group: "711", classCode: "7113", subclass: "71131" },
  { code: "83111", name: "Internet backbone and access services", section: 8, division: 83, group: "831", classCode: "8311", subclass: "83111" },
  { code: "84310", name: "Legal documentation and certification services", section: 8, division: 84, group: "843", classCode: "8431", subclass: "84310" },
  { code: "96121", name: "Streaming media services", section: 9, division: 96, group: "961", classCode: "9612", subclass: "96121" },
];

const CONCORDANCE: Record<string, ConcordanceInfo> = {
  "01110": { cpc_code: "01110", isic4: ["0111"], hs2017: ["1001"], sitc4: ["041"] },
  "12011": { cpc_code: "12011", isic4: ["0610"], hs2017: ["2709"], sitc4: ["333"] },
  "17100": { cpc_code: "17100", isic4: ["3510"], hs2017: ["2716"], sitc4: ["351"] },
  "45220": { cpc_code: "45220", isic4: ["2620"], hs2017: ["8471"], sitc4: ["752"] },
  "47210": { cpc_code: "47210", isic4: ["2630"], hs2017: ["8517"], sitc4: ["764"] },
  "49113": { cpc_code: "49113", isic4: ["2910"], hs2017: ["8703"], sitc4: ["781"] },
  "54111": { cpc_code: "54111", isic4: ["4100"], hs2017: [], sitc4: [] },
  "83111": { cpc_code: "83111", isic4: ["6110"], hs2017: [], sitc4: [] },
  "96121": { cpc_code: "96121", isic4: ["6020"], hs2017: [], sitc4: [] },
};

const MANUFACTURING_PROCESS_BY_DIVISION: Record<number, ProcessInfo> = {
  45: {
    process: "computer-manufacturing",
    tsukuru_path: "etzhayyim:tsukuru-process-registry/process-registry@1.0.0",
    confidence: 0.95,
  },
  47: {
    process: "smartphone-manufacturing",
    tsukuru_path: "etzhayyim:tsukuru-process-registry/process-registry@1.0.0",
    confidence: 0.94,
  },
  49: {
    process: "automobile-manufacturing",
    tsukuru_path: "etzhayyim:tsukuru-process-registry/process-registry@1.0.0",
    confidence: 0.96,
  },
  54: {
    process: "building-construction",
    tsukuru_path: "etzhayyim:tsukuru-process-registry/process-registry@1.0.0",
    confidence: 0.93,
  },
};

const cadenceState = createCadenceState();
const inbox = createInboxBuffer();

let appId = "";

function parseBody<T>(body: unknown): T {
  if (!body) return {} as T;
  if (typeof body === "string") return JSON.parse(body) as T;
  if (body instanceof Uint8Array) return JSON.parse(new TextDecoder().decode(body)) as T;
  return body as T;
}

function out(payload: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(payload));
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function int(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : fallback;
}

function byCode(code: string): ProductInfo | undefined {
  return PRODUCTS.find((p) => p.code === code);
}

function filterProducts(args: {
  query?: string;
  code_prefix?: string;
  section?: number;
  division?: number;
  limit?: number;
}): ProductInfo[] {
  const q = str(args.query).toLowerCase();
  const prefix = str(args.code_prefix);
  const section = typeof args.section === "number" ? args.section : undefined;
  const division = typeof args.division === "number" ? args.division : undefined;
  const limit = Math.max(1, Math.min(int(args.limit, 30), 100));

  return PRODUCTS
    .filter((p) => {
      if (prefix && !p.code.startsWith(prefix)) return false;
      if (q && !(`${p.code} ${p.name}`.toLowerCase().includes(q))) return false;
      if (typeof section === "number" && p.section !== section) return false;
      if (typeof division === "number" && p.division !== division) return false;
      return true;
    })
    .slice(0, limit);
}

function cmdListSections(body: Uint8Array): Uint8Array {
  const args = parseBody<{ include_divisions?: boolean }>(body);
  const includeDivisions = Boolean(args.include_divisions);

  const sections = SECTION_INFO.map((s) => {
    const divisions = DIVISIONS.filter((d) => d.section === s.code);
    return {
      code: s.code,
      name: s.name,
      divisionFrom: s.divisionFrom,
      divisionTo: s.divisionTo,
      divisionCount: divisions.length,
      divisions: includeDivisions ? divisions : undefined,
    };
  });

  return out({
    app: APP_DEF.name,
    framework: "cpc",
    version: "2.1",
    totalSections: sections.length,
    sections,
  });
}

function cmdListDivisions(body: Uint8Array): Uint8Array {
  const args = parseBody<{ section?: number; limit?: number }>(body);
  const section = typeof args.section === "number" ? args.section : undefined;
  const limit = Math.max(1, Math.min(int(args.limit, 100), 200));

  const items = DIVISIONS
    .filter((d) => (typeof section === "number" ? d.section === section : true))
    .slice(0, limit);

  return out({ total: items.length, items, section });
}

function cmdGetProduct(body: Uint8Array): Uint8Array {
  const args = parseBody<{ cpc_code?: string }>(body);
  const cpcCode = str(args.cpc_code);
  if (!cpcCode) return out({ error: "missingCpcCode" });

  const product = byCode(cpcCode);
  if (!product) return out({ error: "notFound", cpc_code: cpcCode });

  return out(product);
}

function cmdSearchProducts(body: Uint8Array): Uint8Array {
  const args = parseBody<{
    query?: string;
    code_prefix?: string;
    section?: number;
    division?: number;
    limit?: number;
  }>(body);

  const items = filterProducts(args);
  return out({ items, total: items.length });
}

function cmdGetConcordance(body: Uint8Array): Uint8Array {
  const args = parseBody<{ cpc_code?: string }>(body);
  const cpcCode = str(args.cpc_code);
  if (!cpcCode) return out({ error: "missingCpcCode" });

  const row = CONCORDANCE[cpcCode];
  if (!row) return out({ error: "concordanceNotFound", cpc_code: cpcCode });

  return out(row);
}

function cmdResolveManufacturingProcess(body: Uint8Array): Uint8Array {
  const args = parseBody<{ cpc_code?: string }>(body);
  const cpcCode = str(args.cpc_code);
  if (!cpcCode) return out({ error: "missingCpcCode" });

  const product = byCode(cpcCode);
  if (!product) return out({ error: "notFound", cpc_code: cpcCode });

  const process = MANUFACTURING_PROCESS_BY_DIVISION[product.division];
  if (!process) {
    return out({
      cpc_code: cpcCode,
      division: product.division,
      resolution: "unmapped",
      note: "No explicit Tsukuru process mapping for this division",
    });
  }

  return out({
    cpc_code: cpcCode,
    division: product.division,
    process,
  });
}

async function cmdRegisterToPds(_sdk: HostSDK, body: Uint8Array): Promise<Uint8Array> {
  const args = parseBody<{ section?: number; division?: number; dry_run?: boolean }>(body);
  const section = typeof args.section === "number" ? args.section : undefined;
  const division = typeof args.division === "number" ? args.division : undefined;
  const dryRun = Boolean(args.dry_run);

  const targets = PRODUCTS.filter((p) => {
    if (typeof section === "number" && p.section !== section) return false;
    if (typeof division === "number" && p.division !== division) return false;
    return true;
  });

  if (!dryRun) {
    const db = createKyselyDb();
    const now = nowISO();
    for (const p of targets) {
      const did = `did:web:cpc.etzhayyim.com`;
      const rkey = p.code;
      await (db.insertInto("vertex_cpc_product" as any).values({
        vertex_id: `at://${did}/com.etzhayyim.apps.cpc.product/${rkey}`,
        sensitivity_ord: 2,
        owner_did: did,
        actor_did: did,
        org_did: "anon",
        created_at: now,
        cpc_code: p.code,
        name: p.name,
        section: String(p.section),
        division: String(p.division),
        group_code: p.group,
        class_code: p.classCode,
        subclass_code: p.subclass,
        actor_id: appId,
      }) as any).execute();
    }
  }

  return out({
    dryRun,
    selected: {
      section: typeof section === "number" ? section : null,
      division: typeof division === "number" ? division : null,
    },
    count: targets.length,
    codes: targets.map((p) => p.code),
  });
}

function cmdStats(): Uint8Array {
  const sectionCoverage = {
    total: 10,
    implemented: new Set(PRODUCTS.map((p) => p.section)).size,
  };
  const divisionCoverage = {
    total: 73,
    implemented: new Set(PRODUCTS.map((p) => p.division)).size,
  };

  return out({
    app: APP_DEF.name,
    component: APP_DEF.id,
    cpcVersion: "2.1",
    productSamples: PRODUCTS.length,
    concordanceRows: Object.keys(CONCORDANCE).length,
    processMappings: Object.keys(MANUFACTURING_PROCESS_BY_DIVISION).length,
    coverage: {
      sections: {
        ...sectionCoverage,
        percentage: Math.round((sectionCoverage.implemented / sectionCoverage.total) * 10000) / 100,
      },
      divisions: {
        ...divisionCoverage,
        percentage: Math.round((divisionCoverage.implemented / divisionCoverage.total) * 10000) / 100,
      },
    },
  });
}

function cmdWave(sdk: HostSDK, body: Uint8Array): Uint8Array {
  const args = parseBody<{ text?: string }>(body);
  const text = str(args.text) || `CPC coverage heartbeat ${nowISO()}`;
  sdk.pds.dispatch({
    type: "app.bsky.feed.post",
    payload: { text },
  });
  return out({ ok: true, text });
}

export async function runHeartbeat(): Promise<{ ok: boolean; actions: Array<Record<string, unknown>> }> {
  const actions: Array<Record<string, unknown>> = [];
  const cadence = await resolveHeartbeatCadence("did:web:cpc.etzhayyim.com", cadenceState, inbox);
  actions.push({ action: "cadenceResolved", mood: cadence.mood, reason: cadence.reason, ts: nowISO() });
  actions.push({ action: "statsSnapshot", payload: JSON.parse(new TextDecoder().decode(cmdStats())) });
  return { ok: true, actions };
}

export default createWorkerExport((sdk) => {
  appId = sdk.pds.selfNanoid ?? APP_DEF.id;

  sdk.app
    .command(
      nsid("com.etzhayyim.apps.cpc.catalog.listSections"),
      (_ctx, body) => cmdListSections(body),
      asAgentTool("List CPC sections"),
      withCapabilityTags("cpc", "catalog"),
    )
    .command(
      nsid("com.etzhayyim.apps.cpc.catalog.listDivisions"),
      (_ctx, body) => cmdListDivisions(body),
      asAgentTool("List CPC divisions"),
      withCapabilityTags("cpc", "catalog"),
    )
    .command(
      nsid("com.etzhayyim.apps.cpc.catalog.getProduct"),
      (_ctx, body) => cmdGetProduct(body),
      asAgentTool("Get CPC product by code"),
      withCapabilityTags("cpc", "catalog"),
    )
    .command(
      nsid("com.etzhayyim.apps.cpc.catalog.searchProducts"),
      (_ctx, body) => cmdSearchProducts(body),
      asAgentTool("Search CPC products"),
      withCapabilityTags("cpc", "catalog", "query"),
    )
    .command(
      nsid("com.etzhayyim.apps.cpc.concordance.get"),
      (_ctx, body) => cmdGetConcordance(body),
      asAgentTool("Get CPC concordance to ISIC/HS"),
      withCapabilityTags("cpc", "concordance"),
    )
    .command(
      nsid("com.etzhayyim.apps.cpc.process.resolveManufacturingProcess"),
      (_ctx, body) => cmdResolveManufacturingProcess(body),
      asAgentTool("Resolve manufacturing process for CPC code"),
      withCapabilityTags("cpc", "manufacturing", "process"),
    )
    .command(
      nsid("com.etzhayyim.apps.cpc.registry.registerToPds"),
      (_ctx, body) => cmdRegisterToPds(sdk, body),
      asAgentTool("Register CPC products to graph"),
      withCapabilityTags("cpc", "registry"),
    )
    .command(
      nsid("com.etzhayyim.apps.cpc.stats"),
      () => cmdStats(),
      asAgentTool("Get CPC component coverage stats"),
      withCapabilityTags("cpc", "analytics"),
    )
    .command(
      nsid("com.etzhayyim.apps.cpc.wave"),
      (_ctx, body) => cmdWave(sdk, body),
      asAgentTool("Post CPC social wave"),
      withCapabilityTags("cpc", "social"),
    );
});

import { beforeEach, describe, expect, it, vi } from "vitest";

type DispatchCall = { type: string; payload: Record<string, unknown> };

let dispatchCalls: DispatchCall[] = [];

function resetState() {
  dispatchCalls = [];
}

function createSdk() {
  return {
    pds: {
      selfNanoid: "cpc2p1core",
      dispatch(call: DispatchCall) {
        dispatchCalls.push(call);
      },
    },
    hostImports: {},
    app: {
      command: vi.fn().mockReturnThis(),
    },
  };
}

let setupCallback: ((sdk: ReturnType<typeof createSdk>) => void) | null = null;

vi.mock("@etzhayyim/kotodama-host-sdk", () => ({
  createWorkerExport: (cb: (sdk: ReturnType<typeof createSdk>) => void) => {
    setupCallback = cb;
    return { fetch: vi.fn() };
  },
  asAgentTool: (desc: string) => ({ type: "agentTool", desc }),
  withCapabilityTags: (...tags: string[]) => ({ type: "capTags", tags }),
  createCadenceState: () => ({}),
  createInboxBuffer: () => ({}),
  resolveHeartbeatCadence: vi.fn().mockResolvedValue({ mood: "calm", reason: "idle" }),
  nowISO: () => "2026-04-15T00:00:00.000Z",
  nsid: (value: string) => value,
}));

let appModule: typeof import("./app");

beforeEach(async () => {
  vi.resetModules();
  setupCallback = null;
  resetState();
  appModule = await import("./app");
});

function enc(v: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(v));
}

function dec(v: Uint8Array): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(v));
}

function getHandler(nsid: string): ((ctx: unknown, body: Uint8Array) => Uint8Array) {
  const sdk = createSdk();
  setupCallback!(sdk);
  const call = sdk.app.command.mock.calls.find((c: unknown[]) => c[0] === nsid);
  if (!call) throw new Error(`handler not found: ${nsid}`);
  return call[1] as ((ctx: unknown, body: Uint8Array) => Uint8Array);
}

describe("cpc command registration", () => {
  it("registers expected commands", () => {
    const sdk = createSdk();
    setupCallback!(sdk);

    const nsids = sdk.app.command.mock.calls.map((c: unknown[]) => c[0]);
    expect(nsids).toContain("com.etzhayyim.apps.cpc.catalog.listSections");
    expect(nsids).toContain("com.etzhayyim.apps.cpc.catalog.listDivisions");
    expect(nsids).toContain("com.etzhayyim.apps.cpc.catalog.getProduct");
    expect(nsids).toContain("com.etzhayyim.apps.cpc.catalog.searchProducts");
    expect(nsids).toContain("com.etzhayyim.apps.cpc.concordance.get");
    expect(nsids).toContain("com.etzhayyim.apps.cpc.process.resolveManufacturingProcess");
    expect(nsids).toContain("com.etzhayyim.apps.cpc.registry.registerToPds");
    expect(nsids).toContain("com.etzhayyim.apps.cpc.stats");
    expect(nsids).toContain("com.etzhayyim.apps.cpc.wave");
    expect(nsids).toHaveLength(9);
  });
});

describe("cpc handlers", () => {
  it("listSections returns 10 sections", () => {
    const handler = getHandler("com.etzhayyim.apps.cpc.catalog.listSections");
    const result = dec(handler(null, enc({})));
    expect(result.totalSections).toBe(10);
  });

  it("listDivisions can filter by section", () => {
    const handler = getHandler("com.etzhayyim.apps.cpc.catalog.listDivisions");
    const result = dec(handler(null, enc({ section: 4 })));
    const items = result.items as Array<{ section: number; code: number }>;
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.section === 4)).toBe(true);
  });

  it("getProduct returns known CPC product", () => {
    const handler = getHandler("com.etzhayyim.apps.cpc.catalog.getProduct");
    const result = dec(handler(null, enc({ cpc_code: "45220" })));
    expect(result.code).toBe("45220");
    expect(result.division).toBe(45);
  });

  it("searchProducts supports code prefix", () => {
    const handler = getHandler("com.etzhayyim.apps.cpc.catalog.searchProducts");
    const result = dec(handler(null, enc({ code_prefix: "49" })));
    const items = result.items as Array<{ code: string }>;
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.code.startsWith("49"))).toBe(true);
  });

  it("getConcordance returns CPC-ISIC-HS mapping", () => {
    const handler = getHandler("com.etzhayyim.apps.cpc.concordance.get");
    const result = dec(handler(null, enc({ cpc_code: "49113" })));
    expect(result.cpc_code).toBe("49113");
    expect(result.isic4).toBeTruthy();
    expect(result.hs2017).toBeTruthy();
  });

  it("resolveManufacturingProcess resolves mapped divisions", () => {
    const handler = getHandler("com.etzhayyim.apps.cpc.process.resolveManufacturingProcess");
    const result = dec(handler(null, enc({ cpc_code: "54111" })));
    expect(result.division).toBe(54);
    expect((result.process as { process: string }).process).toBe("building-construction");
  });

  it("registerToPds writes records unless dry_run", () => {
    const handler = getHandler("com.etzhayyim.apps.cpc.registry.registerToPds");

    const dry = dec(handler(null, enc({ division: 45, dry_run: true })));
    expect(dry.count).toBe(1);
    expect(dispatchCalls.length).toBe(0);

    const real = dec(handler(null, enc({ division: 45 })));
    expect(real.count).toBe(1);
    expect(dispatchCalls.length).toBe(1);
    expect(dispatchCalls[0].type).toBe("com.atproto.repo.createRecord");
    expect(dispatchCalls[0].payload.collection).toBe("com.etzhayyim.apps.cpc.product");
  });

  it("stats returns coverage snapshot", () => {
    const handler = getHandler("com.etzhayyim.apps.cpc.stats");
    const result = dec(handler(null, enc({})));
    expect(result.cpcVersion).toBe("2.1");
    expect(result.coverage).toBeTruthy();
  });
});

describe("heartbeat", () => {
  it("runHeartbeat returns actions", async () => {
    const result = await appModule.runHeartbeat();
    expect(result.ok).toBe(true);
    expect(result.actions.length).toBeGreaterThan(0);
  });
});

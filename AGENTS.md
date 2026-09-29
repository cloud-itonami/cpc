# etzhayyim-project-cpc — Central Product Classification Platform

Contract-Bounded Component Architecture (DM2 Agreement + WIT Component Model) で UN CPC Ver.2.1 製品・サービス分類をモデル化。

## CRITICAL: Script-Based Bulk Generation 禁止

→ `etzhayyim dodaf tv1 query --id etzhayyim-project-cpc-script-based-bulk-generation-禁止` / MCP `etzhayyim.dodaf.tv1.query`

## Architecture: Contract → APP → Entity DO

```
規制根拠 (Contract/Agreement)
  → WIT interface (capability export)
    → APP DO (App, 1 Worker)
      → Entity (W Protocol Event Stream multi-tenant)
```

| 判定 | APP か Entity DO か |
|---|---|
| 異なる製品安全基準/規制体系 | **別 APP** (個別 WIT) |
| 同一規制の下の同格製品カテゴリ | **Entity DO** (同一 WIT, 同一 APP 内) |
| サプライチェーン依存 (原材料→製品) | **別 APP** + WIT deps import |
| 同一規制の地域分散 | **Entity DO** |

## CPC-ISIC Concordance

CPC 製品は ISIC 産業の産出物。`etzhayyim:isic-resource-flow/products@1.0.0` の `product-code` フィールドが CPC コードを使用。

| CPC Section | ISIC Section (primary) | 関係 |
|---|---|---|
| 0 (Agriculture products) | A (Agriculture) | 産出物 |
| 1 (Ores, minerals, utilities) | B (Mining), D (Electricity) | 産出物 |
| 2 (Food, textiles) | C (Manufacturing 10-18) | 加工品 |
| 3 (Other transportable goods) | C (Manufacturing 19-25,31-33) | 加工品 |
| 4 (Metal, machinery, equipment) | C (Manufacturing 24-30) | 加工品 |
| 5 (Construction) | F (Construction) | サービス |
| 6 (Trade, transport, utilities distribution) | G,H,I (Trade, Transport, Hospitality) | サービス |
| 7 (Financial, real estate) | K,L (Financial, Real estate) | サービス |
| 8 (Business, production services) | M,N,J (Professional, Admin, ICT) | サービス |
| 9 (Community, social, personal services) | O-U (Public admin, Education, Health, etc.) | サービス |

## CPC Section → APP Mapping

| Section | Name | Divisions | APP pattern | Key regulation domain |
|---|---|---|---|---|
| **0** | Agriculture, forestry, fishery products | 01-04 | 1 APP per Division | Agricultural product standards, phytosanitary |
| **1** | Ores, minerals; electricity, gas, water | 11-18 | 1 APP per Division | Mining safety, energy regulation |
| **2** | Food, beverages, tobacco; textiles, apparel, leather | 21-29 | 1 APP per Division | Food safety (Codex), textile standards |
| **3** | Other transportable goods | 31-39 | 1 APP per Division | Product safety, chemical regulations |
| **4** | Metal products, machinery, equipment | 41-49 | 1 APP per Division | Industrial standards, export controls |
| **5** | Constructions, construction services | 51-54 | 1 APP per Division | Building codes, construction standards |
| **6** | Trade, transport, utilities distribution services | 61-69 | 1 APP per Division | Trade regulation, transport safety |
| **7** | Financial, real estate, rental services | 71-73 | 1 APP per Division | Financial regulation, real estate law |
| **8** | Business, production services | 81-89 | 1 APP per Division | Professional licensing, IT standards |
| **9** | Community, social, personal services | 91-99 | 1 APP per Division | Public service standards, health regulation |

### Entity DO Pattern

同一 Division 内の Group/Class は Entity DO として管理:

```
Section 0 - Agriculture products
├── Division 01: Products of agriculture (1 APP)
│   ├── Group 011: Cereals → Entity DO
│   │   ├── Class 0111: Wheat, meslin → Entity DO
│   │   ├── Class 0112: Maize → Entity DO
│   │   └── Class 0113-0119: Other cereals → Entity DOs
│   ├── Group 012: Vegetables → Entity DO
│   └── Group 013-019: Other products → Entity DOs
├── Division 02: Live animals (1 APP)
├── Division 03: Forestry products (1 APP)
└── Division 04: Fish products (1 APP)
```

## Resource Flow Integration

### CPC ↔ ISIC Resource Flow

`etzhayyim:isic-resource-flow@1.0.0` の `material-flow` と `product-flow` で CPC コードを使用:
- `material-flow.product-code`: CPC code (原材料として)
- `product-flow.product-code`: CPC code (完成品として)

### CPC Product Classification WIT

`etzhayyim:cpc-product-classification@1.0.0` (`wit/cpc-product-classification/`) で CPC 固有の製品分類・品質基準・貿易フローを定義。

## Lexicon Namespace: `com.etzhayyim.apps.cpc.*`

**全 CPC data record は `com.etzhayyim.apps.cpc.*` Lexicon namespace を使用する。** 既存の `com.etzhayyim.cpc.product` は `com.etzhayyim.apps.cpc.product` に正規化。旧 `cpc.{kind}` placeholder は禁止。

| Lexicon NSID | WRecord kind | Rkey | Entity ID | 用途 |
|---|---|---|---|---|
| `com.etzhayyim.apps.cpc.product` | `cpc.product` | CPC code (5桁) | product_code | 製品分類マスタ |
| `com.etzhayyim.apps.cpc.tradeFlow` | `cpc.tradeFlow` | nanoid | product_code | 国際貿易フロー記録 |
| `com.etzhayyim.apps.cpc.qualityStandard` | `cpc.qualityStandard` | standard_id | product_codes[] | 品質規格バインド |
| `com.etzhayyim.apps.cpc.concordance` | `cpc.concordance` | cpc_code | cpc_code | CPC-ISIC concordance |
| `com.etzhayyim.apps.cpc.hsConcordance` | `cpc.hsConcordance` | cpc_code | cpc_code | CPC-HS concordance |
| `com.etzhayyim.apps.cpc.productRisk` | `cpc.productRisk` | nanoid | product_code | 製品リスク評価 |
| `com.etzhayyim.apps.cpc.vendorRisk` | `cpc.vendorRisk` | nanoid | product_code | サプライヤーリスク評価 |
| `com.etzhayyim.apps.cpc.productFlow` | `cpc.productFlow` | nanoid | product_code | 製品フロー (entity 間) |
| `com.etzhayyim.apps.cpc.dataClassification` | `cpc.dataClassification` | nanoid | product_code | データ分類 (sensitivity) |

### DID 形式

```
did:web:atproto.etzhayyim.com:cpc:{cpc-code}
```

例: `did:web:atproto.etzhayyim.com:cpc:01110` (小麦), `did:web:atproto.etzhayyim.com:cpc:49113` (乗用車)

### Registration Flow

```
CPC Division Performer (e.g. d01cr1a2)
  → app.Command("", "register-to-pds", ...)
    → Q("cpcProducts").Where(Eq{"division": divisionCode}).Query()
    → for each product: WRecord("cpc.product", record)  // → com.etzhayyim.apps.cpc.product
    → G("CPCDivision").Merge({code: divisionCode}).Set({pds_registered: true})
```

### 旧 WRecord kind → 新 Lexicon 移行

| 旧 (禁止) | 新 (必須) |
|---|---|
| `com.etzhayyim.cpc.product` | `cpc.product` → `com.etzhayyim.apps.cpc.product` |
| `cpc.cpc_risks` | `cpc.productRisk` → `com.etzhayyim.apps.cpc.productRisk` |
| `cpc.cpc_standard` | `cpc.qualityStandard` → `com.etzhayyim.apps.cpc.qualityStandard` |
| `cpc.product_flow` | `cpc.productFlow` → `com.etzhayyim.apps.cpc.productFlow` |
| `cpc.cpc_supply_chain` | `cpc.vendorRisk` → `com.etzhayyim.apps.cpc.vendorRisk` |
| `cpc.trade_flow` | `cpc.tradeFlow` → `com.etzhayyim.apps.cpc.tradeFlow` |
| `cpc.cpc_data_classifications` | `cpc.dataClassification` → `com.etzhayyim.apps.cpc.dataClassification` |

### Commands (全 73 division performers 共通)

| Command | 説明 |
|---|---|
| `register-to-pds` | Division 内全製品を PDS に AT record 登録 |
| `resolve-manufacturing-process` | tsukuru process-registry 経由で製造プロセスを解決 |

## Tsukuru Manufacturing Process Linkage

**CPC division performers (div-43/45/47/49/54) が `etzhayyim:tsukuru-process-registry/process-registry@1.0.0` を import し、製品コードから製造プロセスを kotodama linker で解決する。**

| CPC Division | CPC Code | Tsukuru Process | Linker Requires |
|---|---|---|---|
| 45 (Office/computing) | 45220 | `computer-manufacturing` | `etzhayyim:tsukuru-process-registry/process-registry@1.0.0` |
| 47 (Radio/TV/comm) | 47210 | `smartphone-manufacturing` | `etzhayyim:tsukuru-process-registry/process-registry@1.0.0` |
| 43 (General-purpose machinery) | 43131 | `aircraft-engine-manufacturing` | `etzhayyim:tsukuru-process-registry/process-registry@1.0.0` |
| 43 (General-purpose machinery) | 43132 | `jet-engine-manufacturing` | `etzhayyim:tsukuru-process-registry/process-registry@1.0.0` |
| 49 (Transport eq.) | 49113 | `automobile-manufacturing` | `etzhayyim:tsukuru-process-registry/process-registry@1.0.0` |
| 49 (Transport eq.) | 49622 / 49623 | `aircraft-manufacturing` | `etzhayyim:tsukuru-process-registry/process-registry@1.0.0` |
| 49 (Transport eq.) | 49640 | `aircraft-parts-manufacturing` | `etzhayyim:tsukuru-process-registry/process-registry@1.0.0` |
| 54 (Construction) | 54111 | `building-construction` | `etzhayyim:tsukuru-process-registry/process-registry@1.0.0` |

Invoke path: `CPC div performer → tsukuru-api process-registry → tsukuru process performer`

## Governance Integration

| Governance WIT | CPC 適用 |
|---|---|
| `kotodama:governance/raci` | 製品安全検査の RACI 宣言 |
| `kotodama:governance/rbac` | 製品データアクセス制御 |
| `governance.data-classification` | 製品データの sensitivity (公開/内部/機密) |
| `governance.standards-profile` | 製品品質規格 (ISO, Codex, IEC) の採用状況 |
| `governance.supply-chain` | サプライヤーリスク評価 |

## WIT Packages

| Package | Path | 内容 |
|---|---|---|
| `etzhayyim:cpc-product-classification@1.0.0` | `wit/cpc-product-classification/` | Core types, classification query, trade flow, quality standards |
| `etzhayyim:cpc-0@1.0.0` | `wit/cpc-0/` | Section 0: Agriculture products capability |
| `etzhayyim:cpc-1@1.0.0` | `wit/cpc-1/` | Section 1: Ores, minerals, utilities capability |
| `etzhayyim:cpc-2@1.0.0` | `wit/cpc-2/` | Section 2: Food, textiles capability |
| `etzhayyim:cpc-3@1.0.0` | `wit/cpc-3/` | Section 3: Other transportable goods capability |
| `etzhayyim:cpc-4@1.0.0` | `wit/cpc-4/` | Section 4: Metal, machinery capability |
| `etzhayyim:cpc-5@1.0.0` | `wit/cpc-5/` | Section 5: Construction capability |
| `etzhayyim:cpc-6@1.0.0` | `wit/cpc-6/` | Section 6: Trade, transport services capability |
| `etzhayyim:cpc-7@1.0.0` | `wit/cpc-7/` | Section 7: Financial, real estate services capability |
| `etzhayyim:cpc-8@1.0.0` | `wit/cpc-8/` | Section 8: Business services capability |
| `etzhayyim:cpc-9@1.0.0` | `wit/cpc-9/` | Section 9: Community, social services capability |

## SQL Graph Schema

| Node | Properties | 用途 |
|---|---|---|
| `:CPCProduct` | code, name, section, division, group, class_, subclass, description | CPC 製品分類マスタ |
| `:CPCTradeFlow` | source_country, dest_country, product_code, value, volume, year | 国際貿易フロー |
| `:CPCQualityStandard` | standard_id, name, body, product_codes, status | 品質規格マッピング |

| Edge | From → To | 用途 |
|---|---|---|
| `:PRODUCES` | `:EconomicEntity` → `:CPCProduct` | 産業 → 製品産出 |
| `:TRADES` | `:CPCProduct` → `:CPCProduct` | 貿易フロー (国間) |
| `:CONFORMS_TO` | `:CPCProduct` → `:CPCQualityStandard` | 品質規格準拠 |
| `:CPC_ISIC_MAP` | `:CPCProduct` → `:ISICClass` | CPC-ISIC concordance |

## Coverage Target

CPC Ver.2.1 full hierarchy:
- 10 Sections (0-9): coordinator components
- 71 Divisions: APP boundary
- 305 Groups: Entity DO grouping
- 1,167 Classes: Entity DO instances
- 2,738 Subclasses: Entity DO sub-instances

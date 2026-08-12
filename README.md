# cpc — 国連 CPC Ver.2.1（Central Product Classification）の実装

**名乗り**: この repo の名前 `cpc` は 3 文字の略語で、それ自体は何も説明しない。中身は
**国連統計部（UNSD）の Central Product Classification Ver.2.1 —— 生産物（財・サービス）の
公式分類 —— を、etzhayyim substrate（AT Protocol PDS レコード）と kotodama worker の
2 面から実装した TypeScript コード**である。産業分類（ISIC）が「誰が何をしているか」を
分類するのに対し、CPC は「何が作られたか」を分類する。両者の対応表（concordance）も
この repo が持つ。

出所: <https://unstats.un.org/unsd/classifications/Econ/cpc>（2026-08-12 に HTTP 200 を実測。
ただし応答が遅く、25 秒では返らないことがある）

---

## この repo の現在地（2026-08-12 実測）

**単一 commit `431a618` の抽出直後の状態で、依存が 1 つも繋がっていない。** `migration.edn` が
記録するとおり、`etzhayyim/root` の `60-apps/etzhayyim-project-cpc`（12 ファイル / 53,573 byte）を
切り出したもので、切り出しの際にモノレポの兄弟パッケージへの依存が宙に浮いた。

| 面 | 実測した状態 |
|---|---|
| `kotoba/` の `pnpm install` | **通らない**。git 依存の連鎖の途中 `git+https://github.com/kotoba-lang/ipfs.git#main` が `ERR_PNPM_MISSING_PACKAGE_NAME` |
| `appview/` の `pnpm install` | **通らない**。`@etzhayyim/kotodama-host-sdk@workspace:*` が workspace に居ない（`ERR_PNPM_WORKSPACE_PKG_NOT_FOUND`）。下記のとおり、この npm パッケージは既に存在しない |
| `kotoba/src/types.ts` の純関数 | **動く**。依存ゼロ。node 26 の type stripping でそのまま import できる |
| `appview` のテスト | **動く**（host SDK を `vi.mock` で完全に差し替えているため）。10 件中 **9 件 pass / 1 件 fail** |
| `pnpm seed` | **走らせられない**。読み先の `data/products/` がこの repo に無い（データファイル 0 件） |

踏める手順と、踏めない手順がなぜ踏めないかは **[docs/operator-quickstart.md](docs/operator-quickstart.md)** に
実際のコマンドと実際の出力で書いてある。install が通らないという事実は、その文書の中で
再現できる形にしてある。

---

## 何が入っているか

| パス | 何か | 行数 | 外部依存 |
|---|---|---|---|
| `kotoba/src/types.ts` | CPC コードの階層分解（純関数）と `CpcProduct` レコード型 | 116 | **なし** |
| `kotoba/src/index.ts` | PDS からの読み取り API（`queryByPrefix` / `getByCode` / `getChildren`） | 78 | `@etzhayyim/sdk` |
| `kotoba/src/seed.ts` | 製品 JSON → PDS レコードの投入（rkey = CPC コードなので冪等） | 126 | `@etzhayyim/sdk` |
| `kotoba/src/types.test.ts` | 階層規則の固定（vitest） | 101 | `@etzhayyim/sdk`（`seed.ts` 経由） |
| `appview/cpc-cpc2p1-core/src/app.ts` | kotodama worker。9 コマンド + heartbeat | 489 | `@etzhayyim/kotodama-host-sdk` |
| `appview/cpc-cpc2p1-core/src/app.test.ts` | worker コマンドのテスト（host SDK は mock） | 159 | vitest のみ |
| `PROJECT.jsonld` | DODAF/WIT の設計宣言（83 component、11 WIT package の**予定**） | — | — |
| `CLAUDE.md` | Contract-Bounded Architecture の設計方針 | — | — |

### 2 つの依存が今どこに居るか（「無い」と結論する前に索引を引いた結果）

- **`@etzhayyim/sdk`** —— git 依存先 `etzhayyim/com-etzhayyim-sdk` は現在 **`kotoba-lang/sdk` へ
  リダイレクトされている**（org ごと改名）。clone 自体は通るので、URL の陳腐化は install が
  通らない原因ではない。原因はその先の git 依存連鎖（`@etzhayyim/atproto-client` /
  `base-l2` / `checkpointer` / `ipfs` / `pqh` / `witness-quorum` の 6 本、いずれも npm registry には
  無く git pin）が解決しきらないこと。
- **`@etzhayyim/kotodama-host-sdk`** —— repo が消えたのではない。
  **`kotoba-lang/kotodama-host` の `sdk/kotodama-host-sdk/` に在る**。ただしそこの README が
  「TypeScript package metadata and runtime facade code were removed; EDN/CLJC is the authority」と
  宣言しているとおり、**npm パッケージとしての実体は意図的に撤去され、正本が CLJC/EDN の
  facade（`resources/kotodama_host/sdk_facade.edn` / `src/host-contract.cljc`）へ移った**。
  つまり `appview/` の `workspace:*` は、もう TypeScript としては存在しないものを指している。
- **これは cpc 固有の傷ではない。** `@etzhayyim/kotodama-host-sdk` を package.json に
  宣言している repo は、**checkout 済みの範囲だけで 55 本**（2026-08-12 実測。west は
  4,000 超の repo を管理しており、未 checkout の分はこの数に入っていない）。cpc を
  単独で直しても同じ形が 54 本以上残るので、直すなら fleet 単位の判断になる。

### worker が公開する 9 コマンド

`appview/cpc-cpc2p1-core/src/app.ts` の `createWorkerExport` が登録するもの（すべて
`asAgentTool` 付き = agent から呼べる）:

| NSID | 中身 |
|---|---|
| `…apps.cpc.catalog.listSections` | 10 section を返す |
| `…apps.cpc.catalog.listDivisions` | section の範囲から division を組み立てて返す |
| `…apps.cpc.catalog.getProduct` | コード完全一致で 1 件 |
| `…apps.cpc.catalog.searchProducts` | section / division / 名前部分一致で絞る |
| `…apps.cpc.concordance.get` | CPC → ISIC4 / HS2017 / SITC4 の対応 |
| `…apps.cpc.process.resolveManufacturingProcess` | division → tsukuru 製造プロセス |
| `…apps.cpc.registry.registerToPds` | division 内の製品を PDS レコードとして書く |
| `…apps.cpc.stats` | カバレッジのスナップショット |
| `…apps.cpc.wave` | `app.bsky.feed.post` を 1 本投げる |

---

## 分類の構造（`types.ts` が正本）

**CPC は完全に数値で、厳密な前置一致階層**である。ISIC のように section が英字ではないので、
親コードは「1 桁短い自分自身」で機械的に求まる。

```
section  1 桁   0–9
division 2 桁   例 01
group    3 桁   例 011
class    4 桁   例 0111
subclass 5 桁   例 01110  → 小麦
```

`kotoba/src/types.ts` はこの規則そのものを関数にしている（`cpcLevel` / `parentOf` /
`ancestorsOf` / `hierarchyOf`）。この規則が壊れると seeder が親子を取り違えたレコードを
PDS に書くので、`types.test.ts` はここを固定するために存在する。

DID: `did:web:cpc.etzhayyim.com:product:{code}`

---

## カタログの実測カバレッジ

`app.ts` が持つのは**代表サンプル**であって CPC 全体ではない。実測（コードを数えた値）:

| 面 | 実測 | CPC 2.1 全体（`PROJECT.jsonld` の主張） |
|---|---|---|
| 製品行（subclass） | **22** | 2,738 |
| 到達する section | **9**（6 が無い） | 10 |
| 到達する division | **21** | 71 |
| 到達する group | **21** | 305 |
| 到達する class | **22** | 1,167 |
| concordance 行 | **9** | — |
| 製造プロセス対応 | **4**（division 45 / 47 / 49 / 54） | — |

### 文書と実装のずれ（未解決、直していない）

数え直した結果、宣言と実装が食い違っている箇所がある。**どちらが正しいかをこの文書は
決めていない** —— 見つけた事実だけを置く。

| 主張している場所 | 主張 | コードの実測 |
|---|---|---|
| `PROJECT.jsonld` `coverage.classes` | 21 | 22 |
| `PROJECT.jsonld` `coverage.subclasses` | 23 | 22 |
| `PROJECT.jsonld` `coverage.divisions.total` | 71 | `app.ts` の `cmdStats` は **73** で割っている |
| `CLAUDE.md` の tsukuru 対応表 | division 43 を含む 5 件 | `app.ts` は **4 件**（43 が無い） |
| `README.edn` `:name` | `com-etzhayyim-app-cpc` | 実際の remote は `cloud-itonami/cpc` |
| `migration.edn` `:destination` | `etzhayyim/com-etzhayyim-app-cpc` | 同上 |

### 既知の赤いテスト 1 件 —— 3 枚重なっている

`app.test.ts` の `registerToPds writes records unless dry_run` は変更前から赤い。表に出る
エラーは 1 つだが、剥がすと下から別の理由が出てくる（実際に剥がして確かめた）:

1. `cmdRegisterToPds` **だけ**が `async` なのに、テストの `getHandler` が同期ハンドラとして
   型を付け `await` せずに `dec()` へ渡す →
   `TypeError: The "list" argument must be an instance of SharedArrayBuffer, …`
2. `await` を入れると次はこれ ——
   `Error: [vitest] No "createKyselyDb" export is defined on the "@etzhayyim/kotodama-host-sdk" mock`。
   `app.ts` は非 dry-run 経路で `createKyselyDb()` を呼ぶが、テストの `vi.mock` factory が
   その export を返していない。
3. mock を足しても、**アサーション自体が実装より古い**。テストは
   `dispatchCalls` に `com.atproto.repo.createRecord` が 1 件積まれることを期待するが、
   現在の `cmdRegisterToPds` は `dispatch` を一度も呼ばず、Kysely で
   `vertex_cpc_product` テーブルへ行を書く。

つまり **1 行の `await` 漏れではなく、実装が PDS dispatch から DB 書き込みへ移った際に
取り残されたテスト**である。直すには「registerToPds は何をするのが正か」を先に決める必要が
ある。この repo に変更を入れるときは **「10 件中 9 pass / 1 fail」を出発点**として比べること。

---

## 設計の背景

`CLAUDE.md` が Contract-Bounded Component Architecture（規制根拠 → WIT interface → APP DO →
Entity DO）を、`PROJECT.jsonld` が 11 の WIT package と 10 の section coordinator を宣言して
いる。**この 2 つは設計の宣言であって、実装の記述ではない** —— 現時点で `wit/` ディレクトリは
この repo に存在せず、実装は上表の 6 ファイルだけである。読むときは分けて読むこと。

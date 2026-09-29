# operator quickstart — cpc

**この文書に書いてある手順は、書いた本人が実際に踏んで出力を確認したものだけである。**
踏めなかった手順は「踏めなかった」と、その時の正確なエラーとともに §3 に置いた。install が
通らないという事実も再現できるようにしてある —— 通らないことを知らずに 30 分溶かすより、
5 分で同じエラーに到達できるほうがよい。

実測環境（2026-08-12、macOS / Darwin 25.3.0）:

```
node   v26.3.0
pnpm   10.26.2
npm    11.16.0
```

node が **22 以上**であることがこの文書の唯一の前提。§1 は TypeScript を型剥がし
（type stripping）でそのまま実行するので、トランスパイラも install も要らない。

---

## 1. 依存ゼロで階層規則を確かめる（30 秒）

`kotoba/src/types.ts` は import を 1 つも持たない純粋なモジュールなので、そのまま動く。

```bash
node -e "import('./kotoba/src/types.ts').then(m => {
  console.log('level 01110 =', m.cpcLevel('01110'));
  console.log('ancestors   =', m.ancestorsOf('01110'));
  console.log('parent 0111 =', m.parentOf('0111'));
  console.log('did         =', m.productDid('0111'));
})"
```

実際に出た出力:

```
level 01110 = subclass
ancestors   = [ '0', '01', '011', '0111' ]
parent 0111 = 011
did         = did:web:cpc.etzhayyim.com:product:0111
```

これが CPC の階層規則そのもの（1 桁 = section … 5 桁 = subclass、親は 1 桁短い自分自身）。
`01110` は小麦。ここが壊れると seeder が親子を取り違えたレコードを PDS に書くので、
この repo で最初に確かめるべきはここ。

---

## 2. worker のテストを走らせる（install なし、約 1 分）

`appview/cpc-cpc2p1-core/src/app.test.ts` は `@etzhayyim/kotodama-host-sdk` を `vi.mock` で
**丸ごと差し替えている**ので、host SDK が無くても走る。ところが同じディレクトリで
`pnpm install` すると、その使いもしない依存の解決に失敗して止まる（§3-b）。
そこで **src とテスト設定だけを持ち出して、vitest だけを入れて走らせる**:

```bash
rm -rf /tmp/cpc-verify && mkdir -p /tmp/cpc-verify && cd /tmp/cpc-verify
cp -R <repo>/appview/cpc-cpc2p1-core/src .
cp <repo>/appview/cpc-cpc2p1-core/vitest.config.ts .
printf '{"name":"cpc-verify","private":true,"type":"module","devDependencies":{"vitest":"^4.1.0"}}\n' > package.json
NPM_CONFIG_USERCONFIG=/dev/null pnpm install
NPM_CONFIG_USERCONFIG=/dev/null npx vitest run
```

`NPM_CONFIG_USERCONFIG=/dev/null` が要る理由は §3-a。実際に出た結果:

```
 ❯ src/app.test.ts (10 tests | 1 failed) 55ms
     × registerToPds writes records unless dry_run 4ms

 Test Files  1 failed (1)
      Tests  1 failed | 9 passed (10)
```

**この 1 件は変更前から赤い。** そして **1 行の欠陥ではない** —— 上の層を剥がすと下から
別の理由が出てくることを、実際に剥がして確かめた:

| 剥がす前 | 出るエラー |
|---|---|
| そのまま | `TypeError: The "list" argument must be an instance of SharedArrayBuffer, …`（`cmdRegisterToPds` だけが `async` なのにテストが `await` していない） |
| `await` を入れる | `[vitest] No "createKyselyDb" export is defined on the "@etzhayyim/kotodama-host-sdk" mock` |
| mock に足す | アサーションが実装より古い。テストは `dispatchCalls` に `com.atproto.repo.createRecord` が積まれることを期待するが、現在の実装は `dispatch` を呼ばず Kysely で `vertex_cpc_product` に行を書く |

**この repo に変更を入れるときは「9 pass / 1 fail」を出発点として比べる** —— 自分が壊したのか
どうかを、この 1 件と取り違えないこと。

---

## 3. 踏めなかった手順と、その正確な理由

### (a) `kotoba/` の `npm install` —— このマシン固有の壁

```
npm error code EALLOWSCRIPTS
npm error --allow-scripts is not allowed in project-scoped installs.
```

原因は repo ではなく **このマシンの `~/.npmrc`**。そこに

```
allow-scripts[]=@anthropic-ai/claude-code
```

が入っており、npm 11.16 はこれを project-scoped install で拒否する。git 依存の
`prepare`（`tsc` ビルド）はその内側で `npm install` を呼ぶので、そこで詰まる。回避は
ユーザ設定を読ませないこと:

```bash
NPM_CONFIG_USERCONFIG=/dev/null pnpm install
```

**この壁は fleet のノードでは出ない可能性が高い**（同種の事例が superproject の AGENTS.md に
ある —— 「ローカルで赤」は「fleet で赤」ではない）。ローカルの結果だけで repo を壊れていると
判定しないこと。

### (b) `kotoba/` の `pnpm install` —— 依存連鎖が解決しきらない

上の回避を入れると先へ進むが、次は pnpm が git 依存のビルドを許可制にしているため止まる:

```
ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED
  "@etzhayyim/sdk" needs to execute build scripts but is not in the
  "onlyBuiltDependencies" allowlist.
```

`pnpm-workspace.yaml` に 7 本（`@etzhayyim/sdk` + その git 依存 `atproto-client` /
`base-l2` / `checkpointer` / `ipfs` / `pqh` / `witness-quorum`）を並べると、そこも越える。
**その先で本物の壁に当たる**:

```
ERR_PNPM_MISSING_PACKAGE_NAME
  Can't install git+https://github.com/kotoba-lang/ipfs.git#main: Missing package name
```

依存連鎖の奥に、パッケージ名を解決できない git 指定が残っている。ここから先は cpc 側の
修正では越えられない。したがって **`pnpm test` / `pnpm typecheck` / `pnpm seed` は現時点で
走らせられない**（`kotoba/src/types.test.ts` も `seed.ts` 経由で `@etzhayyim/sdk` を
import するため、純関数のテストであっても install を要求する）。

なお `pnpm-workspace.yaml` はこの repo に**置いていない** —— 置いても install は通らず、
「通るように見えて通らない」設定が増えるだけだから。

### (c) `appview/` の `pnpm install`

```
ERR_PNPM_WORKSPACE_PKG_NOT_FOUND
  "@etzhayyim/kotodama-host-sdk@workspace:*" is in the dependencies but no package
  named "@etzhayyim/kotodama-host-sdk" is present in the workspace
```

抽出でモノレポの兄弟パッケージを失った跡。**その兄弟は `kotoba-lang/kotodama-host` の
`sdk/kotodama-host-sdk/` に在るが、npm パッケージとしての実体は撤去され CLJC/EDN facade に
なっている**（詳細は README）。同じ宣言を持つ repo はこの workspace に 55 本ある。

### (d) `pnpm seed`

`kotoba/src/seed.ts` は既定で `../data/products`（= repo 直下の `data/products/`）から
製品 JSON を読むが、**この repo にデータファイルは 1 件も無い**。install が通ったとしても
投入するものが無い。

---

## 4. 復旧するなら、どの順で

上から順に、前が満たされないと次が意味を持たない:

1. **`@etzhayyim/kotodama-host-sdk` を fleet 単位でどうするか決める**（55 repo 共通の問題）。
   CLJC/EDN facade が正本になった以上、TS の `workspace:*` 宣言は行き先が無い。
2. **`kotoba/` の git 依存連鎖**（`kotoba-lang/ipfs#main` のパッケージ名解決）を上流で直す。
   ここが通らない限り `kotoba/` 側のテスト・typecheck・seed はどれも走らない。
3. **`registerToPds` は何をするのが正かを決めてから、テストを実装に合わせる**（§2 の表）。
   `await` を足すだけでは緑にならない —— mock に `createKyselyDb` が要り、さらに
   「PDS へ dispatch する」というアサーション自体が現在の実装（Kysely で
   `vertex_cpc_product` に書く）と食い違っている。1 と 2 には依存しないので、
   **この repo だけで完結して直せる唯一の赤**ではある。
4. **`data/products/` を用意する**（seeder の入力。§3-d）。
5. `PROJECT.jsonld` / `AGENTS.md` と実装の食い違い（README の表）を、どちらへ寄せるか決める。

**3 は §2 の手順で赤→緑を目で確認できる**（install を通す必要が無いため）。1・2 は cpc 単独の
判断では決められない。

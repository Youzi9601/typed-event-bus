# typed-event-bus — AI Agent 專案操作指引

> 本檔案為 `typed-event-bus` 專案專用的 AGENTS.md，依據全域 AGENTS.md 規範制定。

---

## 專案理解

### 核心定位
**Define Once, Use Everywhere** —— 唯一真實來源是 `EventDefinition`，不是字串，不是 interface。

### 專案結構

```
typed-event-bus/
├── src/
│   ├── bus.ts                  # createEventBus factory function (main entry)
│   ├── constants.ts            # 內部 metadata keys + meta event 定義（newListenerEvent, removeListenerEvent）
│   ├── bus/
│   │   ├── context.ts          # BusContext - internal state (listeners, middlewares, options, registry)
│   │   ├── emit.ts             # sync emit (fire-and-forget)
│   │   ├── emit-async.ts       # async emit (await all, aggregates MultiError)
│   │   ├── on.ts               # subscribe (sync/async/prepend), newListener meta event
│   │   ├── on-all.ts           # wildcard with correlation narrowing
│   │   ├── once.ts             # subscribe once
│   │   ├── off.ts              # unsubscribe single (lastIndexOf, removeListener meta event)
│   │   └── utils.ts            # runListeners, emitMetaEvent, listenerCount, eventNames, rawListeners, removeAllListeners, use
│   ├── define.ts               # defineEvent, defineEvents, EventDefinition, EventNamespace
│   ├── subscription.ts         # Subscription class
│   ├── types.ts                # 核心型別
│   ├── middleware.ts           # Middleware
│   ├── errors.ts               # MultiError, onError
│   └── index.ts                # 公開 API
├── tests/
│   ├── runtime/        # 運行期測試
│   └── types/          # 型別測試 (*.test-d.ts)
├── bench/              # 基準測試
├── .changeset/         # Changesets（發布版本 + CHANGELOG）
├── scripts/            # CI 輔助
└── .github/workflows/  # CI/CD
```

---

## 執行框架

### 開發命令

```bash
# 安裝依賴
pnpm install

# 開發模式（watch）
pnpm dev

# 單次建置
pnpm build

# 測試
pnpm test              # runtime tests
pnpm test:types        # type tests (vitest expectTypeOf)
pnpm test:watch        # watch mode

# 程式碼品質
pnpm lint              # biome check
pnpm lint:fix          # biome check --write
pnpm format            # biome format --write

# 基準測試
pnpm bench
node scripts/check-budget.js

# 完整檢查（CI 等同）
pnpm check
```

### 發布流程（僅維護者）

```bash
pnpm changeset   # 建立 changeset（記錄變更）
pnpm version     # 套用 changeset（版本 + CHANGELOG）
# commit + push 後打 tag v*（git tag vX.Y.Z && git push origin vX.Y.Z）
# GitHub Actions（release.yml）自動執行 pnpm check 並發布 npm（--provenance）
```

---

## 規劃政策

### 里程碑（v2 規劃）

| 階段 | 交付物 | 狀態 |
|------|--------|------|
| M0 PoC | 5 項 PoC 驗證 | 已完成 |
| M0 核心 | defineEvent、defineEvents、createEventBus、emit/emitAsync/on/once/onAll、Subscription、錯誤處理 | 已完成 |
| M1 品質 | Middleware、maxListeners、Debug mode、文檔、範例 | 已完成 |
| M2 發布 | Changesets、npm 發布自動化、CI 完善 | 已完成（0.1.2 已發布） |

### 變更決策流程

1. **所有變更需對應 Issue**（Bug/Feature/Question 模板）
2. **破壞性變更需在 PR 中說明決策理由**
3. **型別變更需同步更新 type tests**
4. **Bundle size 不得超標**（CI 閘門：gzip-size ≤ 2520 bytes）

---

## 證據優先

### 型別系統驗證

- 所有型別運算必須在 **TS ≥ 5.0.0** 可編譯
- `pnpm test:types` 100% 通過才能合併
- 新 API 必須先寫 `tests/types/*.test-d.ts` 再實作 runtime

### 效能基準

- `pnpm bench` 建立基準線
- `scripts/check-budget.js` 作為 CI 閘門（純 Node 實作，使用 `zlib.gzipSync`，Windows / Unix 皆可執行）
- 任何 PR 導致效能退步 > 10% 需說明理由

---

## 工具使用規範

### 必用內建工具

| 任務 | 使用工具 | 禁用 |
|------|----------|------|
| 讀檔 | `read_file` | 不使用 shell 讀檔指令（`cat` / `type` 等） |
| 寫檔 | `write_file` | 不使用 shell 寫檔指令（`echo >` / `tee` 等） |
| 改檔 | `patch` | 不使用 `sed -i` / `awk` |
| 搜尋內容 | `search_files` | 不使用 `grep -r` / `rg` / `findstr` |
| 找檔案 | `search_files target=files` | 不使用 `find -name` / `dir /s` |
| 執行命令 | `terminal` | 僅限建置、測試、git、套件管理 |

### 終端機可接受操作

- `pnpm install` / `pnpm build` / `pnpm test` / `pnpm lint`
- `git` 操作
- `node scripts/*.js`
- 套件管理：`pnpm add` / `pnpm remove` / `pnpm update`

## Output Narration Requirements

Before EVERY tool call, output a brief plain-language explanation:
- What you are about to do
- Why this step is necessary

After receiving tool results, output a brief interpretation before proceeding.

---

## 驗證政策

### 合併前必驗

- [ ] `pnpm lint` 通過（Biome zero warnings）
- [ ] `pnpm test:types` 100% 通過
- [ ] `pnpm test` 通過（coverage 目標 > 95% 為手動檢視目標，以 `pnpm exec vitest run --coverage` 檢視，非 CI 閘門）
- [ ] `pnpm build` 成功
- [ ] `node scripts/check-budget.js` ≤ 2520 bytes（CI 閘門，檢查 dist/index.js 與 dist/index.cjs）
- [ ] 無 `console.log` / `debugger` 殘留
- [ ] Commit 符合 Conventional Commits

### 文檔同步

- API 變更 → 更新 README / API 文檔
- 行為變更 → 更新 CHANGELOG（由 changeset 自動生成）
- 新功能 → 新增範例或使用說明
- 型別或行為變更 → 同步更新相關 JSDoc 註解與 type tests
- 結構或流程變更 → 同步更新 AGENTS.md / CONTRIBUTING.md（結構圖、指令、閘門）
- Breaking 變更 → 新增 `.changeset/` entry（版本 0.y.z 以 minor → 0.(y+1).0；版本 x.y.z（x≥1）以 major → (x+1).0.0）

---

## 變更安全

### 破壞性變更檢查清單

- [ ] 是否修改公開型別導出？
- [ ] 是否修改公開函式簽名？
- [ ] 是否移除公開 API？
- [ ] 是否改變錯誤處理行為？
- [ ] 是否改變 async 行為？

**若任一為是**：
1. 在 PR 標記 `breaking` label
2. 在 PR 描述中記錄決策理由
3. 新增 `.changeset/` entry（版本 0.y.z 以 minor → 0.(y+1).0；版本 x.y.z（x≥1）以 major → (x+1).0.0）

### 回滾機制

- `git revert <commit>` 即可
- npm 套件發布後不可刪除，需發布修正版本

---

## 最小變更原則

- 單一 PR 單一關注點
- 影響 < 25% 檔案內容時，僅修改受影響區塊
- 避免大規模重構除非有 ADR 支持

---

## 除錯方法

### 型別錯誤除錯

1. 確認 TS 版本 >= 5.0
2. `pnpm test:types` 看具體錯誤行
3. 檢查 `defineEvent` / `defineEvents` 定義是否正確
4. 確認 `createEventBus` 注入的 registry 結構

### Runtime 錯誤除錯

1. `pnpm test` 看失敗測試
2. 檢查 `bus.emit` / `bus.on` 引用的 EventDefinition 是否同一個物件
3. Wildcard narrowing 失敗 → 檢查 `onAll` handler 參數是否為 `{ event, payload }` 物件

---

## 專案特定慣例

### 命名規範

| 類別 | 規範 | 範例 |
|------|------|------|
| EventDefinition 變數 | camelCase + 動詞 | `userCreated`, `orderPaid` |
| Namespace 物件 | camelCase + Events | `userEvents`, `orderEvents` |
| Bus 實例 | `bus` | `const bus = createEventBus(...)` |
| Subscription | `sub` | `const sub = bus.on(...)` |
| 型別參數 | PascalCase | `TPayload`, `TName`, `TRegistry` |

### 型別定義慣例

```typescript
// EventDefinition 核心型別
interface EventDefinition<TName extends string, TPayload> {
  readonly __brand: unique symbol
  readonly name: TName
}

// 公開 API 匯出（見 src/index.ts）：defineEvent, defineEvents, EventDefinitionBuilder,
// createEventBus, EventBus, createSubscription, EventSubscription, Subscription,
// MultiError, defaultErrorHandler, middleware factories（含 executeMiddleware）,
// isEventDefinition, isEventNamespace, newListenerEvent, removeListenerEvent 與核心型別
```

### 測試命名

```
tests/runtime/emit.test.ts          # emit 行為測試
tests/types/emit.test-d.ts          # emit 型別測試
tests/runtime/onAll.test.ts         # onAll 行為測試
tests/types/parity.test-d.ts        # Node parity 對照型別測試
```

---

## 環境資訊

- **Node.js**: >= 20.0.0（CI: 22）
- **TypeScript**: >= 5.0.0（peerDependency；開發：7.0.2）
- **pnpm**: 9.12.3（corepack）
- **Build**: tsup 8.5.1（esbuild）
- **Test**: vitest 4.1.10
- **Lint/Format**: Biome 2.5.8

---

## 參考文件

- [README](README.md) —— 專案介紹、快速開始、API 概覽
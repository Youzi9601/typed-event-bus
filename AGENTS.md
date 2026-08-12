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
│   ├── bus/
│   │   ├── context.ts          # BusContext - internal state (listeners, middlewares, options, registry)
│   │   ├── emit.ts             # sync emit (fire-and-forget)
│   │   ├── emit-async.ts       # async emit (await all, aggregates MultiError)
│   │   ├── on.ts               # subscribe (sync/async)
│   │   ├── on-all.ts           # wildcard with correlation narrowing
│   │   ├── once.ts             # subscribe once
│   │   ├── off.ts              # unsubscribe single
│   │   └── utils.ts            # listenerCount, eventNames, removeAllListeners, use
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
pnpm changeset   # 互動式版本更新 + CHANGELOG 生成
pnpm release     # build + publish
```

---

## 規劃政策

### 里程碑（v2 規劃）

| 階段 | 交付物 | 狀態 |
|------|--------|------|
| M0 PoC | 5 項 PoC 驗證 | 待執行 |
| M0 核心 | defineEvent、defineEvents、createEventBus、emit/emitAsync/on/once/onAll、Subscription、錯誤處理 | 待執行 |
| M1 品質 | Middleware、maxListeners、Debug mode、文檔、範例 | 規劃中 |
| M2 發布 | Changesets、npm 發布自動化、CI 完善 | 規劃中 |

### 變更決策流程

1. **所有變更需對應 Issue**（Bug/Feature/Question 模板）
2. **破壞性變更需 ADR 記錄**（在 PR 中說明決策理由）
3. **型別變更需同步更新 type tests**
4. **Bundle size 不得超標**（< 2.5 KB gzipped，CI 閘門，見 ADR-13）

---

## 證據優先

### 型別系統驗證

- 所有型別運算必須在 **TS 5.0+** 可編譯
- `pnpm test:types` 100% 通過才能合併
- 新 API 必須先寫 `tests/types/*.test-d.ts` 再實作 runtime

### 效能基準

- `pnpm bench` 建立基準線
- `scripts/check-budget.js` 作為 CI 閘門
- 任何 PR 導致效能退步 > 10% 需說明理由

---

## 工具使用規範

### 必用內建工具

| 任務 | 使用工具 | 禁用 |
|------|----------|------|
| 讀檔 | `read_file` | `cat`, `head`, `tail` |
| 寫檔 | `write_file` | `echo >`, `tee`, heredoc |
| 改檔 | `patch` | `sed -i`, `awk` |
| 搜尋內容 | `search_files` | `grep -r`, `rg` |
| 找檔案 | `search_files target=files` | `find -name` |
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

Format:
> [action intent]: <one sentence>
→ [tool call]
> [result interpretation]: <one sentence>

---

## 驗證政策

### 合併前必驗

- [ ] `pnpm lint` 通過（Biome zero warnings）
- [ ] `pnpm test:types` 100% 通過
- [ ] `pnpm test` 覆蓋率 > 95%
- [ ] `pnpm build` 成功
- [ ] `gzip-size dist/index.js` < 2500 bytes (ADR-13)
- [ ] 無 `console.log` / `debugger` 殘留
- [ ] Commit 符合 Conventional Commits

### 文檔同步

- API 變更 → 更新 README / API 文檔
- 行為變更 → 更新 CHANGELOG（由 changeset 自動生成）
- 新功能 → 新增範例或使用說明

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
2. ADR 記錄決策理由
3. 主要版本號 +1（changeset major）

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

// 公開 API 不導出內部型別（如 EventsOf, RuntimeNameOf 等）
// 僅導出：defineEvent, defineEvents, createEventBus, EventDefinition, EventNamespace, Subscription
```

### 測試命名

```
tests/runtime/emit.test.ts          # emit 行為測試
tests/types/emit.test-d.ts          # emit 型別測試
tests/runtime/onAll.test.ts         # onAll 行為測試
tests/types/narrowing.test-d.ts     # wildcard narrowing 型別測試
```

---

## 環境資訊

- **Node.js**: >= 20.0.0 (CI: 20, 22)
- **Bun**: latest (CI 測試)
- **Deno**: v2.x (CI 測試)
- **TypeScript**: >= 5.0.0 (peerDependency)
- **pnpm**: 9.x
- **Build**: tsup 8.x (esbuild)
- **Test**: vitest 2.x
- **Lint/Format**: Biome 1.9.x

---

## 參考文件

- [v2 設計文件](typed-event-bus-design-v2.md) —— 架構決策、API 定案、PoC 清單
- [專案規劃](plan.md) —— 里程碑、KPI、技術棧
- [README](README.md) —— 專案介紹、快速開始、API 概覽
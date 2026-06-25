# AGENTS.md — 開發規範手冊

本文件定義所有 AI agent 與人類開發者在此專案中必須遵守的原則。
每次開發新功能、修 bug、更新 SPEC.md 前，請先通讀對應章節。

> **每次 PR 前都必須執行 3.5 Step 2.5 文件同步檢查**，確認 SPEC.md、README.md、AGENTS.md 均已反映本次異動。

---

## 目錄

1. [寫程式的原則](#1-寫程式的原則)
2. [測試的原則](#2-測試的原則)
3. [開發流程原則（Branch → Commit → PR）](#3-開發流程原則branch--commit--pr)
4. [Commit Code 的原則（Branch 上的 commit）](#4-commit-code-的原則branch-上的-commit)
5. [判讀與更新 SPEC.md 的原則](#5-判讀與更新-specmd-的原則)

---

## 1. 寫程式的原則

### 1.1 高內聚低耦合（分層架構）

- **純計算邏輯**（prompt 組裝、搜尋排序、資料轉換）放在 `src/lib/*.ts`，不依賴
  React、Next.js request/response 物件、或任何外部服務 client。
- **API Route Handler**（`src/app/api/**/route.ts`）只負責：解析 request →
  呼叫 `lib/` 函式或 `services/` → 回傳 response。**禁止**在 route handler
  內寫複雜計算邏輯或資料庫查詢邏輯。
- **Services**（`src/services/*.ts`）封裝外部依賴（Prisma client、Google
  Drive API、AI Provider、Embedding API），對外提供清楚的函式介面。
- **UI 元件**（`src/components/`）只能從 `lib/`、自己的 props，或透過
  fetch 呼叫 API 取得資料，禁止直接 import `services/`（避免把 server-only
  邏輯打包進 client bundle）。

```
允許的依賴方向：
  app/api/**/route.ts → services      ✅
  app/api/**/route.ts → lib           ✅
  services            → lib           ✅
  services            → prisma client ✅
  components          → lib           ✅
  components          → services      ❌（server-only，會誤打包進 client）
```

### 1.2 純函式優先

- 所有可以寫成純函式的計算（prompt 組裝、tsvector query 組裝、cosine
  similarity 排序、分頁參數計算）**必須**寫成純函式，放在 `src/lib/`，
  並附上 JSDoc/TSDoc 說明參數型別與回傳值。
- 需要副作用的操作（DB 寫入、外部 API 呼叫、檔案上傳）集中在 `services/`。

```ts
// ✅ 純函式（lib/prompt.ts）
export function buildFinalPrompt(basePrompt: string, fields: { key: string; value: string }[]): string { ... }

// ❌ 不純（混入副作用）
export function buildFinalPrompt(basePrompt: string, fields: KV[]) {
  await prisma.generationJob.create({ ... }); // 副作用，不該在這裡
  return result;
}
```

### 1.3 防禦性資料處理

- 任何從外部來的值（API response、使用者輸入、Drive/AI provider 回應），
  都必須做 null / undefined / 空字串防護。
- 圖片生成失敗、AI 辨識失敗、Drive 上傳失敗時，狀態用明確的 enum
  （`pending | success | failed`），**不要**用 `null` 或空字串代表失敗。
- 找不到資料時回傳 `null`，UI 層統一顯示「無資料」，不顯示崩潰錯誤。

### 1.4 資料結構一致性（Single Source of Truth）

- 所有資料模型定義於 `prisma/schema.prisma`，**唯一來源**；TypeScript 型別
  透過 Prisma Client 自動產生，禁止手動重複定義 model 型別。
- 變更 schema 時，同步：`prisma migrate dev` 產生 migration、更新相關
  `lib/`、`services/` 函式、測試的工廠函式。

核心資料模型（概念）：

```
User { id, googleId, email, name, avatarUrl }
StylePreset { id, userId, name, basePrompt }
PromptField { id, stylePresetId?, key, value, order }
GenerationJob { id, userId, provider, promptFinal, params(json), status, resultUrl, error }
Image { id, userId, jobId, driveFileId, driveViewUrl, title, description, aiCaption, embedding(vector) }
Tag { id, userId, name }
```

### 1.5 錯誤處理

- 所有外部呼叫（AI provider、Google Drive API、Embedding API）一律
  `try/catch`，失敗時記錄到 `console.error` 並回傳結構化錯誤
  （`{ error: { code, message } }`），不讓 API route 拋出未捕捉例外。
- Drive token 過期時，統一在 `services/googleDrive.ts` 內處理 refresh，
  上層呼叫者不需感知 token 細節。
- AI 生成/辨識屬於非同步、可能失敗的任務，失敗不應影響使用者已產生的資料
  （例如 AI caption 失敗，圖片本身仍正常顯示）。

### 1.6 效能注意事項

- 圖庫列表一律分頁（cursor-based 或 limit/offset），禁止一次撈全部圖片。
- 語意搜尋（pgvector）查詢需有適當 index（`ivfflat` 或 `hnsw`），避免全表掃描。
- 縮圖優先使用 Drive 提供的縮圖 URL，避免自行處理圖片轉檔。

---

## 2. 測試的原則

### 2.1 測試涵蓋範圍

- `src/lib/` 下的每一個 exported 函式**都必須有對應測試**。
- 新增函式 → 同一個 PR/commit 內必須附上測試，不能事後補。
- `services/` 內含有純邏輯分支的方法（例如 prompt 組裝後的驗證、搜尋排序）
  需測試；純粹的外部 API 呼叫包裝（無分支邏輯）可不測試，但需在 PR 描述中說明。
- API route handler 裡**禁止包含純計算邏輯**，所有邏輯應可在 `lib/` 單獨測試。

### 2.2 測試結構

```ts
describe('buildFinalPrompt', () => {
  it('正常情況：basePrompt + fields 依序串接', () => { ... });
  it('邊界情況：fields 為空陣列時只回傳 basePrompt', () => { ... });
  it('錯誤情況：basePrompt 為空字串', () => { ... });
  it('【防迴歸】具體 bug 描述', () => { ... }); // 曾發生過的 bug 必加
});
```

### 2.3 防迴歸測試（必加）

每次修復 bug，必須補一個描述該 bug 的測試，並在 `it()` 描述開頭加上 `【防迴歸】`。

### 2.4 測試資料工廠

```ts
const makeUser = (overrides = {}) => ({
  id: 'user_1', googleId: 'g_1', email: 'a@b.com', name: 'Test', ...overrides,
});

const makeImage = (overrides = {}) => ({
  id: 'img_1', userId: 'user_1', title: '', description: '', ...overrides,
});
```

### 2.5 測試命名規範

- `describe` 第一層：函式/模組名稱
- `it` 描述要說明**期待結果**，不說明實作細節

### 2.6 執行測試

```bash
npm test            # 單次執行（commit / CI 前必過）
npm run test:watch  # 開發中監看模式
npx playwright test # e2e（需先啟動 dev server）
```

**每次 commit 前，測試必須全數通過（0 failed）。**

---

## 3. 開發流程原則（Branch → Commit → PR）

### 3.0 完整開發流程（必須遵守）

```
1. git checkout main && git pull --ff-only
2. git checkout -b <type>/<scope>-<簡述>
3. 在 branch 上開發，分批 commit（每個 commit 一件事）
4. 自我 review（見 3.5），文件同步（Step 2.5）必須在同一 branch 補 commit
5. push + 建立 PR，等待 CI 綠燈與 review 後 merge
6. 若 PR 開啟後有追加 commit，同步更新 PR title / description
```

**Branch 命名規則：**

| Prefix | 用途 | 範例 |
|---|---|---|
| `feat/` | 新功能 | `feat/style-preset-crud` |
| `fix/` | Bug 修正 | `fix/drive-upload-token-refresh` |
| `refactor/` | 重構 | `refactor/prompt-builder-extract` |
| `test/` | 補測試 | `test/semantic-search-coverage` |
| `docs/` | 文件更新 | `docs/spec-update-p2` |
| `chore/` | 依賴、工具、CI 等雜務 | `chore/ci-add-prisma-migrate-check` |

### 3.5 PR 建立前的自我 Review 流程

#### Step 1：確認 diff 範圍合理

```bash
git diff main...HEAD --stat
git diff main...HEAD
```

#### Step 2：逐項清單檢查

```
□ 所有改動都是本次需求的範疇
□ 沒有 console.log 除錯碼遺留（console.error/warn 可接受）
□ 沒有 TODO 尚未處理（或已標記在 SPEC.md）
□ 新函式有 TSDoc 說明
□ npm test 通過（0 failed）
□ npm run build 無 error
□ npx prisma validate 通過（若改了 schema）
□ SPEC.md 狀態已同步更新（若適用）
```

#### Step 2.5：文件同步檢查（每次 PR 必做）

> ⛔ **硬性門檻**：`.md` 更新必須與功能程式碼在同一個 PR 內 commit。

| 檔案 | 每次功能 PR 應確認的事項 |
|---|---|
| **SPEC.md** | 對應功能項目是否已標記 `[x]`；新需求是否已補充規格 |
| **README.md** | 功能特色、環境變數、啟動指令是否仍正確 |
| **AGENTS.md** | 若有新的開發規範、技術棧或架構決策，是否已補充 |

#### Step 3：bug 風險評估

1. 這個改動影響哪些現有功能？是否可能破壞它們？
2. 有沒有邊界情況（空陣列 / null / token 過期 / API 額度用盡）沒處理？
3. 資料來源格式假設（Drive API / AI provider response）是否已驗證？

#### Step 4：PR 描述

```markdown
## Summary
- 一句話說明做了什麼

## Files Changed
（每個異動檔案一行說明）

## How to Test
（reviewer 怎麼手動驗證）

## Known Issues / TODO
（沒有則填「無」）
```

---

## 4. Commit Code 的原則

### 4.1 Commit 時機

- 一個 commit 只做一件事。
- 功能與對應測試**鼓勵放在同一個 commit**。
- 不 commit 未完成的半成品（除非用 `WIP:` 前綴明確標示）。

### 4.2 Commit Message 格式（Conventional Commits）

```
<type>(<scope>): <簡短說明>

[選填] 較詳細的說明，說明「為什麼」而非「做了什麼」
```

| type | 用途 |
|---|---|
| `feat` | 新功能 |
| `fix` | 修 bug |
| `refactor` | 重構（不影響行為） |
| `test` | 新增或修改測試 |
| `perf` | 效能優化 |
| `style` | 格式調整 |
| `docs` | 文件更新 |
| `chore` | 建置工具、依賴、CI 等雜務 |

**scope 範例：** `auth`、`prompt`、`drive`、`gallery`、`search`、`ci`

### 4.3 commit 前檢查清單

```
□ npm test 通過（0 failed）
□ npm run build 無 error
□ 新功能有對應測試（lib/ 純函式 + services/ 含邏輯分支的方法）
□ Route handler 內無 inline 純計算邏輯（已抽至 lib/）
□ 新的 bug fix 有防迴歸測試
□ 沒有 console.log 除錯碼遺留
□ 沒有 hardcode 的 API key / OAuth secret
□ SPEC.md 對應功能狀態已更新
□ 文件同步（README / AGENTS）已在本 branch 更新
```

### 4.4 不應該 commit 的東西

- `node_modules/`、`.next/`（已在 .gitignore）
- `.env*`（含 API key、OAuth secret 的檔案）
- 暫時的測試用 `console.log`

---

## 5. 判讀與更新 SPEC.md 的原則

### 5.1 用途

`SPEC.md` 是本系統的功能規格書，決定下一步做什麼、什麼不做。

### 5.2 優先級判讀規則

| 優先級 | 意義 | 開發原則 |
|---|---|---|
| P0 | 帳號/資料安全，缺少會導致資料外洩或無法使用 | 必須最先實作 |
| P1 | 核心生成流程，產品價值主張 | P0 完成後立即實作 |
| P2 | 圖庫管理基本功能 | P1 穩定後排入 |
| P3 | 搜尋功能（依賴 P2 資料） | P2 完成後排入 |
| P4+ | 差異化 / 實驗性功能 | 評估可行性後再決定 |

**禁止跳著做**：不可因某低優先級功能「比較有趣」就跳過高優先級功能。

### 5.3 狀態標記

```
[ ] 待開發    [x] 已完成    [~] 進行中（WIP）    [-] 已決定不做（附理由）
```

每次功能完成後同步更新狀態，commit message 加入 `docs(spec): 標記 P1-5 圖片生成 provider 為已完成`。

### 5.4 新增功能格式

```markdown
#### N. 功能名稱 `[ ]`
**背景**：為什麼需要（使用者痛點）
**功能規格**：
- 具體、可驗收的行為描述
- 涉及的檔案/模組
```

### 5.5 判讀「做還是不做」

1. 是否影響帳號安全/資料隔離？→ 是，立即評估，視情況插隊到 P0
2. 是否修復現有功能 bug？→ 是，列為 hotfix，立即處理
3. 是否在現有架構下可快速實作（< 2hr）？→ 是，可插入目前迭代
4. 是否需要付費 API 或複雜基礎設施？→ 記錄在 SPEC.md，評估成本後再做

---

## 附錄：專案技術棧速查

```
前端/後端：Next.js 14+（App Router）+ TypeScript
驗證：NextAuth.js（Google Provider + Drive OAuth scope）
資料庫：PostgreSQL + Prisma ORM + pgvector extension
圖片儲存：Google Drive API（使用者自己的 Drive，drive.file scope）
AI 生成：抽象 Provider interface（先接 OpenAI Images API）
AI 辨識/Embedding：Vision API（caption/tag）+ Embedding API（語意搜尋）
測試：Vitest（單元）+ Playwright（e2e）
CI/CD：GitHub Actions（lint + test + build + prisma migrate check）
部署：Docker（待補）/ Vercel（待評估）
```

## 附錄：常用指令

```bash
npm run dev              # 本地開發
npm test                 # 單元測試
npx playwright test      # e2e 測試
npx prisma migrate dev   # 套用 migration（本地）
npx prisma studio        # 檢視資料庫
npm run build            # production build
```

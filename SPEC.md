# SPEC.md — Image Magic 功能規格與路線圖

## 專案簡介

讓使用者用 prompt + 動態表單建立 AI 圖片生成請求，以 Google 帳號登入、
圖片存到使用者自己的 Google Drive，並提供完整圖庫管理（標籤、AI 辨識、
關鍵字 + AI 語意搜尋）。

## 現有功能盤點

| 模組 | 已完成 |
|---|---|
| （全新專案，尚無已完成功能） | |

## 待開發功能規格

### P0 — 帳號與資料安全（必做，理由：沒有登入與資料隔離，後續功能無意義）

#### 1. Google OAuth 登入 `[x]`
**背景**：使用者要用自己的 Google 帳號登入，資料記錄在自己帳號下。
**功能規格**：
- 使用 NextAuth.js + Google Provider，scope 包含 `openid email profile` 與
  `https://www.googleapis.com/auth/drive.file`（僅存取 App 建立的檔案）。
- 登入後在 `users` 表建立/更新使用者資料：`id, google_id, email, name, avatar_url, created_at`。
- 未登入使用者導向登入頁，無法存取 `/app/*` 路由。

#### 2. 資料庫 Schema 與 Prisma 初始化 `[x]`
**背景**：所有功能都依賴資料模型，需先定義好再開發功能。
**功能規格**：
- PostgreSQL + Prisma，啟用 `pgvector` extension。
- 建立核心 model：`User`, `StylePreset`, `PromptField`, `GenerationJob`,
  `Image`, `Tag`, `ImageTag`。
- 提供 migration 腳本與 `prisma/seed.ts`（種子資料供本地開發）。

---

### P1 — 核心生成流程（產品價值主張）

#### 3. 基礎風格指令（Style Preset）管理 — API `[x]`
**背景**：使用者要能建立、編輯、刪除自己的基礎風格 prompt 模板。
**功能規格**：
- CRUD API：`/api/style-presets`（GET/POST）、`/api/style-presets/:id`（PATCH/DELETE）。
- 欄位：`name, basePrompt`，屬於建立者 `userId`，已驗證不可跨帳號存取（service 層用 `findFirst({ id, userId })` 確認所有權）。
- 輸入驗證：`lib/stylePreset.ts` 的 `validateStylePresetInput`（純函式，已測試）。

#### 3b. 基礎風格指令管理 — UI `[ ]`
**背景**：3 號項目先完成 API，UI 列表/編輯表單為延伸項目。
**功能規格**：
- 列表頁顯示使用者所有 StylePreset。
- 新增/編輯表單（呼叫上述 API），刪除需二次確認。

#### 4. 動態表單 Key-Value 擴充描述 — API `[x]`
**背景**：使用者要能在基礎風格之外，動態新增任意數量的 key:value 描述欄位
（例如 主體/背景/光線），組合進最終 prompt。
**功能規格**：
- CRUD API：`/api/style-presets/:id/fields`（GET/POST）、
  `/api/style-presets/:id/fields/:fieldId`（PATCH/DELETE），所有權透過
  `stylePresetId + userId` 雙重驗證。
- 欄位 `order` 決定串接順序，`GET` 依 `order` 排序回傳。
- `lib/prompt.ts` 的 `buildFinalPrompt(basePrompt, fields)` 已存在（bootstrap
  階段示範用），純函式組合 `basePrompt + 依序串接的 key: value`。
- 輸入驗證：`lib/promptField.ts` 的 `validatePromptFieldInput`（純函式，已測試）。
- 一次性欄位（不存模板）不需要後端持久化，由前端直接帶入產圖請求即可，故不在此 API 範疇。

#### 4b. 動態表單 Key-Value 擴充描述 — UI `[ ]`
**背景**：4 號項目先完成 API，UI（新增/排序/刪除欄位、一次性 vs 模板切換）為延伸項目。
**功能規格**：
- 表單可動態新增/刪除 key:value 列，支援拖曳排序（呼叫 `order` 欄位更新）。
- 切換「儲存為模板」（呼叫上述 API）或「僅本次使用」（不呼叫 API，前端暫存）。

#### 5. AI 圖片生成 Provider 抽象層 `[x]`
**背景**：免費額度容易用完，需要可切換/擴充多個 provider，並記錄用量。
**功能規格**：
- `ImageProvider` interface（`services/imageProviders/types.ts`）：`generate(params): {url, raw}`。
- 已實作 `OpenAiImageProvider`，透過 `services/imageProviders/index.ts` 的
  registry（`getImageProvider(name)`）依名稱取得 provider，架構上可直接新增第二個 provider。
- `GenerationJob` model 記錄：`userId, provider, promptFinal, params(json),
  status(pending/success/failed), resultUrl, error, createdAt`。
- `UsageLog` model：按 `userId + provider + date`（UTC 當天）累計呼叫次數
  （`lib/generationJob.ts` 的 `toUsageDateKey` 純函式，已測試），供未來限流/計費使用。
- API：`POST /api/generation-jobs`（建立並立即執行）、`GET /api/generation-jobs`（列表）。
- 失敗不拋例外，記錄在 `job.status = failed` + `job.error`，呼叫端依 HTTP 502 / job 內容判斷。

#### 6. 產出圖片上傳 Google Drive `[x]`
**背景**：圖片要存在使用者自己的 Drive，不佔用我方儲存成本，所有權歸屬使用者。
**功能規格 / 實作備註**：
- 登入時若 Google 回傳 `refresh_token`（僅首次同意授權時會給），存入
  `User.driveRefreshToken`（`src/services/auth.ts` 的 `signIn` callback）。
- `src/services/googleDrive.ts`：`refreshAccessToken`（用 refresh token 換 access
  token）、`ensureAppFolder`（找不到 `ImageMagic` 資料夾就建立，找得到則重用，
  並把 id 存回 `User.driveFolderId` 避免重複建立）、`uploadImageToDrive`
  （multipart upload 到 Drive v3 API）。
- `src/lib/driveUpload.ts`：`buildMultipartUploadBody`、`buildGeneratedImageFileName`
  純函式（組 multipart body、產生檔名），已測試（4 個 case）。
- `src/services/images.ts`：`uploadGeneratedImageToDrive(userId, jobId, resultUrl)`
  下載 provider 回的暫時圖片網址、上傳到使用者 Drive，建立 `Image` row
  （`driveFileId`, `driveViewUrl`, `jobId`）。
- 串接在 `services/generationJobs.ts`：圖片生成成功後才嘗試上傳；Drive 上傳失敗時
  整個 job 標記為 `failed`（保留 `resultUrl` 方便除錯），錯誤訊息加上
  `Drive upload failed:` 前綴方便辨識失敗階段。
- `User` 未曾完成過 Google 授權（沒有 `driveRefreshToken`）時直接拋錯，視為
  Drive 上傳失敗，由呼叫端依 job 狀態判斷。
- Thumbnail / width / height 欄位先保留為空，待 P2 圖庫功能再補（非本次範疇）。

---

### P2 — 圖庫管理（圖庫該有的基本功能）

#### 7. 標題 / 描述編輯 `[x]`
**背景**：使用者要能幫圖片補充標題與描述。
**實作備註**：
- `lib/image.ts`：`validateImageUpdateInput`（長度驗證，title ≤200 字、
  description ≤2000 字，未提供的欄位不驗證）、`normalizeClearableText`
  （空白字串正規化為 `null`，視為清空欄位，而非驗證錯誤），共 8 個測試 case。
- `services/images.ts`：`listImages(userId)`、
  `updateImage(userId, id, input)`（先以 `findFirst({ id, userId })` 確認
  所有權，再更新；不屬於自己的圖片回傳 `null`）。
- API：`GET /api/images`（列表，僅回傳自己的圖片）、
  `PATCH /api/images/:id`（更新 title/description，空字串清空欄位）。

#### 8. 標籤系統（使用者自訂） `[x]` — API
**背景**：方便分類與篩選圖片。
**實作備註**：
- `lib/tag.ts`：`validateTagName`（trim、非空、長度上限 50 字），5 個測試 case。
- `services/tags.ts`：`listTags`、`findOrCreateTag`（同使用者下名稱唯一，
  用 upsert 取得既有或建立）、`deleteTag`（所有權檢查）、`listImageTags`、
  `addTagToImage`（圖片不屬於自己回傳 `null`，標籤不存在則自動建立）、
  `removeTagFromImage`（圖片與標籤都需屬於自己才能移除關聯）。
- API：`GET/POST /api/tags`（列表/建立）、`DELETE /api/tags/:id`、
  `GET/POST /api/images/:id/tags`（列出/新增圖片標籤）、
  `DELETE /api/images/:id/tags/:tagId`（移除圖片標籤）。
- UI（輸入自動建議既有標籤）：拆成 8b 延伸項目，待前端開發階段一併處理。

#### 8b. 標籤系統 UI（自動建議、新增/移除互動） `[ ]`

#### 9. AI 辨識內容（自動 Caption + Tag 建議） `[x]` — API
**背景**：使用者不想每張圖都手動寫描述/標籤。
**實作備註**：
- `lib/visionResult.ts`：`parseVisionResponseText` 純函式，從 Vision 模型的
  文字回應中解析出 `{ caption, tags }`（容忍 markdown code fence 包裹、
  過濾非字串 tag），6 個測試 case。
- `services/visionProviders/{types,openai,index}.ts`：`VisionProvider`
  介面 + `OpenAiVisionProvider`（呼叫 OpenAI Chat Completions 的 vision
  輸入），registry 架構與 `imageProviders` 一致，可擴充其他 provider。
- `Image` model 新增 `aiTagSuggestions`（Json，建議標籤陣列）、
  `aiRecognitionError`（記錄辨識失敗原因）欄位 + migration。
- `services/imageRecognition.ts`：`runImageRecognition(imageId)`，呼叫
  Vision provider 寫入 `aiCaption`/`aiTagSuggestions`；失敗只記錄
  `aiRecognitionError`，**不拋例外**，不影響呼叫端。
- 串接在 `generationJobs.ts`：Drive 上傳成功建立 `Image` 後執行，
  失敗不影響 `GenerationJob` 的成功狀態（與 Drive 上傳失敗會讓 job 失敗的
  行為不同，符合「失敗不影響主流程」的規格）。
- API：`POST /api/images/:id/ai-tags/accept`（把建議標籤逐一轉成真正標籤，
  並清空建議列表）、`POST /api/images/:id/ai-tags/dismiss`（直接清空建議列表）。

---

### P3 — 搜尋功能

#### 10. 關鍵字搜尋 `[x]`
**背景**：使用者要能用文字快速找到圖片。
**實作備註**：
- `lib/search.ts`：`validateSearchQuery`（trim、非空、長度上限 200 字），5 個測試 case。
- `services/imageSearch.ts`：`searchImages(userId, query)` 用 `prisma.$queryRaw`
  （`Prisma.sql` 參數化避免注入）執行 PostgreSQL 全文檢索：先用 CTE 把每張圖
  的標籤名稱聚合成一段文字（`string_agg`），再對
  `title + description + aiCaption + 標籤文字` 組成的 `to_tsvector('simple', ...)`
  用 `plainto_tsquery('simple', query)` 比對；範圍限定在 `userId`。
- 沒有用 stored generated column／trigger 維護 tsvector，因為 tags 在另一張表，
  即時計算雖然查詢成本較高，但避免了 tags 增刪時還要同步更新 Image 上的
  tsvector 欄位的複雜度；待資料量大時可評估改為 materialized view 或 trigger。
- API：`GET /api/images/search?q=關鍵字`，僅回傳該使用者自己的圖片。

#### 11. AI 語意搜尋 `[ ]`
**背景**：關鍵字搜尋無法理解語意相近但用詞不同的查詢。
**功能規格**：
- 對每張圖的 `ai_caption`（或 final_prompt）計算 embedding，存入 `pgvector` 欄位。
- 查詢字串即時轉 embedding，用 cosine similarity 排序回傳前 N 筆。
- API：`GET /api/images/semantic-search?q=描述文字`。

---

## 技術債與基礎強化

- 測試覆蓋率：API route 與 utils 純函式單元測試、關鍵流程 e2e 測試。
- 錯誤處理：Drive 上傳失敗重試機制、AI provider 逾時/額度錯誤的使用者提示。
- 效能：圖片列表分頁、縮圖快取策略待評估（是否需要 CDN）。
- 安全：Drive OAuth token 加密儲存、API rate limiting。

## 優先開發路徑建議

`P0(1→2) → P1(3→4→5→6) → P2(7→8→9) → P3(10→11)`

P0、P1 為核心，必須先完成才有可用產品；P2 圖庫管理可分批完成；
P3 搜尋功能依賴 P2 的資料（caption/tags）才有意義，故排在最後。

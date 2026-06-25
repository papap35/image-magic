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

#### 1. Google OAuth 登入 `[ ]`
**背景**：使用者要用自己的 Google 帳號登入，資料記錄在自己帳號下。
**功能規格**：
- 使用 NextAuth.js + Google Provider，scope 包含 `openid email profile` 與
  `https://www.googleapis.com/auth/drive.file`（僅存取 App 建立的檔案）。
- 登入後在 `users` 表建立/更新使用者資料：`id, google_id, email, name, avatar_url, created_at`。
- 未登入使用者導向登入頁，無法存取 `/app/*` 路由。

#### 2. 資料庫 Schema 與 Prisma 初始化 `[ ]`
**背景**：所有功能都依賴資料模型，需先定義好再開發功能。
**功能規格**：
- PostgreSQL + Prisma，啟用 `pgvector` extension。
- 建立核心 model：`User`, `StylePreset`, `PromptField`, `GenerationJob`,
  `Image`, `Tag`, `ImageTag`。
- 提供 migration 腳本與 `prisma/seed.ts`（種子資料供本地開發）。

---

### P1 — 核心生成流程（產品價值主張）

#### 3. 基礎風格指令（Style Preset）管理 `[ ]`
**背景**：使用者要能建立、編輯、刪除自己的基礎風格 prompt 模板。
**功能規格**：
- CRUD API：`/api/style-presets`（GET/POST/PATCH/DELETE）。
- 欄位：`name, base_prompt`，屬於建立者 `user_id`，不可跨帳號存取。
- UI：列表 + 編輯表單。

#### 4. 動態表單 Key-Value 擴充描述 `[ ]`
**背景**：使用者要能在基礎風格之外，動態新增任意數量的 key:value 描述欄位
（例如 主體/背景/光線），組合進最終 prompt。
**功能規格**：
- UI 提供「新增欄位」按鈕，可自由輸入 key、value，可拖曳排序、可刪除。
- 產圖前，後端依 `base_prompt + 依序串接的 key: value` 組成 `final_prompt`。
- 欄位可選擇儲存為模板（關聯到某個 StylePreset）或僅供本次使用（一次性）。

#### 5. AI 圖片生成 Provider 抽象層 `[ ]`
**背景**：免費額度容易用完，需要可切換/擴充多個 provider，並記錄用量。
**功能規格**：
- 定義 `ImageProvider` interface（`generate(prompt, params): {url, raw}`）。
- 先實作一個 provider（例如 OpenAI Images API），架構上預留第二個 provider 的擴充點。
- `generation_jobs` 表記錄：`id, user_id, provider, prompt_final, params(json),
  status(pending/success/failed), result_url, error, created_at`。
- `usage_logs` 表：按 `user_id + provider + date` 累計呼叫次數，供未來限流/計費使用。

#### 6. 產出圖片上傳 Google Drive `[ ]`
**背景**：圖片要存在使用者自己的 Drive，不佔用我方儲存成本，所有權歸屬使用者。
**功能規格**：
- 生成成功後，後端用使用者的 Drive OAuth token，將圖片上傳到
  使用者 Drive 下的專屬資料夾（例如 `/ImageMagic/`，若不存在則建立）。
- `images` 表記錄：`id, user_id, job_id, drive_file_id, drive_view_url,
  thumbnail_url, width, height, created_at`。
- Token 過期時走 refresh token 流程；失敗時 job 狀態標記失敗並可重試。

---

### P2 — 圖庫管理（圖庫該有的基本功能）

#### 7. 標題 / 描述編輯 `[ ]`
**背景**：使用者要能幫圖片補充標題與描述。
**功能規格**：
- `images.title`, `images.description` 欄位，預設為空，使用者可手動編輯。
- API：`PATCH /api/images/:id`。

#### 8. 標籤系統（使用者自訂） `[ ]`
**背景**：方便分類與篩選圖片。
**功能規格**：
- `tags` 表（`id, user_id, name`，同使用者下名稱唯一）+ `image_tags` 多對多表。
- UI 支援新增、移除標籤，輸入時自動建議既有標籤。

#### 9. AI 辨識內容（自動 Caption + Tag 建議） `[ ]`
**背景**：使用者不想每張圖都手動寫描述/標籤。
**功能規格**：
- 圖片上傳成功後，非同步呼叫 Vision 模型產生 `ai_caption`（一段描述）與
  `ai_tags`（建議標籤陣列），存入 `images.ai_caption`, 並寫入建議標籤
  （使用者可一鍵採用或忽略）。
- 失敗不影響主流程（屬於增強功能），記錄錯誤即可。

---

### P3 — 搜尋功能

#### 10. 關鍵字搜尋 `[ ]`
**背景**：使用者要能用文字快速找到圖片。
**功能規格**：
- PostgreSQL 全文檢索（`tsvector`），索引 `title + description + ai_caption + tags`。
- API：`GET /api/images/search?q=關鍵字`，依使用者範圍過濾。

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

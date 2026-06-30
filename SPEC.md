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

#### 3b. 基礎風格指令管理 — UI `[x]`
**背景**：3 號項目先完成 API，UI 列表/編輯表單為延伸項目。
**實作備註**：
- `src/app/app/style-presets/page.tsx`：client component，掛載時呼叫
  `GET /api/style-presets` 載入列表。
- 同一頁面包含新增/編輯表單（共用同一組 input state，依是否有
  `editingId` 決定呼叫 `POST` 或 `PATCH /api/style-presets/:id`），送出成功後
  reload 列表並清空表單。
- 列表每筆顯示「編輯」（帶入表單）與「刪除」按鈕，刪除前用
  `window.confirm` 二次確認，呼叫 `DELETE /api/style-presets/:id`。
- 錯誤訊息（API 回傳的 `error.message`）直接顯示在頁面上，不中斷其餘 UI。

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

#### 4b. 動態表單 Key-Value 擴充描述 — UI `[x]`
**背景**：4 號項目先完成 API，UI（新增/排序/刪除欄位、一次性 vs 模板切換）為延伸項目。
**實作備註**：
- `src/app/app/style-presets/[id]/fields/page.tsx`：client component，掛載時呼叫
  `GET /api/style-presets/:id/fields` 載入該風格指令的欄位列表（依 `order` 排序）。
- 新增欄位表單呼叫 `POST .../fields`（`order` 帶入目前長度，新增於尾端）；
  每列提供「上移/下移」按鈕，呼叫兩次 `PATCH .../fields/:fieldId` 互換相鄰兩筆
  的 `order` 達成排序效果（未使用拖曳套件，避免引入額外依賴）；「刪除」呼叫
  `DELETE .../fields/:fieldId`。
- 從 `style-presets` 列表頁每筆新增「管理動態欄位」連結導向此頁。
- 「一次性欄位 vs 儲存為模板」的切換待產圖請求表單（尚未開發，屬於本次
  範疇外的生成流程 UI）一併設計時再實作，目前頁面僅管理屬於模板的欄位
  （與 SPEC 4 號 API 範疇一致：一次性欄位本就不持久化、不經過此 API）。

#### 5. AI 圖片生成 Provider 抽象層 `[x]`
**背景**：免費額度容易用完，需要可切換/擴充多個 provider，並記錄用量。
**功能規格**：
- `ImageProvider` interface（`services/imageProviders/types.ts`）：
  `generate(params, credentials): {url, raw}`，`credentials` 的 key 因 provider 而異。
- `services/imageProviders/index.ts` 的 registry（`getImageProvider(name)`）依名稱取得
  provider 實例，並 export `PROVIDER_DEFINITIONS`（`{id, label, authMode}`）供
  API/前端取得可選清單，架構上可直接新增第三個 provider。
- 所有出圖 provider 目前都是 `byok`（Bring Your Own Key）：使用者自己輸入 API
  key，加密存在 `ProviderApiKey` 表（見下方說明），之後不用每次都重新輸入。
  `authMode` 欄位仍保留在 `ProviderDefinition` type 上，供未來若有站方共用額度
  的 provider 時擴充用，但目前兩個 provider 都是 `byok`。
- 已實作兩個 provider：
  - `openai`（`byok`）：直接呼叫 OpenAI Images API 出圖。
  - `huggingface`（`byok`）：呼叫 Hugging Face Inference API
    （`src/services/imageProviders/huggingface.ts`），預設模型
    `stabilityai/stable-diffusion-xl-base-1.0`；HF 回傳的是原始圖片 bytes
    （非網址），因此 base64 編碼成 `data:` URL 回傳，沿用既有
    `uploadGeneratedImageToDrive` 的 `fetch(resultUrl)` 下載流程（Node 內建
    fetch 原生支援 `data:` URL，無需額外改動）。
- **「Claude 改寫 prompt」是與出圖 provider 完全獨立的選用功能**（Claude 沒有
  圖片生成 API，僅負責文字改寫，不會出現在 provider 選單）：
  - `src/services/promptEnhancement.ts`：`enhancePromptWithClaude(prompt,
    anthropicApiKey)`，呼叫 Anthropic Messages API 把 prompt 改寫得更詳細生動；
    任何失敗（網路、非 2xx、回應格式不對）都靜默回退用原始 prompt，不中斷整個
    生成請求。
  - `src/services/promptEnhancementAuth.ts`：
    `resolvePromptEnhancementAuth(enabled, password)`，未啟用時直接回傳
    `{ ok: true, anthropicApiKey: null }`；啟用時驗證「共用密碼」
    （`PROMPT_ENHANCEMENT_PASSWORD`）通過後才回傳站方的 `ANTHROPIC_API_KEY`，
    密碼錯誤回 401、站方未設定金鑰回 500。4 個測試 case。
  - `src/lib/providerPassword.ts`：`verifySharedProviderPassword`，用
    `crypto.timingSafeEqual` 做常數時間比對，避免時序攻擊；env
    （`PROMPT_ENHANCEMENT_PASSWORD`）未設定或輸入缺失時一律回傳 `false`
    （不拋例外）。4 個測試 case。
- `src/services/providerCredentials.ts`：`resolveProviderCredentials(userId,
  provider)`，純粹查使用者自己存的 BYOK key，統一回傳
  `{ ok: true, credentials }` 或帶 HTTP status/錯誤訊息的失敗結果，由呼叫端的
  API route 轉成對應的錯誤回應。
- `ProviderApiKey` model（`userId, provider, encryptedKey`，`@@unique([userId,
  provider])`）+ migration：使用者自備的 API key 經
  `src/lib/tokenCrypto.ts` 的 `encryptToken`/`decryptToken`（與 Drive refresh
  token 共用同一套 AES-256-GCM 加密、同一支 `DRIVE_TOKEN_ENCRYPTION_KEY`）加密
  後存入，從不存明碼。
- API：
  - `GET /api/providers`：回傳 `PROVIDER_DEFINITIONS`（給前端畫下拉選單）。
  - `GET /api/provider-keys`：回傳目前使用者已儲存 key 的 provider 名稱列表
    （不回傳 key 本身）；`POST /api/provider-keys`（`provider, apiKey`）儲存/
    更新；`DELETE /api/provider-keys/:provider` 刪除。
  - `POST /api/generation-jobs`：body 為 `provider, promptFinal`，外加選填的
    `enhancePrompt`（boolean）與 `password`（僅 `enhancePrompt` 為 true 時需要）。
    依序呼叫 `resolveProviderCredentials` 取得出圖憑證、
    `resolvePromptEnhancementAuth` 驗證改寫密碼，通過後才（視需要）呼叫
    `enhancePromptWithClaude` 改寫 prompt，再建立並執行 job。
- `GenerationJob` model 記錄：`userId, provider, promptFinal, params(json),
  status(pending/success/failed), resultUrl, error, createdAt`。
- `UsageLog` model：按 `userId + provider + date`（UTC 當天）累計呼叫次數
  （`lib/generationJob.ts` 的 `toUsageDateKey` 純函式，已測試），供未來限流/計費使用。
- `GET /api/generation-jobs`（列表）。
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

#### 6b. AI 圖片生成請求 — UI `[x]`
**背景**：5、6 號項目完成了產圖 API（建立 GenerationJob、上傳 Drive），
但使用者仍無法透過介面真正觸發生成，是整個系統可被使用的關鍵入口。
**實作備註**：
- `src/app/app/generate/page.tsx`：client component。
- 下拉選單選擇出圖 `provider`（呼叫 `GET /api/providers` 取得選項）；選定後若
  尚未存過該 provider 的 API key，顯示輸入框讓使用者輸入並呼叫
  `POST /api/provider-keys` 儲存（之後沿用，不用每次重新輸入）。
- 獨立的「出圖前先用 Claude 改寫 prompt」checkbox，與上面的 provider 選擇完全
  無關；勾選後才顯示「共用密碼」輸入框（對應 `PROMPT_ENHANCEMENT_PASSWORD`）。
- 下拉選單選擇要套用的 `StylePreset`（選填，選了會呼叫
  `GET /api/style-presets/:id/fields` 載入該模板的固定欄位並顯示）。
- 額外提供「一次性欄位」輸入區（key/value），僅存在前端 state，不呼叫任何
  API（符合 SPEC 4 號項目「一次性欄位不需要後端持久化」的範疇），與模板欄位
  一起傳入既有的 `lib/prompt.ts` 的 `buildFinalPrompt(basePrompt, fields)`
  即時組成最終 prompt 預覽。
- 送出呼叫 `POST /api/generation-jobs`（帶上選定的 `provider`、
  `enhancePrompt`、需要時的 `password`），並重新載入下方的生成紀錄列表。
- 生成紀錄列表呼叫 `GET /api/generation-jobs`，依 `status` 顯示結果圖片
  （`resultUrl`）或錯誤訊息（`error`）。
- `src/app/app/page.tsx` 補上導向「產生圖片／圖庫／風格指令」三個頁面的連結。

#### 6c. 圖生圖（上傳參考圖片） `[x]`
**背景**：使用者希望上傳一張參考圖片，讓出圖結果以這張圖為基礎調整，而非單純
存成附件；需同時支援 `openai` 與 `huggingface` 兩個 provider。
**實作備註**：
- `services/imageProviders/types.ts`：`GenerateImageParams` 新增選填的
  `referenceImage?: { base64, mimeType }`；有提供時走圖生圖路徑，沒有則維持
  原本的純文字出圖。
- `openai`：有參考圖片時改打 `/v1/images/edits`（multipart/form-data，帶
  `image`/`prompt`/`size`/`n`），沒有則維持原本的 `/v1/images/generations`；
  兩者都帶 `model: "gpt-image-1"`（OpenAI Images API 兩個 endpoint都要求帶
  `model`，且 `gpt-image-1` 是目前同時支援生成與編輯的模型）。`gpt-image-1`
  的回應只有 `b64_json`、沒有 `url`，因此 provider 內的 `extractImageUrl`
  會在沒有 `url` 時把 `b64_json` 轉成 `data:` URL，與既有「provider 統一回傳
  `{ url }`」的介面保持相容。
- `huggingface`：有參考圖片時改打 `timbrooks/instruct-pix2pix`（instruction-
  guided 圖片編輯模型，prompt 當作編輯指令），請求改為
  `{ inputs: "data:<mimeType>;base64,<...>", parameters: { prompt } }`；沒有
  參考圖片則維持原本打 `stabilityai/stable-diffusion-xl-base-1.0` 的純文字
  出圖路徑。
- `POST /api/generation-jobs`：body 新增選填的 `referenceImage`
  （`{ base64, mimeType }`），驗證 `mimeType` 必須是 `image/*` 開頭，通過後
  原樣傳給 `createAndRunGenerationJob` → provider 的 `generate()`。
- `src/app/app/generate/page.tsx`：新增「參考圖片」檔案上傳欄位（選填），用
  `FileReader.readAsDataURL` 在前端轉成 base64 並預覽，送出時一併帶入
  `POST /api/generation-jobs` 的 body；提供「移除參考圖片」按鈕清空選擇。
- 已測試：`services/imageProviders/openai.test.ts`、
  `services/imageProviders/huggingface.test.ts`（mock `fetch`，驗證有/無參考
  圖片時打到正確的 endpoint 與 request body 結構）。

#### 6d. `/app/*` 持久導覽列 `[x]`
**背景**：先前每個 `/app/*` 頁面各自獨立，沒有固定導覽列可在頁面間切換。
**實作備註**：
- `src/app/app/layout.tsx`：Next.js App Router nested layout，包住所有
  `/app/*` 路由，渲染一份固定的 `<nav>`（首頁／產生圖片／圖庫／風格指令），
  取代原本只存在於首頁、且每頁要各自加上的做法。
- `src/app/globals.css`：新增 `.app-nav-persistent` 樣式（`position: sticky;
  top: 0`，置中對齊 `main` 的 `max-width: 720px`），讓導覽列固定在頁面最上方。

#### 6e. Loading 狀態與生成紀錄精簡 `[x]`
**背景**：資料讀取中時頁面一片空白，使用者不知道在等待什麼；產生圖片頁的
「生成紀錄」會無限往下長，越用越長。
**實作備註**：
- `src/components/Spinner.tsx`：共用的轉圈 loading 元件（`.spinner` +
  `.spinner-row` CSS，純 CSS keyframe 動畫，不引入額外套件），套用在
  `generate`、`images`、`style-presets`、`style-presets/[id]/fields` 四個
  頁面原本顯示「載入中...」純文字的地方。
- `generate/page.tsx`：新增 `pageLoading` state，等 presets/jobs/providers/
  savedProviders 四個初始請求都完成（`Promise.all`）才顯示表單，避免表單
  在資料尚未到位時就可互動。
- 「生成紀錄」改為表格呈現（`GenerationJobsTable`）：狀態、Prompt（預設只顯示
  兩行，點「展開」/「收合」切換完整內容）、結果（成功顯示縮圖、失敗完整顯示
  `error` 內容、處理中顯示提示文字）、建立時間四欄，確保最重要的資訊（尤其是
  錯誤訊息）一定完整呈現，不會被截斷或省略。產生圖片頁與圖庫（`/app/images`）
  是不同用途的頁面，不互相取代或導流。

#### 6f. 全站 Header、品牌風格與 Dark Mode `[x]`
**背景**：原本每個 `/app/*` 頁面只有一條簡單的導覽列，沒有品牌識別、沒有顯示
登入使用者資訊，也沒有 dark mode。
**實作備註**：
- `src/components/Logo.tsx`：品牌標誌（SVG 星芒圖示 + 漸層文字 wordmark），
  套用 `--color-primary` 到 `--color-accent` 的漸層色。
- `src/components/Header.tsx`：移到 root layout 全站套用的 header，左側放
  Logo（連到 `/app` 或 `/`），中間在已登入時顯示原本四個導覽連結，右側放
  `ThemeToggle` 與使用者頭像選單（`avatar-button` + dropdown，顯示姓名/
  Email、登出按鈕呼叫 `next-auth/react` 的 `signOut`）；未登入時右側顯示
  「登入」按鈕取代頭像。
- `src/app/layout.tsx`：改為 async server component，透過
  `getServerSession(authOptions)` 取得使用者資訊傳給 `Header`；並在
  `<head>` 內嵌一段 bootstrap script，在 hydrate 前依
  `localStorage.theme`（沒有設定時 fallback 到
  `prefers-color-scheme: dark`）決定 `document.documentElement.dataset.theme`，
  避免換頁/重新整理時閃一下錯誤主題（flash of wrong theme）。
- `src/components/ThemeToggle.tsx`：純前端切換 `light`/`dark`，寫回
  `localStorage.theme` 並更新 `documentElement.dataset.theme`；CSS 變數已經
  全站共用（`--color-bg`/`--color-surface`/`--color-text`/...），只需在
  `globals.css` 新增 `:root[data-theme="dark"]` 覆寫整套色票，其餘元件樣式
  不用個別修改即可同時支援兩種主題。
- `src/app/app/layout.tsx`：移除原本內嵌的 `<nav>`（已被全站 Header 取代），
  改為單純的 passthrough layout。
- 既有少數寫死亮色的元件（`.tag-pill`、`.status-badge.pending/.success`）
  改用帶 fallback 的 CSS 變數（例如 `var(--color-tag-bg, #eef2ff)`），並在
  dark 主題中提供對應深色版本，確保在 dark mode 下仍有足夠對比度。

#### 6g. 完整保留底層錯誤原因（`fetch failed` 等） `[x]`
**背景**：Node 的 `fetch` 在底層網路失敗（DNS 查不到、TLS 失敗、連線中斷等）
時，只會拋出訊息固定是 `"fetch failed"` 的 `Error`，真正原因藏在
`error.cause`（通常是帶 `code`，例如 `ENOTFOUND`/`ECONNRESET` 的系統錯誤）。
原本 `services/generationJobs.ts` 只取 `err.message` 存進 `job.error`，導致
使用者在前端只看得到「fetch failed」，看不出實際發生什麼事。
**實作備註**：
- `src/lib/errors.ts`：`describeError(err)` 純函式，沿著 `error.cause` 鏈
  往下走，把每一層的 message（與 `code`，若有）串接起來，沒有 cause 或不是
  `Error` 時則回退成原本行為；4 個測試 case。
- `services/generationJobs.ts` 的兩個 catch block（出圖本身失敗、Drive 上傳
  失敗）都改用 `describeError`，取代原本只取 `err.message` 的寫法。

#### 6h. 品牌標誌與 Favicon `[x]`
**背景**：Header 的 logo 只是一個簡單線條圖示，網站也沒有自訂 favicon。
**實作備註**：
- `src/components/Logo.tsx`：把原本單色線條 sparkle 換成圓角方形漸層徽章
  （`--color-primary` → `--color-accent` 對應的 `#4f46e5` → `#a855f7`
  漸層）裡放白色四角星圖示，視覺上更像完整品牌標誌，搭配右側漸層文字
  wordmark 一起放在 Header 左側。
- `src/app/icon.tsx`、`src/app/apple-icon.tsx`：用 Next.js 的檔案慣例
  （`icon.tsx`/`apple-icon.tsx` 會自動產生對應的 `<link rel="icon">` 等
  metadata）搭配 `next/og` 的 `ImageResponse`（Satori，純 JSX + CSS 渲染成
  PNG），在 build/request 時動態產生 32x32 favicon 與 180x180 Apple touch
  icon，圖案與 Header logo 一致；不需要額外的圖片處理套件或外部美術檔案。

#### 6i. Hugging Face 改用新版 Inference Providers Router 端點 `[x]`
**背景**：Hugging Face 已棄用舊版無伺服器 Inference API 網域
`api-inference.huggingface.co`，改由 Inference Providers 的
`router.huggingface.co` 統一轉發。部署在 Vercel 上呼叫舊網域時收到
`fetch failed: getaddrinfo ENOTFOUND api-inference.huggingface.co (ENOTFOUND)`，
原因是該網域已經從 DNS 移除，並非 Vercel 網路限制問題。
**實作備註**：
- `src/services/imageProviders/huggingface.ts`：新增 `INFERENCE_BASE_URL =
  "https://router.huggingface.co/hf-inference/models"` 常數，文字生圖
  （`requestTextToImage`）與 img2img（`requestImg2Img`）兩個 fetch 呼叫都改用
  這個新的 base URL；`hf-inference` provider 沿用與舊版 API 完全相同的
  request/response 格式，所以只需要換網域，不用改任何請求內容。
- 換到新 router 後發現 `hf-inference` provider 實際服務的模型清單比舊版
  Inference API 小很多，原本的 `DEFAULT_MODEL`
  （`stabilityai/stable-diffusion-xl-base-1.0`）已不在清單內，回應
  `Model not supported by provider hf-inference`。先嘗試改用
  `black-forest-labs/FLUX.1-schnell`，仍是同樣錯誤；直接下載
  `@huggingface/inference` SDK 原始碼比對後確認 FLUX 系列模型在 Hugging
  Face 上是透過 `fal-ai` provider 的非同步佇列 API（送出任務 → 輪詢狀態 →
  取得結果）運作，跟 `hf-inference` 的同步請求/回應協議完全不同，本來就不
  會透過我們現有的程式碼跑起來。最終改用 `@huggingface/inference` SDK
  原始碼註解中明確標示為 hf-inference 文字生圖預設模型的
  `stabilityai/stable-diffusion-2`。img2img 用的 `timbrooks/instruct-pix2pix`
  是否仍受 `hf-inference` 支援尚未確認，本次暫不變動，後續若使用者回報同樣
  錯誤再處理。

#### 6j. 生成中進度提示與生成紀錄分頁 `[x]`
**背景**：出圖請求是單一個會 block 到完成才回應的 fetch，使用者在等待
期間畫面只顯示靜態的「生成中...」文字，容易誤以為卡住沒有反應；另外生成
紀錄全部一次顯示，筆數變多後不好瀏覽。
**實作備註**：
- `src/app/app/generate/page.tsx`：新增 `elapsedSeconds` state，
  `submitting` 為 true 時用 `setInterval` 每秒 +1，按鈕文字改成「生成中...
  已等待 N 秒」，並在按鈕下方加提示文字「圖片生成通常需要數十秒，請耐心
  等候，畫面不會卡住」；目前出圖流程本身沒有中間進度可回報，這個改動只解決
  「看起來卡住」的體感問題，不是真的進度條。
- `GenerationJobsTable` 元件新增 client-side 分頁：`pageSize`（5/10/20/50 筆
  可選，下拉選單）與 `page` state，依目前頁數從完整 `jobs` 陣列 `slice`
  出當頁資料；頁碼按鈕用 `Array.from({ length: pageCount })` 產生，點擊切換
  `page`，目前頁碼套用 `active` class 標示。沒有改動後端 API（`GET
  /api/generation-jobs` 本來就回傳全部紀錄），純前端切資料。

#### 6k. 新增 Google Gemini 圖片生成 provider `[x]`
**背景**：OpenAI 的圖片模型沒有免費額度，Hugging Face `hf-inference`
路由實際服務的精選模型清單會變動、文件也不完整，多次更換 `DEFAULT_MODEL`
仍持續收到 `Model not supported by provider hf-inference`。Google Gemini
API 的圖片輸出模型在免費額度內可用，且文字生圖與圖生圖（img2img）共用同一個
`generateContent` 端點，不需要像 OpenAI／Hugging Face 拆成兩個端點，新增一個
provider 讓使用者有可以實際免費跑起來的選項。
**實作備註**：
- `src/services/imageProviders/gemini.ts`：新增 `GeminiImageProvider`，呼叫
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent`，
  以 `x-goog-api-key` header 帶入 API Key；`contents[0].parts` 永遠帶入文字
  prompt，有參考圖片時多帶一個 `inlineData`（base64 + mimeType）part 達成
  img2img，不需要切換端點或模型。`generationConfig.responseModalities:
  ["TEXT", "IMAGE"]` 是讓回應包含圖片 part 的必要設定。回應的圖片在
  `candidates[0].content.parts[].inlineData` 裡，轉成 `data:` URL 回傳，
  與既有 provider 的回傳格式一致。
- `src/services/imageProviders/index.ts`：在 `providers` 與
  `PROVIDER_DEFINITIONS` 中註冊 `gemini`（`authMode: "byok"`），使用者一樣
  需要自備 API Key 才能使用。

#### 6l. 修正 Gemini 模型名稱、新增更換／清空 API Key `[x]`
**背景**：上線後實測收到
`models/gemini-2.0-flash-preview-image-generation is not found for API
version v1beta, or is not supported for generateContent`——該 preview 模型
已被下架。另外使用者回報儲存 API Key 後，畫面只會顯示「已儲存」，沒有任何
方式可以更換或清空已存的 Key（後端 `PUT`/`upsert` 與 `DELETE
/api/provider-keys/[provider]` 其實都已存在，純粹是前端沒有對應按鈕）。
**實作備註**：
- `src/services/imageProviders/gemini.ts`：`DEFAULT_MODEL` 改為現行的
  `gemini-2.5-flash-image`（即「Nano Banana」），免費額度為每分鐘 10 次、
  每天 250 次請求（依官方文件，2026-06 查證）。
- `src/app/app/generate/page.tsx`：新增 `editingKey`／`deletingKey` state。
  已儲存 Key 時改顯示「更換 API Key」與「清空 API Key」兩個按鈕，點「更換」
  才顯示輸入框（呼叫既有的 `POST /api/provider-keys`，後端本來就是
  upsert，會覆蓋舊 Key）；「清空」呼叫既有的 `DELETE
  /api/provider-keys/[provider]`。切換 provider 下拉選單時重置這兩個 state，
  避免殘留前一個 provider 的編輯狀態。

#### 6m. 各 provider 可自選／自訂模型 `[x]`
**背景**：各家 AI provider（尤其 Hugging Face、Gemini）的可用模型清單會隨時間
變動或下架，過去每次模型失效都要回來改程式碼裡的 `DEFAULT_MODEL` 常數再重新
部署。讓使用者可以直接在畫面上切換模型，不用每次都要改 code。
**實作備註**：
- `prisma/schema.prisma`：`ProviderApiKey` 新增可為空的 `model` 欄位
  （migration `20260629120000_add_provider_api_key_model`），儲存使用者對該
  provider 的模型覆寫；`null` 代表沿用 provider 程式碼內建的預設模型。
- 每個 provider（`openai.ts`／`huggingface.ts`／`gemini.ts`）的 `DEFAULT_MODEL`
  與新增的 `MODEL_OPTIONS`（精選模型清單）改為 `export`；`generate()` 改用
  `credentials.model || DEFAULT_MODEL`，由呼叫端決定要不要覆寫。Hugging Face
  的覆寫只影響文字生圖模型，img2img 用的 `timbrooks/instruct-pix2pix`
  仍維持固定，避免一次改動範圍過大。
- `src/services/imageProviders/types.ts`／`index.ts`：`ProviderDefinition`
  新增 `defaultModel`、`modelOptions`，讓 `/api/providers` 回傳的資料可以直接
  餵給前端下拉選單。
- `src/services/providerKeys.ts`：新增 `saveUserProviderModel`、
  `getUserProviderModel`、`listUserProviderModels`；`src/services/
  providerCredentials.ts` 在組裝 `credentials` 時，把使用者儲存的 `model`
  一併帶入（沒有設定就不帶，由 provider 自己 fallback 到預設值）。
- API：`GET /api/provider-keys` 回應多帶一個 `models` 欄位（provider →
  使用者設定的模型，沒設定則為 `null`）；新增 `PATCH
  /api/provider-keys/[provider]`，body `{ model: string | null }`，只更新模型
  欄位，不需要重新輸入 API Key（依賴使用者已存在的 key 那一筆 row，沒有 key
  時會回 400）。
- `src/app/app/generate/page.tsx`：已儲存 Key 的 provider 會多顯示一張卡片，
  下拉選單列出 `modelOptions`（標註哪個是預設）外加「自訂...」選項，選自訂時
  顯示文字輸入框可填任意模型 id；按「儲存模型設定」呼叫上述 `PATCH`
  endpoint。挑選邏輯（`useEffect` 依 `providerId`/`savedModels` 同步
  `modelSelect`/`customModelInput`）：已存的模型若在精選清單內就選那個選項，
  不在清單內（使用者自訂過）就自動切到「自訂...」並帶入該值，沒存過模型則
  顯示 provider 的預設模型。

#### 6n. 移除已停用的 Gemini 模型選項並自動 fallback `[x]`
**背景**：6m 上線時 `gemini.ts` 的 `MODEL_OPTIONS` 仍把已被 Google 下架的
`gemini-2.0-flash-preview-image-generation` 列為可選項目；使用者選到/存到這個
舊值之後，每次生成都會收到 `models/... is not found for API version v1beta`
錯誤，而且即使後來修正了 `DEFAULT_MODEL`，已經存在資料庫裡的舊覆寫值也不會
自動更新，導致同一個錯誤反覆出現。
**實作備註**：
- `src/services/imageProviders/gemini.ts`：`MODEL_OPTIONS` 移除
  `gemini-2.0-flash-preview-image-generation`，下拉選單只剩
  `gemini-2.5-flash-image`。
- 新增 `RETIRED_MODELS` 集合；`generate()` 在套用 `credentials.model` 之前先
  檢查是否為已知停用的模型 id，若是則自動改用 `DEFAULT_MODEL`，讓使用者過去
  存到舊值的覆寫設定不需要手動清除就能自動修正，往後其他模型被下架時也可以
  用同樣方式加進這個集合。

#### 6o. 圖片生成成功但雲端硬碟上傳失敗時，提供圖片預覽與下載 `[x]`
**背景**：圖片 provider 呼叫成功之後才會把結果上傳到使用者的 Google
Drive；若上傳那一步失敗（例如 access token 過期、Drive API 回應異常等），
`GenerationJob` 會被標記為 `failed`，畫面上只顯示錯誤訊息，使用者看不到也拿
不到其實已經生成成功的圖片，只能重新生成一次（可能因此多花一次 provider 額
度/費用）。另外，上傳失敗時的錯誤訊息出現過 `Unexpected token 'M',
"Malformed "... is not valid JSON`，代表 Drive API 在某些失敗情況下回應的是
純文字（例如 `Malformed multipart/related request`）而不是 JSON，程式對
`response.json()` 沒有防呆，直接讓 `JSON.parse` 例外蓋掉了真正有用的錯誤訊
息。
**實作備註**：
- `src/services/generationJobs.ts` 在上傳 Drive 失敗時已經有把 provider 回傳
  的 `result.url` 存到 `job.resultUrl`（即使 `status` 是 `failed`），這次只
  是把這個既有資料用在前端。
- `src/app/app/generate/page.tsx`：生成紀錄表格裡，`status === "failed"` 且
  `resultUrl` 存在時，除了顯示錯誤訊息，也會顯示圖片縮圖與一個帶
  `download` 屬性的超連結，讓使用者可以直接下載這張已生成但尚未存進 Drive
  的圖片。
- `src/services/googleDrive.ts`：新增 `parseJsonResponse()`，所有原本直接呼
  叫 `response.json()` 的地方都改用它——先讀取 `text()`，能解析成 JSON 才回
  傳物件，不能解析時拋出包含原始回應內容（截斷至 200 字）的可讀錯誤，而不是
  讓 `JSON.parse` 的 `SyntaxError` 蓋掉真正的失敗原因。

#### 6p. Gemini 新增 Nano Banana 2 / Pro 模型選項；生成紀錄圖片可點開放大 `[x]`
**背景**：使用者反饋免費的 `gemini-2.5-flash-image` 畫質比 OpenAI 差，詢問
Gemini 是否有更好的模型——Google 在 2026 上半年推出了
`gemini-3.1-flash-image-preview`（Nano Banana 2，4K、文字渲染更準）與
`gemini-3-pro-image-preview`（Nano Banana Pro，畫質最高），兩者都需要開通
Gemini API 帳號的付費功能才能使用（無免費額度）。另外，生成紀錄表格裡的圖
片縮圖目前無法點開看大圖，只能看 160px 的縮圖。
**實作備註**：
- `src/services/imageProviders/gemini.ts`：`MODEL_OPTIONS` 新增
  `gemini-3.1-flash-image-preview`、`gemini-3-pro-image-preview`，使用者開
  通付費後可以直接在「使用的模型」下拉選單切換，不需要改程式碼；
  `DEFAULT_MODEL` 仍維持 `gemini-2.5-flash-image`（唯一有免費額度的選項）。
- `src/app/app/generate/page.tsx`：生成紀錄表格的縮圖（成功或失敗但仍有
  `resultUrl` 兩種情況）改成包在 `<button>` 裡，點擊會開啟新增的
  `Lightbox` 元件——全螢幕半透明遮罩 + 置中顯示原圖，點遮罩或右上角 ✕ 按鈕
  或按 `Esc` 都會關閉。
- `src/app/globals.css`：新增 `.job-thumb-button`、`.lightbox-overlay`、
  `.lightbox-image`、`.lightbox-close` 樣式。

#### 6q. 更新 OpenAI 模型清單為 gpt-image-2 系列（DALL-E 已下架） `[x]`
**背景**：使用者反饋即使 Gemini 用了 Nano Banana Pro 畫質仍輸 OpenAI 一截，
詢問 OpenAI 目前實際有哪些 text-to-image／img2img 模型可用。查證後發現：(1)
DALL-E 2／3 已於 2026-05-12 從 OpenAI API 完全下架，舊的 `MODEL_OPTIONS`
裡列的 `dall-e-3`／`dall-e-2` 選了會直接 404，是死選項；(2) OpenAI 目前的
旗艦模型是 2026-04 發布的 `gpt-image-2`（prompt 遵從度與真實感最佳，主流評
測排名第一，略勝 Gemini 3 系列），其次是 `gpt-image-1.5`，較舊的
`gpt-image-1` 將於 2026-10-23 棄用，`gpt-image-1-mini` 為較便宜的輕量版；
四個模型都同時支援 `/v1/images/generations`（文字生圖）與
`/v1/images/edits`（參考圖片生圖）。
另外調查了其他家 AI 圖片模型的文字生圖／參考圖片生圖能力作為後續可能方向：
FLUX（Black Forest Labs，相片真實感方面評價很高）、Ideogram／Imagen 3（文
字渲染最準）、Recraft V3（設計／向量輸出）、Midjourney v7（美術風格最強但
無官方 API）。其中 FLUX 系列原本想透過現有的 Hugging Face provider 取用，
但 `huggingface.ts` 的程式碼註解已記錄 FLUX 只透過 fal-ai 的非同步
submit/poll/fetch 佇列 API 提供，與目前 hf-inference router 用的同步
request/response 協定不同，要支援需要新增一套完全不同的請求流程，屬於需要
另開一個 PR 評估的較大改動，這次先不做。
**實作備註**：
- `src/services/imageProviders/openai.ts`：`DEFAULT_MODEL` 改為
  `gpt-image-2`；`MODEL_OPTIONS` 改為 `["gpt-image-2", "gpt-image-1.5",
  "gpt-image-1", "gpt-image-1-mini"]`，移除已下架的 `dall-e-3`／`dall-e-2`。
  `generate()`／`generateFromReference()` 邏輯不變（兩個 endpoint 對四個
  gpt-image-* 模型都適用）。

---

#### 6r. 新增 fal.ai（FLUX）圖片生成 provider `[x]`
**背景**：延續 6q 的調查，使用者要求另開 PR 實作 FLUX（Black Forest Labs）
支援。FLUX 無法透過現有的 Hugging Face provider 取用：hf-inference router
只接受同步 request/response，FLUX 在 Hugging Face 上只透過 fal-ai 的非同步
submit/poll/fetch 佇列 API 提供。改直接整合 fal.ai 自己的 API：fal 同時提供
非同步佇列端點（`queue.fal.run`）與同步端點（`fal.run`，單次
POST/response 即可拿到結果，FLUX 在 1024x1024 通常數秒內完成），選用同步
端點以維持與現有 provider（`gemini.ts`／`openai.ts`）一致的簡單 fetch-await
風格，不需要引入額外的輪詢邏輯。
**實作備註**：
- 新增 `src/services/imageProviders/fal.ts`：`FalImageProvider implements
  ImageProvider`。`DEFAULT_MODEL = "fal-ai/flux/dev"`，`MODEL_OPTIONS =
  ["fal-ai/flux/dev", "fal-ai/flux/schnell", "fal-ai/flux-pro/v1.1-ultra"]`。
  文字生圖呼叫 `POST https://fal.run/{model}`，帶 `{ prompt }`；圖生圖固定
  呼叫 `fal-ai/flux/dev/image-to-image`（同 Hugging Face provider 的慣例，
  img2img 模型不開放使用者自選），帶 `{ prompt, image_url:
  "data:{mimeType};base64,{base64}" }`——fal 的 `image_url` 參數同時接受
  hosted URL 與 base64 data URI，確認可直接沿用既有 `ReferenceImage` 型別
  （只有 base64＋mimeType，沒有 hosted URL）。驗證 `apiKey` 缺失與
  API 錯誤回應（取 `detail`／`error` 欄位）。Auth 用
  `Authorization: Key {apiKey}` header。
- `src/services/imageProviders/index.ts`：註冊 `fal: new
  FalImageProvider()`，`PROVIDER_DEFINITIONS` 新增 `{ id: "fal", label:
  "fal.ai（FLUX，自備 API Key）", authMode: "byok", defaultModel:
  FAL_DEFAULT_MODEL, modelOptions: FAL_MODEL_OPTIONS }`。沿用既有的
  provider 抽象（`ImageProvider`／`ProviderDefinition` 介面不變），BYOK
  key 管理、加密儲存、模型下拉選單 UI 全部沿用既有機制，不需新增程式碼。
- 新增 `src/services/imageProviders/fal.test.ts`：涵蓋文字生圖、圖生圖（驗證
  data URI 組裝與呼叫 img2img 端點）、缺少 API Key、API 錯誤訊息、自訂模型
  覆寫，共 5 個測試 case。

---

#### 6s. 修正 Google Drive 上傳仍會出現「Malformed multipart body」 `[x]`
**背景**：6o 修了「Drive 回應非 JSON 導致 crash」這個症狀，但底層真正導致
Drive 拒絕請求的原因——手刻 `multipart/related` body 格式——一直沒解決，
改完只是讓使用者改看到一則可讀但仍然失敗的錯誤訊息：
`Drive upload failed: Drive API 回應非 JSON 格式（HTTP 400）：Malformed
multipart body.`。實測在使用付費 OpenAI/fal API 成功產圖後，Drive 上傳階段
仍會間歇性出現這個錯誤。逐位元組比對手刻的 boundary/CRLF 組裝邏輯本身其實
符合 RFC 2046 與 Google 官方範例的格式，但手刻 multipart 對任何細微格式落
差都很敏感、難以單元測試覆蓋到 Drive 端真實解析行為，屬於整類容易出錯且難
以驗證的實作方式。改用 Drive v3 的兩段式上傳（先用一般 JSON POST 建立檔案
metadata 拿到 `fileId`，再用 `PATCH .../upload/drive/v3/files/{fileId}
?uploadType=media` 直接帶原始位元組＋正確 `Content-Type` 上傳內容），完全
不需要手動組 multipart body，從根本上排除這整類格式錯誤。
**實作備註**：
- `src/services/googleDrive.ts` 的 `uploadImageToDrive`：移除
  `buildMultipartUploadBody` 的呼叫，改為兩個 `fetch`：(1) `POST
  https://www.googleapis.com/drive/v3/files?fields=id`，body 為
  `{ name, parents: [folderId] }` 的純 JSON，取得 `fileId`；(2) `PATCH
  https://www.googleapis.com/upload/drive/v3/files/{fileId}?uploadType=media&fields=id,webViewLink`，
  body 為原始 `fileBytes`，`Content-Type` 設為實際的圖片 mimeType。沿用既
  有的 `parseJsonResponse` 防禦性解析。
- `src/lib/driveUpload.ts`：移除已不再使用的 `buildMultipartUploadBody`／
  `DriveFileMetadata`／`MultipartUploadBody`，只保留 `buildGeneratedImageFileName`。
- `src/lib/driveUpload.test.ts`：移除對應的 multipart body 測試，只保留檔
  名產生的 2 個測試 case。
- `src/services/googleDrive.test.ts`：改為驗證兩段式流程依序呼叫（先建立
  metadata、再上傳內容），並涵蓋兩個步驟各自的錯誤情境，共 3 個測試 case。

---

#### 6t. 新增 ComfyUI（本機/自架）圖片生成 provider `[x]`
**背景**：雲端 provider（OpenAI／fal）按張計費，使用者想評估改用地端模型省
成本。LM Studio 只支援文字／多模態理解模型，不支援 text-to-image 的擴散模
型，不適用。評估 Automatic1111 與 ComfyUI 後，使用者選擇直接做 ComfyUI（彈
性高、新模型如 FLUX 支援快、效能優化較好）。ComfyUI 不是雲端 API，沒有「API
Key」這個概念，改把既有 BYOK 的 key 欄位挪用來存放使用者自己 ComfyUI 伺服器
的網址（例如 `http://192.168.1.50:8188`）——重要前提：本網站的伺服器必須能
連到這個網址才能生成圖片（同機、同網段，或透過 VPN／Tunnel 對外開放），這
點已在前端加上明顯提示文字。
**實作備註**：
- 新增 `src/services/imageProviders/comfyui.ts`：`ComfyUiImageProvider
  implements ImageProvider`。`credentials.apiKey` 當作 base URL 使用（去掉
  結尾斜線）；`credentials.model` 對應到 ComfyUI 工作流裡
  `CheckpointLoaderSimple` 節點的 `ckpt_name`，必須跟使用者
  `models/checkpoints` 資料夾裡的檔名完全一致，`MODEL_OPTIONS` 只是給下拉選
  單的幾個常見範例（`sd_xl_base_1.0.safetensors`／`flux1-dev.safetensors`／
  `sd_xl_turbo_1.0.safetensors`），自訂模型欄位可以填任何檔名。
- 流程：文字生圖直接組一個最小的 API 格式工作流 JSON（CheckpointLoader→
  EmptyLatentImage→兩個 CLIPTextEncode→KSampler→VAEDecode→SaveImage），圖生
  圖則先用 `FormData` POST 到 `/upload/image` 上傳參考圖片，拿到檔名後用
  `LoadImage`＋`VAEEncode` 節點取代 `EmptyLatentImage`、`denoise` 設為
  `0.75`。POST 工作流到 `/prompt` 拿到 `prompt_id`，輪詢
  `/history/{promptId}`（間隔 2 秒，最多 60 次／2 分鐘逾時）直到拿到輸出圖
  片的 `filename`/`subfolder`/`type`，再 GET `/view?...` 下載實際圖片位元
  組，轉成 `data:` base64 URL 回傳（與 OpenAI provider 的 `b64_json` 分支一
  致，後續 `uploadGeneratedImageToDrive` 的 `fetch(resultUrl)` 已驗證能處理
  這種格式）。
- `src/services/imageProviders/index.ts`：註冊 `comfyui: new
  ComfyUiImageProvider()`，`PROVIDER_DEFINITIONS` 新增 `{ id: "comfyui",
  label: "ComfyUI（本機/自架伺服器）", authMode: "byok", defaultModel:
  COMFYUI_DEFAULT_MODEL, modelOptions: COMFYUI_MODEL_OPTIONS }`。
- `src/app/app/generate/page.tsx`：當選中的 provider 是 `comfyui` 時，BYOK
  欄位的 label／placeholder／輸入框型態（改成 `text` 而非 `password`，因為
  是網址不是密鑰）都換成對應文字，並加上提示說明伺服器網路可達性的前提；模
  型欄位也加上提示說明這裡填的是 checkpoint 檔名。
- 新增 `src/services/imageProviders/comfyui.test.ts`：涵蓋文字生圖（驗證工
  作流節點內容）、圖生圖（驗證先上傳圖片、`LoadImage` 節點帶入上傳後的檔
  名）、缺少伺服器網址、提交工作流失敗、自訂模型覆寫，共 5 個測試 case。

---

#### 6u. 修正圖庫看不到任何已生成圖片 `[x]`
**背景**：使用者回報圖庫（`/app/app/images`）完全沒有顯示任何已生成的圖
片。追查後發現兩個獨立問題：
1. 歷史資料缺口：`createAndRunGenerationJob` 只有在
   `uploadGeneratedImageToDrive` 成功時才會建立 `Image` row；6s 修正前的
   multipart 上傳 bug 會讓「所有」上傳到 Drive 的請求失敗，所以在那之前產
   生的圖片從來沒有對應的 `Image` row。這屬於歷史資料缺口，無法在不重新
   下載原始 provider 暫存圖片網址的情況下回補（且那些網址多半早已失效），
   本次修正不處理回補，僅確保 6s 修正之後的新生成圖片能正常顯示。
2. 縮圖一直是空的：`Image.thumbnailUrl` 欄位存在於 schema，但
   `uploadGeneratedImageToDrive` 從未寫入過這個欄位，所以即使圖片成功建
   立，縮圖永遠是 `null`，前端的 `{image.thumbnailUrl && <img .../>}` 永遠
   不會渲染圖片。
**實作備註**：
- 評估過直接用 Drive 回傳的 `thumbnailLink` 當圖片網址，但使用者上傳的圖
  片在自己私有的 Drive 裡，`thumbnailLink` 通常只有在瀏覽器本身有登入同一
  個 Google 帳號的 session 時才能正確載入，不夠可靠。改用後端代理：新增
  `downloadDriveFile(accessToken, fileId)`（`src/services/googleDrive.ts`），
  以 `GET /drive/v3/files/{fileId}?alt=media` 搭配使用者自己的 access token
  下載原始圖片位元組與 `content-type`。
- `src/services/images.ts` 新增 `getImageContent(userId, id)`：先用
  `findFirst({ id, userId })` 確認所有權與 `driveFileId` 存在，再用使用者
  自己的 refresh token 換新 access token 後呼叫 `downloadDriveFile`。
- 新增 `GET /api/images/:id/content`（`src/app/api/images/[id]/content/route.ts`），
  驗證登入後回傳圖片位元組與正確的 `Content-Type`（`Cache-Control:
  private, max-age=3600`），找不到回 404，Drive 端錯誤回 502。
- 前端 `src/app/app/images/page.tsx`：`ImageItem` 改用 `driveFileId`
  （而非從未被寫入的 `thumbnailUrl`）判斷是否顯示縮圖，`<img>` 的 `src`
  改成 `/api/images/{id}/content`，一律透過後端代理載入，不再依賴 Drive
  的公開縮圖連結。
- `src/services/googleDrive.test.ts` 新增 `downloadDriveFile` 的成功／失敗
  測試 case（共 2 個）。

---

#### 6v. 圖庫加上相簿排版與詳細內容頁 `[x]`
**背景**：6u 修好縮圖之後，使用者發現圖庫只是一條直向列表，沒有相簿該有
的基本互動：格狀排版、點縮圖看大圖、看/編輯標題敘述標籤、下載原始檔。
**實作備註**：
- `src/app/app/images/page.tsx` 改成縮圖格狀排版（`.gallery-grid`，CSS
  grid `repeat(auto-fill, minmax(180px, 1fr))`，縮圖用 `aspect-ratio: 1/1`
  + `object-fit: cover` 裁切成正方形），每張縮圖用 `next/link` 包成連結，
  指到新的詳細內容頁 `/app/images/:id`；列表頁不再內嵌標籤編輯器（移到詳
  細內容頁）。
- 新增 `GET /api/images/:id`（`src/app/api/images/[id]/route.ts`）：回傳單
  張圖片完整欄位（沿用既有 `findFirst({ id, userId })` 所有權檢查，新增
  `services/images.ts` 的 `getImage(userId, id)`）。
- 新增詳細內容頁 `src/app/app/images/[id]/page.tsx`：
  - 大圖一律透過 6u 新增的 `/api/images/:id/content` 代理載入（不依賴
    Drive 公開連結）。
  - 下載按鈕：`<a href="/api/images/:id/content" download>`，直接下載原始
    檔；目前每張圖片只有上傳到 Drive 的單一檔案，沒有多種畫質可選，故只
    有一個下載按鈕（之後若要支援多畫質需要先改資料模型，不在本次範圍）。
  - 「在 Google Drive 開啟」連結（`driveViewUrl`，僅在存在時顯示）。
  - 標題/敘述編輯表單，沿用既有 `PATCH /api/images/:id`。
  - 標籤編輯器：把原本內嵌在列表頁的 `ImageTagEditor` 抽成共用元件
    `src/components/ImageTagEditor.tsx`，列表頁與詳細頁都能用。
- 新增 CSS：`.gallery-grid`／`.gallery-grid-item`／`.gallery-thumb-wrap`／
  `.detail-image-wrap`（`src/app/globals.css`）。

---

#### 6w. 生成等待中加上類 ChatGPT 的圖片佔位動畫 `[x]`
**背景**：生成圖片等待期間原本只有按鈕文字顯示已等待秒數，使用者希望有
更像 ChatGPT 生圖時那種「圖片正在畫出來」的視覺回饋，並在角落顯示一步步
推進的文字（雖然背後其實只是單一個 provider 請求，沒有真的分階段進度）。
**實作備註**：
- 新增 `src/components/GeneratingPlaceholder.tsx`：一個方形佔位區塊，背景
  用 CSS gradient + `background-position` 動畫做出來回掃動的 shimmer 效
  果（`prefers-reduced-motion: reduce` 時關閉動畫）。
- 左上角文字徽章依 `elapsedSeconds` 每 4 秒切換一句純裝飾性的步驟敘述
  （分析描述→規劃構圖→繪製草稿→渲染細節→調整色彩→最後修飾），右下角顯示
  已等待秒數；純前端視覺效果，不對應任何真實後端進度事件。
- `src/app/app/generate/page.tsx`：`submitting` 為真時，在原本的提示文字
  上方插入 `<GeneratingPlaceholder elapsedSeconds={elapsedSeconds} />`，沿
  用既有的 `elapsedSeconds` 計時器（`setInterval` 每秒 +1，提交時啟動）。
- 新增 CSS：`.generating-placeholder`／`.generating-placeholder-shimmer`／
  `.generating-placeholder-overlay`／`-step`／`-timer`（`src/app/globals.css`）。

---

#### 6x. 生成紀錄 Prompt 欄位改成 Modal 顯示全文，不再用內嵌展開 `[x]`
**背景**：生成紀錄表格的 Prompt 欄位原本用「展開／收合」內嵌切換完整文
字，但展開後那一列會被撐得很高，破壞整張表格的排版（其他列的高度、視覺
對齊都被打亂）。使用者要求保持「一行 + `...`」的截斷顯示，全文改用開窗
（modal）或 tooltip 呈現。
**權衡與選擇**：選 modal，理由：
1. Prompt 可能很長（套用 style preset + 多個自訂欄位後可以是好幾百字），
   tooltip 框很難做到可滾動、版面也容易被視窗邊緣裁切。
2. tooltip 只能 hover 觸發，手機等觸控裝置沒有 hover，等於完全用不了；
   modal 點擊（tap）就能開，跨裝置一致。
3. tooltip 內的文字通常無法選取/複製；modal 是一個獨立的容器，可以正常選
   字，這次也順手加了「複製」按鈕。
4. 專案裡已經有圖片 Lightbox 的 overlay／關閉按鈕／Esc 鍵關閉模式
   （`generate/page.tsx` 的 `Lightbox` 元件），新增的 `PromptModal` 沿用同
   一套互動模式與 CSS class（`.lightbox-overlay`、`.lightbox-close`），維
   持介面一致性，不是另外發明一套新的 UI 模式。
**實作備註**：
- `src/app/globals.css`：`.prompt-cell` 改成 `white-space: nowrap` +
  `text-overflow: ellipsis` 的單行截斷（移除原本 `-webkit-line-clamp` 兩行
  + `.expanded` 展開規則）；新增 `.prompt-modal`／`-header`／`-text`。
- `src/app/app/generate/page.tsx` 的 `GenerationJobsTable`：移除
  `expandedId` state 與「展開／收合」按鈕，改成「查看完整 Prompt」按鈕，
  點擊後用 `promptModalText` state 開啟 `PromptModal`；`PromptModal` 支援
  點擊遮罩、✕ 按鈕、Esc 鍵關閉，以及一個「複製」按鈕
  （`navigator.clipboard.writeText`，失敗時靜默忽略，例如非 HTTPS 情境下
  Clipboard API 不可用）。

---

#### 6y. 生成紀錄補存 model／完成時間，並可刪除紀錄（含確認視窗）`[x]`
**背景**：使用者要求生成紀錄多存、多顯示一些欄位（範例舉了 provider 和
model），並且要能刪除紀錄、刪除前要有確認視窗。
**欄位評估**：
- `provider`：`GenerationJob` 早就有這個欄位（建立時就寫入），只是表格沒
  顯示出來——這部分純粹是補顯示，不需要動 schema。
- `model`：目前完全沒有對應欄位。使用者選的模型只活在
  `resolveProviderCredentials` 回的 `credentials.model`（來自
  `getUserProviderModel`），傳進 `createAndRunGenerationJob` 之後就沒有被
  存到任何地方——新增 `GenerationJob.model String?`，建立 job 時直接寫入
  `credentials.model`。
- 額外補上 `completedAt DateTime?`：目前只有 `createdAt`，使用者完全看不
  出一個生成請求花了多久，也無法知道「失敗」是卡在 pending 很久還是馬上
  失敗。在 job 進入 `success`/`failed` 終態時順手寫入
  `completedAt = new Date()`，之後若要顯示耗時（`completedAt - createdAt`）
  有資料可用。這次先補欄位，UI 上暫不顯示耗時計算（非本次要求重點）。
- 沒有新增「是否使用參考圖」欄位：`params`（Json）已經足以回推，且目前
  UI 還沒有對應的篩選/顯示需求，先不過度設計。
**實作備註**：
- `prisma/schema.prisma`：`GenerationJob` 新增 `model String?`、
  `completedAt DateTime?`；新增 migration
  `20260630090000_add_generation_job_model_completed_at`。
- `src/services/generationJobs.ts`：
  - `createAndRunGenerationJob` 建立 job 時寫入 `model: credentials.model`；
    所有導致終態（`success`/`failed`，包含 Drive 上傳失敗、provider 未知、
    provider 呼叫例外）的 `update` 都補上 `completedAt: new Date()`。
  - 新增 `deleteGenerationJob(userId, id)`：先用
    `findFirst({ id, userId })` 驗證擁有權，找不到回傳 `null`，找到才執行
    `prisma.generationJob.delete`——沿用 `images.ts` 既有的擁有權驗證慣例。
    刪除紀錄不會連動刪除 Drive 上已上傳的圖片本體。
- `src/app/api/generation-jobs/[id]/route.ts`（新檔）：新增
  `DELETE /api/generation-jobs/:id`，未登入回 401，找不到（或不是自己的）
  回 404，成功回 `{ ok: true }`。
- `src/app/app/generate/page.tsx` 的 `GenerationJobsTable`：
  - 新增「Provider / Model」欄（顯示 `job.provider`，`job.model` 存在才
    額外顯示一行）。
  - 新增「操作」欄的「刪除」按鈕，點擊開啟 `DeleteConfirmModal`（沿用
    `PromptModal`/`Lightbox` 既有的 `.lightbox-overlay` 互動模式：點遮罩、
    ✕ 按鈕、Esc 鍵都可取消），內文顯示該筆 Prompt 並提示「此操作無法復
    原，圖片本身不會被刪除，僅刪除這筆紀錄」，使用者必須按「確認刪除」
    才會真的呼叫 `DELETE /api/generation-jobs/:id`，成功後重新整理列表
    （`loadJobs`）。
  - 順手把「清空 API Key」也補上同樣的確認視窗（原本是按一下就直接打
    `DELETE /api/provider-keys/:id`，沒有任何確認）：新增共用的
    `ConfirmModal` 元件（標題／訊息／確認按鈕文字可自訂，互動模式同樣是
    點遮罩／✕／Esc 取消），「清空 API Key」按鈕改成先開
    `ConfirmModal`，確認後才真的呼叫刪除。
- **RWD 修正**：新增 Provider/Model 欄位後，`.jobs-table` 的自然內容寬度
  （縮圖 + Prompt 截斷寬度 + 多出的兩欄）超過 `main` 的 `max-width: 720px`，
  而 `<table>` 不會主動縮小到比內容更窄，於是把整個版面撐寬、破壞 RWD。
  第一版先用 `.jobs-table-wrap`（`overflow-x: auto`）讓表格局部水平滾
  動，但使用者回饋希望「不要有捲軸，直接顯示所有內容」。改成
  `table-layout: fixed` + 各欄固定百分比寬度（狀態12% / Provider·Model
  16% / Prompt 28% / 結果 22% / 時間 14% / 操作 8%，總和 100%），讓表格
  永遠不超過容器寬度；各欄內容（model 名稱、錯誤訊息）改用
  `word-break: break-word` 在欄寬內換行，而不是被裁掉或撐開欄寬；時間
  欄也拆成日期/時間兩行（`toLocaleDateString` + `toLocaleTimeString`）
  縮短單行寬度。
- **操作欄簡化**：「刪除」文字按鈕改成單一垃圾桶 emoji（🗑️）的
  `.icon-button`，搭配 `aria-label`/`title` 保留可存取性與滑鼠提示，視
  覺上更精簡、也讓本來就窄的「操作」欄（8% 寬）不會擠不下文字。

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

#### 8b. 標籤系統 UI（自動建議、新增/移除互動） `[x]`
**實作備註**：
- `src/app/app/images/page.tsx`：圖庫列表頁，掛載時並行呼叫 `GET /api/images`
  與 `GET /api/tags`（後者用於跨圖片的標籤自動建議來源）。
- 每張圖片渲染一個 `ImageTagEditor` 子元件：掛載時呼叫
  `GET /api/images/:id/tags` 載入該圖片已有標籤；輸入框用 `<datalist>`
  根據使用者輸入字串即時過濾 `GET /api/tags` 回傳的全部標籤（排除已加在
  該圖片上的）作為自動建議；送出呼叫 `POST /api/images/:id/tags`
  （標籤不存在會自動建立，沿用既有 service 行為）；每個已加標籤旁的
  「移除」按鈕呼叫 `DELETE /api/images/:id/tags/:tagId`。

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

#### 11. AI 語意搜尋 `[x]`
**背景**：關鍵字搜尋無法理解語意相近但用詞不同的查詢。
**實作備註**：
- Prisma schema 啟用 `postgresqlExtensions` preview feature 與
  `extensions = [vector]`，`Image` model 新增
  `embedding Unsupported("vector(1536)")?` 欄位；migration 執行
  `CREATE EXTENSION IF NOT EXISTS vector;` 再新增欄位。`Unsupported` 型別無法
  透過一般 Prisma Client API 讀寫，故相關查詢/寫入皆用 `$queryRaw`/`$executeRaw`
  + `Prisma.sql` 參數化。
- CI 的 postgres service image 從 `postgres:16` 換成 `pgvector/pgvector:pg16`，
  否則 `CREATE EXTENSION vector` 在 CI 會失敗。
- `lib/embedding.ts`：`buildEmbeddingInputText({title, description, aiCaption})`
  （合併非空欄位成一段文字）、`toPgVectorLiteral(values)`（數字陣列轉
  pgvector literal 字串 `[0.1,0.2,...]`），純函式，6 個測試 case。
- `services/embeddings.ts`：`generateEmbedding(text)` 呼叫 OpenAI Embeddings API
  （`text-embedding-3-small`），回傳 1536 維向量。
- `services/imageEmbeddings.ts`：`generateAndStoreImageEmbedding(imageId)`，
  best-effort（與 AI 辨識一致：失敗不拋例外，不影響呼叫端），用
  `$executeRaw` 寫入 `embedding` 欄位；沒有可用文字（title/description/aiCaption
  皆空）時直接跳過。
- 串接在 `services/imageRecognition.ts`：AI 辨識成功寫入 `aiCaption` 後接著呼叫
  `generateAndStoreImageEmbedding`，讓 embedding 反映最新的 caption。
- `services/imageSemanticSearch.ts`：`semanticSearchImages(userId, query)`，
  將查詢字串轉 embedding 後用 `Prisma.sql` 執行
  `ORDER BY embedding <=> ${literal}::vector LIMIT 20`（cosine distance），
  排除尚未產生 embedding 的圖片；範圍限定在 `userId`。
- API：`GET /api/images/semantic-search?q=描述文字`，沿用 `validateSearchQuery`
  做輸入驗證，僅回傳該使用者自己的圖片。

---

## 技術債與基礎強化

- 測試覆蓋率：API route 與 utils 純函式單元測試、關鍵流程 e2e 測試。
- 錯誤處理：Drive 上傳失敗重試機制、AI provider 逾時/額度錯誤的使用者提示。
- 效能：圖片列表分頁、縮圖快取策略待評估（是否需要 CDN）。
- 安全：Drive OAuth token 加密儲存 `[x]`、API rate limiting `[x]`。

### Drive OAuth refresh token 加密儲存 `[x]`
**背景**：`User.driveRefreshToken` 原本以明碼存在 DB，一旦資料庫洩漏即可直接
冒用使用者的 Google Drive 存取權限，需要加密儲存。
**實作備註**：
- `src/lib/tokenCrypto.ts`：`encryptToken`/`decryptToken`，用 Node 內建
  `crypto` 的 AES-256-GCM，金鑰來自環境變數 `DRIVE_TOKEN_ENCRYPTION_KEY`
  （32 bytes、base64 編碼）。儲存格式為 `iv:authTag:ciphertext`（皆 base64），
  存成單一字串欄位。每次加密用隨機 iv，相同明碼每次產生不同 ciphertext；
  auth tag 驗證失敗（如被竄改）會拋例外。6 個測試 case（正常加解密、隨機性、
  缺金鑰、金鑰長度錯誤、格式錯誤、ciphertext 被竄改）。
- `src/services/auth.ts` 的 `signIn` callback：取得 Google 回傳的
  refresh token 後先 `encryptToken` 再寫入 `User.driveRefreshToken`。
- `src/services/images.ts` 的 `uploadGeneratedImageToDrive`：讀出
  `user.driveRefreshToken` 後先 `decryptToken` 再用於換取 access token。
- `.env.example` 新增 `DRIVE_TOKEN_ENCRYPTION_KEY`（用
  `openssl rand -base64 32` 產生）。
- 未涵蓋既有明碼資料的遷移：此專案尚未有正式上線資料，故沒有為已存在的
  明碼 token 寫資料轉換 migration；若日後資料庫已有明碼 token，需額外寫一次性
  腳本將其加密後覆寫。

### API rate limiting `[x]`
**背景**：產圖與語意搜尋會呼叫付費的 AI provider API（OpenAI image/embedding），
沒有限流的話單一帳號或被盜用的 session 可能短時間內打爆額度或產生高額費用。
**實作備註**：
- `src/lib/rateLimit.ts`：`checkRateLimit(store, key, limit, windowMs, now)`
  純函式（固定窗口計數器，操作傳入的 `Map`），與 `consumeRateLimit(key, limit,
  windowMs)`（操作 module-level 的共用 `Map` singleton，供 route handler 使用）。
  4 個測試 case（正常累計、超過限制拒絕、超過窗口後重新計數、不同 key 互不影響）。
- 套用在兩個會呼叫付費 AI API 的端點：`POST /api/generation-jobs`
  （每位使用者每分鐘 10 次）、`GET /api/images/semantic-search`
  （每位使用者每分鐘 20 次）；key 用 `${route}:${userId}`，超過限制回傳
  `429`，並帶 `Retry-After` header（秒數）。
- 已知限制：狀態存在記憶體中，Vercel serverless 多執行個體環境下each instance
  各自計數，等同於有效限制會隨並發的 instance 數量放大；目前流量規模可接受，
  若日後流量變大或需要更嚴格保證，需改為共用儲存（如 Redis）。

## 優先開發路徑建議

`P0(1→2) → P1(3→4→5→6) → P2(7→8→9) → P3(10→11)`

P0、P1 為核心，必須先完成才有可用產品；P2 圖庫管理可分批完成；
P3 搜尋功能依賴 P2 的資料（caption/tags）才有意義，故排在最後。

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

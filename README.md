# Image Magic

用 prompt + 動態表單建立 AI 圖片生成請求，以 Google 帳號登入，圖片存到使用者
自己的 Google Drive，並提供標籤、AI 辨識、關鍵字與語意搜尋的圖庫管理功能。

詳細功能規格與開發順序見 [`SPEC.md`](./SPEC.md)；開發規範見 [`AGENTS.md`](./AGENTS.md)。

## 技術棧

- Next.js 14（App Router）+ TypeScript
- NextAuth.js（Google OAuth + Drive `drive.file` scope）
- PostgreSQL + Prisma ORM（預計引入 `pgvector` 支援語意搜尋）
- Google Drive API（圖片儲存於使用者自己的 Drive）

## 開始開發

```bash
cp .env.example .env   # 填入 DATABASE_URL、GOOGLE_CLIENT_ID/SECRET 等
npm install
npx prisma migrate dev
npm run dev
```

### Google 登入設定

1. 到 [Google Cloud Console](https://console.cloud.google.com/) 建立 OAuth 2.0
   Client ID（類型：Web application）。
2. Authorized redirect URI 填入 `http://localhost:3000/api/auth/callback/google`。
3. 啟用 Google Drive API，並在 OAuth consent screen 加入
   `https://www.googleapis.com/auth/drive.file` scope。
4. 將 Client ID / Secret 填入 `.env` 的 `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`，
   並設定 `NEXTAUTH_SECRET`（可用 `openssl rand -base64 32` 產生）。
5. 登入後 `/app/*` 路由才可存取（見 `src/middleware.ts`）。

## 常用指令

```bash
npm run dev      # 本地開發
npm test         # 單元測試（Vitest）
npm run lint     # ESLint
npm run build    # production build
```

## CI/CD

GitHub Actions（`.github/workflows/ci.yml`）兩個 job：

1. **`test-and-build`**：每次 PR 與 push 到 `main` 都會執行。啟動一個
   `pgvector/pgvector:pg16` service container，依序執行
   lint → prisma migrate deploy（含 `npm ci` 的 `postinstall` 已先跑過
   `prisma generate`）→ 單元測試 → build。
2. **`deploy-production`**：只在 push 到 `main` 且上一個 job 成功後執行，會：
   - 用 `PROD_DATABASE_URL` 對生產資料庫跑 `prisma migrate deploy`。
   - 用 Vercel CLI（`vercel pull` → `vercel build --prod` →
     `vercel deploy --prebuilt --prod`）部署到 Vercel production。

### 部署到 Vercel 需要的設定

**GitHub repo secrets**（Settings → Secrets and variables → Actions）：

| Secret | 說明 |
|---|---|
| `VERCEL_TOKEN` | Vercel 帳號的 Personal Access Token |
| `VERCEL_ORG_ID` | 在 Vercel 專案目錄執行 `vercel link` 後，`.vercel/project.json` 裡的 `orgId` |
| `VERCEL_PROJECT_ID` | 同上的 `projectId` |
| `PROD_DATABASE_URL` | 生產環境 PostgreSQL 連線字串，**資料庫需啟用 `pgvector` extension**（例如 Neon、Supabase 或自架 `pgvector/pgvector` 都支援） |

**Vercel 專案的環境變數**（Vercel Dashboard → Project → Settings →
Environment Variables，設定在 `Production` 環境）：
`DATABASE_URL`、`GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`、`NEXTAUTH_URL`
（正式網域）、`NEXTAUTH_SECRET`、`AI_IMAGE_PROVIDER_API_KEY`，內容與
`.env.example` 對應。

設定好以上 secrets 與環境變數後，PR 合併進 `main` 即會自動跑完整 CI，
通過後自動部署到 Vercel production，不需要手動操作。

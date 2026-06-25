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

## 常用指令

```bash
npm run dev      # 本地開發
npm test         # 單元測試（Vitest）
npm run lint     # ESLint
npm run build    # production build
```

## CI/CD

GitHub Actions（`.github/workflows/ci.yml`）在每次 PR 與 push 到 `main` 時，
會啟動一個 PostgreSQL service container，執行 lint → prisma generate →
prisma migrate deploy → 單元測試 → build。

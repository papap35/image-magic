export default function HomePage() {
  return (
    <main>
      <h1>Image Magic</h1>
      <p>用 AI 生成圖片，記錄在你自己的 Google 帳號與 Drive 裡。</p>
      <div className="button-row">
        <a href="/api/auth/signin?callbackUrl=/app">
          <button type="button">使用 Google 帳號登入</button>
        </a>
      </div>
    </main>
  );
}

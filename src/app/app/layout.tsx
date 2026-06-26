import type { ReactNode } from "react";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <nav className="app-nav app-nav-persistent">
        <a href="/app">首頁</a>
        <a href="/app/generate">產生圖片</a>
        <a href="/app/images">圖庫</a>
        <a href="/app/style-presets">風格指令</a>
      </nav>
      {children}
    </>
  );
}

import type { ReactNode } from "react";

export const metadata = {
  title: "Image Magic",
  description: "AI 圖片生成與圖庫管理系統",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}

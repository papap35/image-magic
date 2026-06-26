import type { ReactNode } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/services/auth";
import { Header } from "@/components/Header";
import "./globals.css";

export const metadata = {
  title: "Image Magic",
  description: "AI 圖片生成與圖庫管理系統",
};

// Runs before hydration so the page never flashes the wrong theme: prefers a
// saved choice, otherwise falls back to the OS-level color scheme.
const THEME_BOOTSTRAP_SCRIPT = `
(function () {
  try {
    var saved = window.localStorage.getItem("theme");
    var theme = saved === "dark" || saved === "light"
      ? saved
      : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.dataset.theme = theme;
  } catch (e) {}
})();
`;

export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);
  const user = session?.user
    ? { name: session.user.name ?? null, email: session.user.email ?? null, image: session.user.image ?? null }
    : null;

  return (
    <html lang="zh-Hant">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body>
        <Header user={user} />
        {children}
      </body>
    </html>
  );
}

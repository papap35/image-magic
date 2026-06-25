import { getServerSession } from "next-auth";
import { authOptions } from "@/services/auth";

export default async function AppHomePage() {
  const session = await getServerSession(authOptions);

  return (
    <main>
      <h1>Image Magic</h1>
      <p>登入身分：{session?.user?.name ?? "未知使用者"}</p>
      <nav className="app-nav">
        <a href="/app/generate">產生圖片</a>
        <a href="/app/images">圖庫</a>
        <a href="/app/style-presets">風格指令</a>
      </nav>
    </main>
  );
}

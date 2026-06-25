import { getServerSession } from "next-auth";
import { authOptions } from "@/services/auth";

export default async function AppHomePage() {
  const session = await getServerSession(authOptions);

  return (
    <main>
      <h1>我的圖庫</h1>
      <p>登入身分：{session?.user?.name ?? "未知使用者"}</p>
    </main>
  );
}

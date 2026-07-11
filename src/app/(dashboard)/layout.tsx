import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";

// Không có header chrome riêng — điều hướng nằm trong từng màn (avatar, back)
// theo mockup Phase 1 Screens; đăng xuất đặt ở màn Cài đặt (/settings).
export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  if (!session?.user) redirect(ROUTES.signIn);

  return <main className="flex min-h-full flex-1 flex-col">{children}</main>;
}

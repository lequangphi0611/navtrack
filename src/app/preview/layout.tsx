// Bề mặt preview component — DEV-ONLY (xem docs/rules/component-architecture.md
// mục "Bề mặt preview"). Việc chặn production nằm ở proxy.ts: nó trả 404 cho
// mọi `/preview` khi production, TRƯỚC khi page render — nên page không chạy,
// không sinh payload RSC để lộ markup. Guard bằng `notFound()` trong page/layout
// KHÔNG đủ (Next vẫn nhúng nội dung page đã render vào body 404).
//
// `force-dynamic` để không prerender tĩnh lúc build (khỏi sinh file HTML chứa
// sample markup trong output build); route chỉ render động khi có request, mà
// proxy đã chặn ở production.
//
// Vì chỉ đi qua root layout (không chạm auth/DB), route này render chỉ với
// `pnpm dev` — không cần Postgres/Docker.
export const dynamic = "force-dynamic";

export default function PreviewLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-full bg-background p-4 text-foreground">
      {children}
    </div>
  );
}

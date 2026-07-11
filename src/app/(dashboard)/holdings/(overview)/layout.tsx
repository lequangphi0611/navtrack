import { HoldingsEmptyState } from "@/features/holdings/components/HoldingsEmptyState";
import { HoldingsOverviewScreen } from "@/features/holdings/components/HoldingsOverviewScreen";
import { hasAnyHolding } from "@/features/holdings/queries";
import { getSession } from "@/lib/auth";

// Dùng chung cho /holdings (đang mở) + /holdings/closed (đã đóng) — route group
// (overview) không lộ ra URL, chỉ để opt 2 route con vào layout này mà không ảnh
// hưởng /holdings/[id], /holdings/new (nằm ngoài group).
// Đây là query duy nhất quyết định toàn bộ layout (trống ↔ có dữ liệu) nên page con
// không cần lặp lại; page con tự lo Suspense/skeleton cho vùng danh sách của nó.
export default async function HoldingsOverviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const displayName = session?.user?.name ?? session?.user?.email ?? "bạn";

  if (!(await hasAnyHolding())) {
    return <HoldingsEmptyState displayName={displayName} />;
  }

  return (
    <HoldingsOverviewScreen displayName={displayName}>
      {children}
    </HoldingsOverviewScreen>
  );
}

import { DashboardScreenClient } from "@/features/dashboard/components/DashboardScreen";
import { createManualSnapshot } from "@/features/snapshots/actions";
import {
  getManualSnapshotToday,
  getNavTrend,
} from "@/features/snapshots/queries";
import { getHideAmountsByDefault } from "@/features/settings/queries";
import { getSession } from "@/lib/auth";
import { getCutoffSelection } from "@/lib/cutoff-cookie";
import { getPortfolioValuation } from "@/lib/portfolio-valuation";

// Container (Server Component): vùng data chính của Dashboard (mockup 2a/2f) — mọi thứ
// DashboardScreen render (header/avatar, NAV hero, PnL, allocation, SnapshotTodayCard,
// biểu đồ NAV...). Tách khỏi DashboardQuickMenuSection (FAB, fixed-position) để 2 vùng
// stream độc lập (component-architecture.md checklist #2).
//
// GHI CHÚ KIẾN TRÚC (mục 9/11 phase-6.md): getNavTrend() KHÔNG được tách Suspense
// riêng — toàn bộ DashboardScreen nằm sau DashboardScreenClient (client wrapper giữ
// state `hidden` cho nút mắt header, mục 11). Nếu NavTrendChartSection tách Suspense
// riêng, nội dung của nó sẽ là 1 subtree Server Component ĐÃ RENDER XONG truyền vào
// qua `children`/props JSX — subtree đó "đông cứng" tại giá trị `hidden` lúc stream,
// KHÔNG re-render khi user bấm nút mắt.
//
// 2 batch Promise.all thay vì 1 (khác bản trước): getNavTrend() cần navValue ĐÃ TÍNH
// của `valuation` (cùng cutoff selection với hero card, xem comment getNavTrend) nên
// PHẢI đợi batch đầu xong — nhưng bên trong mỗi batch vẫn chạy song song, không await
// tuần tự (checklist #2). Batch 2 giờ chỉ còn query Snapshot rẻ (không re-chạy cả
// pipeline valuation 3 lần như trước, code review #6).
async function PortfolioOverviewSection() {
  const selection = await getCutoffSelection();
  const [session, valuation, snapshotToday, hideAmountsByDefault] =
    await Promise.all([
      getSession(),
      getPortfolioValuation(selection),
      getManualSnapshotToday(),
      getHideAmountsByDefault(),
    ]);

  // 3 lời gọi này PHẢI đợi `valuation` xong trước (dùng lại navValue của nó
  // cho điểm "hôm nay" — xem comment getNavTrend, code review #2/#6), nhưng
  // vẫn chạy song song VỚI NHAU thay vì tuần tự.
  const [navMonth, navYear, navAll] = await Promise.all([
    getNavTrend("MONTH", valuation.navValue),
    getNavTrend("YEAR", valuation.navValue),
    getNavTrend("ALL", valuation.navValue),
  ]);

  return (
    <DashboardScreenClient
      displayName={session?.user?.name ?? ""}
      {...valuation}
      initialHidden={hideAmountsByDefault}
      snapshotToday={{
        alreadySnapshotToday: snapshotToday !== null,
        snapshotTakenAt: snapshotToday?.takenAt,
        action: createManualSnapshot,
      }}
      navTrend={{ MONTH: navMonth, YEAR: navYear, ALL: navAll }}
    />
  );
}

export { PortfolioOverviewSection };

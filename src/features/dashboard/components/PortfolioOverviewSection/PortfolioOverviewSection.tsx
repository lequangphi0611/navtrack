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
// riêng dù về nguyên tắc đây là 1 query độc lập với getPortfolioValuation() — lý do:
// toàn bộ DashboardScreen giờ nằm sau DashboardScreenClient (client wrapper giữ state
// `hidden` cho nút mắt header, mục 11). Nếu NavTrendChartSection tách Suspense riêng,
// nội dung của nó sẽ là 1 subtree Server Component ĐÃ RENDER XONG truyền vào qua
// `children`/props JSX — subtree đó "đông cứng" tại giá trị `hidden` lúc stream, KHÔNG
// re-render khi user bấm nút mắt (React chỉ re-render Client Component khi state đổi,
// không re-execute Server Component con đã render sẵn). Gộp cả 4 query vào 1
// Promise.all vẫn giữ đúng tinh thần "không await tuần tự" (checklist #2 quan tâm hiệu
// năng, không bắt buộc tách Suspense bằng mọi giá) — cái giá đánh đổi là NAV chart chờ
// cùng lúc với valuation thay vì stream sớm hơn, chấp nhận được vì cùng là Snapshot/NAV
// data, chi phí truy vấn nhỏ.
async function PortfolioOverviewSection() {
  const selection = await getCutoffSelection();
  const [
    session,
    valuation,
    snapshotToday,
    hideAmountsByDefault,
    navMonth,
    navYear,
    navAll,
  ] = await Promise.all([
    getSession(),
    getPortfolioValuation(selection),
    getManualSnapshotToday(),
    getHideAmountsByDefault(),
    getNavTrend("MONTH"),
    getNavTrend("YEAR"),
    getNavTrend("ALL"),
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

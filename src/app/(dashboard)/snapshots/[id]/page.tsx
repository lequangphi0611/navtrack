import { SnapshotDetailScreen } from "@/features/snapshots/components/SnapshotDetailScreen";
import { ROUTES } from "@/lib/routes";

type SnapshotDetailPageProps = {
  params: Promise<{ id: string }>;
};

// Demo-only: id này hiển thị biến thể 3f (giá đã đổi từ khi chốt); mọi id khác
// rơi về biến thể 3c (giá EOD chưa đổi) — cùng 1 snapshot thật chỉ khác ở việc
// so sánh giá hiện tại với giá lúc chốt có lệch hay không (business-implementer
// quyết định phía server, không phải 2 loại snapshot khác nhau).
const REPRICED_DEMO_ID = "snap-2026-06-repriced";

// TODO(business-implementer): thay bằng getSnapshotDetail(id) thật — so sánh
// giá EOD tại cutoffDate với giá hiện tại để quyết định có `recomputedComparison`
// hay không (xem process/UI_phase_3.md).
export default async function SnapshotDetailPage({
  params,
}: SnapshotDetailPageProps) {
  const { id } = await params;
  const showRecomputed = id === REPRICED_DEMO_ID;

  return (
    <SnapshotDetailScreen
      title="Snapshot 30/06/2026"
      subtitle={
        showRecomputed ? "Giá đã đổi từ khi chốt" : "Cuối tháng · toàn danh mục"
      }
      backHref={ROUTES.snapshots}
      navValue="3681204000"
      meta={{
        sourceLabel: "AUTO",
        periodLabel: "PERIODIC",
        cutoffDateLabel: "30/06/2026",
        recordedAtLabel: "01/07 00:15",
      }}
      holdings={[
        {
          id: "fpt",
          symbol: "FPT",
          name: "FPT Corp",
          assetType: "STOCK",
          value: "742000000",
        },
        {
          id: "hpg",
          symbol: "HPG",
          name: "Hòa Phát",
          assetType: "STOCK",
          value: "445500000",
        },
        {
          id: "dcds",
          symbol: "DCDS",
          name: "Quỹ DCDS",
          assetType: "FUND",
          value: "490050000",
        },
        {
          id: "tcb",
          symbol: "TCB",
          name: "TCB 2028",
          assetType: "BOND",
          value: "310000000",
        },
        {
          id: "sjc",
          symbol: "SJC",
          name: "Vàng SJC",
          assetType: "GOLD",
          value: "347400000",
        },
      ]}
      recomputedComparison={
        showRecomputed
          ? {
              recomputedValue: "3702840000",
              deltaAmount: "21640000",
              deltaNote: "nếu dùng giá 11/07",
            }
          : undefined
      }
    />
  );
}

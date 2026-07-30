import { HoldingDetailScreen } from "@/features/holdings/components/HoldingDetailScreen";
import {
  getBondHoldingActions,
  getHoldingDetail,
  getJustRecordedBanner,
} from "@/features/holdings/queries";

type HoldingDetailPageProps = {
  params: Promise<{ id: string }>;
  // ?cashflowId=<id> — cờ "vừa ghi giao dịch xong" (lib/routes.ts::holdingDetailAfterTransaction),
  // không dùng cookie. Không tin thẳng query string — getJustRecordedBanner() tự verify
  // cashflowId thuộc đúng holding.cashflows đã fetch trước khi dựng banner.
  searchParams: Promise<{ cashflowId?: string }>;
};

export default async function HoldingDetailPage({
  params,
  searchParams,
}: HoldingDetailPageProps) {
  const { id } = await params;
  const { cashflowId } = await searchParams;
  const holding = await getHoldingDetail(id);
  // Phụ thuộc kết quả getHoldingDetail (cần holding.cashflows) — không phải 2 query độc
  // lập, await tuần tự là đúng (khác checklist "≥2 query độc lập -> Promise.all").
  const justRecorded = cashflowId
    ? await getJustRecordedBanner(holding, cashflowId)
    : undefined;

  // Phase 7 — hàng thao tác điều khoản/tất toán + cảnh báo quá đáo hạn. Trả
  // null cho mọi loại tài sản khác BOND, khi đó màn hình không hiện gì thêm.
  const bond = await getBondHoldingActions(id);

  return (
    <HoldingDetailScreen
      holding={holding}
      cashflows={holding.cashflows}
      valuation={holding.valuation}
      justRecorded={justRecorded}
      {...(bond ? { bond } : {})}
    />
  );
}

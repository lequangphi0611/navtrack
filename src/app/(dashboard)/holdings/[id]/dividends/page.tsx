import { DividendHistoryScreen } from "@/features/dividends/components/DividendHistoryScreen";
import { getDividendHistory } from "@/features/dividends/queries";
import { ROUTES } from "@/lib/routes";

type DividendHistoryPageProps = {
  params: Promise<{ id: string }>;
};

// Lịch sử cổ tức của MỘT Holding (mockup Phase 4 Screens, 4e) — entry từ
// HoldingDetailScreen ("Lịch sử cổ tức") hoặc icon history trong DividendForm.
// getDividendHistory() tự verify holding.userId === session và gọi notFound()
// khi không khớp — page không cần kiểm tra lại.
export default async function DividendHistoryPage({
  params,
}: DividendHistoryPageProps) {
  const { id } = await params;
  const { holding, summary, rows } = await getDividendHistory(id);

  return (
    <DividendHistoryScreen
      backHref={ROUTES.holdingDetail(id)}
      holding={holding}
      summary={summary}
      rows={rows}
      newDividendHref={ROUTES.newDividend(id)}
    />
  );
}

import { PageHeader } from "@/components/PageHeader";
import { NewHoldingForm } from "@/features/holdings/components/NewHoldingForm";
import { getNewPurchaseFeeSettingRows } from "@/features/holdings/queries";
import { isAssetType } from "@/features/holdings/schemas";
import { ROUTES } from "@/lib/routes";

type NewHoldingPageProps = {
  // Lối vào từ /nav-chart (CTA "+ Thêm vị thế {Loại}" ở trạng thái rỗng, issue
  // #141) truyền `?type=BOND` — form đích tự pre-select loại. `searchParams` là
  // Promise ở Next.js 16 (App Router) — xem precedent sign-in/page.tsx.
  searchParams: Promise<{ type?: string }>;
};

export default async function NewHoldingPage({
  searchParams,
}: NewHoldingPageProps) {
  const { type } = await searchParams;
  // isAssetType() — "không tin client" (CLAUDE.md): query string sửa được qua
  // URL bar, không mặc nhiên tin `type` khớp AssetType.
  const initialType = isAssetType(type) ? type : undefined;

  // Phí mua thật cho card "Phí giao dịch" ở nhánh "Vừa mua hôm nay" (issue
  // #142) — cả 4 AssetType trong một query, xem getNewPurchaseFeeSettingRows().
  const feeSettingRowsByType = await getNewPurchaseFeeSettingRows();

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4.5 p-5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
      <PageHeader title="Vị thế mới" backHref={ROUTES.holdings} />
      <NewHoldingForm
        initialType={initialType}
        feeSettingRowsByType={feeSettingRowsByType}
      />
    </div>
  );
}

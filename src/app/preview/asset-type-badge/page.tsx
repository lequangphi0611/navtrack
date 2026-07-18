import { AssetTypeBadge, type AssetType } from "@/components/AssetTypeBadge";

// Preview mẫu — import component THẬT + sample props (KHÔNG copy markup của
// component). Template cho các preview page khác: một page mỏng, dữ liệu mẫu
// hardcode, render đủ các biến thể để soi. Dev-only nhờ proxy.ts chặn `/preview`
// ở production (xem ../layout.tsx) — không cần guard runtime trong page.
const ASSET_TYPES: AssetType[] = ["STOCK", "FUND", "BOND", "GOLD"];

export default function AssetTypeBadgePreview() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {ASSET_TYPES.map((assetType) => (
        <AssetTypeBadge key={assetType} assetType={assetType} />
      ))}
    </div>
  );
}

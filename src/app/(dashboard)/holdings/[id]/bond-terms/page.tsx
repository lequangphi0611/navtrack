import { BondTermsForm } from "@/features/holdings/components/BondTermsForm";
import { getBondTermsFormData } from "@/features/holdings/queries";
import { ROUTES } from "@/lib/routes";

type BondTermsPageProps = {
  params: Promise<{ id: string }>;
};

// Nhập/sửa điều khoản trái phiếu (mockup Phase 7 Screens 7a). Lối vào: nút trên
// chi tiết vị thế loại BOND, link "Sửa điều khoản" ở form ghi trái tức, và CTA
// "Nhập điều khoản ngay" của màn chặn 7g.
//
// getBondTermsFormData() tự verify userId + `holding.type === "BOND"` và gọi
// notFound() khi không khớp — page không kiểm tra lại.
export default async function BondTermsPage({ params }: BondTermsPageProps) {
  const { id } = await params;
  const { holding, defaults } = await getBondTermsFormData(id);

  return (
    <BondTermsForm
      holding={holding}
      defaults={defaults}
      closeHref={ROUTES.holdingDetail(id)}
    />
  );
}

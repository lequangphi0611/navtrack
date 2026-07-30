import { Circle, FileText } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BondTermsMissingNoticeProps = {
  symbol: string;
  // Link tới form sửa vị thế (nơi có BondTermsFields) — CTA chính.
  bondTermsHref: string;
  // "Để sau" — quay lại nơi vừa đến. Vắng mặt = ẩn nút phụ.
  dismissHref?: string;
};

// Ba thứ cần nhập một lần trước khi tính được trái tức (mockup 7g) — 2 bắt
// buộc + 1 tuỳ chọn, thứ tự khớp BondTermsFields để user nhìn là thấy quen.
const REQUIRED_ITEMS = [
  { label: "Mệnh giá một trái phiếu", required: true },
  { label: "Loại tổ chức phát hành", required: true },
  { label: "Lãi suất & kỳ trả lãi", required: false },
];

// Trạng thái CHẶN khi bấm "Trái tức" trên vị thế trái phiếu chưa có BondTerms
// (mockup Phase 7 Screens 7g). Không phải empty state trang trí: app từ chối
// đoán mệnh giá/lãi suất, nên đây là lối duy nhất đi tiếp — dẫn thẳng sang màn
// nhập điều khoản (7a).
function BondTermsMissingNotice({
  symbol,
  bondTermsHref,
  dismissHref,
}: BondTermsMissingNoticeProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-3">
        <div className="flex size-16 items-center justify-center rounded-full border border-asset-bond/40 bg-asset-bond/18">
          <FileText className="size-7.5 text-asset-bond" />
        </div>
        <div className="text-center">
          <div className="text-[17px] font-bold text-foreground">
            Chưa có điều khoản trái phiếu
          </div>
          <div className="mx-auto mt-1.5 max-w-[290px] text-xs leading-relaxed text-muted-foreground">
            Vị thế <span className="text-foreground-soft">{symbol}</span> chưa
            có mệnh giá và lãi suất, nên app{" "}
            <span className="text-foreground-soft">
              không thể tính trái tức
            </span>
            . App sẽ không đoán các con số này.
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-white/3 p-3.5">
        <div className="mb-2 font-mono text-[10.5px] tracking-wide text-muted-faint uppercase">
          Cần nhập một lần
        </div>
        <div className="flex flex-col gap-1.75">
          {REQUIRED_ITEMS.map((item) => (
            <div key={item.label} className="flex items-center gap-2.25">
              <Circle
                className={cn(
                  "size-4 shrink-0",
                  item.required ? "text-destructive" : "text-muted-faint",
                )}
              />
              <span
                className={cn(
                  "text-xs",
                  item.required ? "text-muted-foreground" : "text-muted-faint",
                )}
              >
                {item.label}
                {item.required ? null : (
                  <span className="text-[11px]"> · tuỳ chọn</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <Link
          href={bondTermsHref}
          className={cn(buttonVariants(), "h-12.5 w-full gap-2 font-bold")}
        >
          <FileText className="size-4.5" />
          Nhập điều khoản ngay
        </Link>
        {dismissHref ? (
          <Link
            href={dismissHref}
            className={cn(
              buttonVariants({ variant: "outline" }),
              "h-12.5 w-full font-semibold",
            )}
          >
            Để sau
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export { BondTermsMissingNotice };
export type { BondTermsMissingNoticeProps };

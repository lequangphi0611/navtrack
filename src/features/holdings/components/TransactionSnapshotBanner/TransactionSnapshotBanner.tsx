import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  History,
  Zap,
} from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

type TransactionSnapshotBannerProps = {
  transactionLabel: string; // "Mua 5.000 CP"
  transactionDateNote: string; // "11/07/2026 · giá 27.300"
  transactionAmount: string; // signed, "-136500000"
  transactionKind: "BUY" | "SELL";
  snapshotNavValue: string;
  navHistoryHref: string; // ROUTES.snapshots
  hidden?: boolean;
};

// Banner hiện ngay dưới PageHeader của /holdings/[id] khi vừa ghi một giao dịch
// (mockup 3d) — mở rộng HoldingDetailScreen, KHÔNG route riêng. Cùng ngôn ngữ
// màu BUY/SELL với CashflowTimeline đã có (BUY = đỏ/ArrowDownLeft, SELL =
// xanh/ArrowUpRight) để nhất quán toàn app.
function TransactionSnapshotBanner({
  transactionLabel,
  transactionDateNote,
  transactionAmount,
  transactionKind,
  snapshotNavValue,
  navHistoryHref,
  hidden = false,
}: TransactionSnapshotBannerProps) {
  const isBuy = transactionKind === "BUY";
  const TransactionIcon = isBuy ? ArrowDownLeft : ArrowUpRight;

  return (
    <div className="flex flex-col gap-3.5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-200">
      <div className="flex items-center gap-2.75 rounded-2xl border border-gain/30 bg-gain/10 p-3">
        <div className="flex size-8.5 shrink-0 items-center justify-center rounded-[30%] bg-gain/18">
          <CheckCircle2 className="size-4.75 text-gain" />
        </div>
        <div>
          <div className="text-[13px] font-bold text-gain">
            Đã ghi giao dịch &amp; chốt snapshot
          </div>
          <div className="mt-0.25 text-[11px] text-muted-faint">
            Snapshot MANUAL tạo tự động sau khi {isBuy ? "mua" : "bán"}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-white/5 px-3.75 py-2.75 text-[11.5px] font-semibold text-muted-foreground">
          Giao dịch vừa ghi
        </div>
        <div className="flex items-center gap-2.75 px-3.75 py-3.25">
          <div
            className={cn(
              "flex size-8.5 shrink-0 items-center justify-center rounded-[10px]",
              isBuy ? "bg-destructive/12" : "bg-gain/12",
            )}
          >
            <TransactionIcon
              className={cn(
                "size-4.5",
                isBuy ? "text-destructive" : "text-gain",
              )}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-semibold text-foreground">
              {transactionLabel}
            </div>
            <div className="mt-0.25 font-mono text-[11px] text-muted-faint">
              {transactionDateNote}
            </div>
          </div>
          <div
            className={cn(
              "font-mono text-[13px] font-semibold tabular-nums",
              isBuy ? "text-destructive" : "text-gain",
            )}
          >
            {formatMoney(transactionAmount, { hidden, compact: true })}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-warning/26 bg-linear-to-br from-warning/9 to-card">
        <div className="flex items-center gap-2.75 px-3.75 py-3.25">
          <div className="flex size-8.5 shrink-0 items-center justify-center rounded-[30%] bg-warning/16">
            <Zap className="size-4.5 text-warning" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-semibold text-foreground">
              Snapshot tự động
            </div>
            <div className="mt-0.25 font-mono text-[11px] text-muted-faint">
              {transactionDateNote} · nguồn MANUAL
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-warning/12 px-3.75 py-2.75">
          <span className="text-xs text-muted-faint">
            NAV danh mục sau giao dịch
          </span>
          <span className="font-mono text-[13px] font-semibold text-foreground">
            {formatMoney(snapshotNavValue, { hidden, compact: true })}
          </span>
        </div>
      </div>

      <div className="flex gap-2.5 rounded-xl border border-border bg-card p-3">
        <Zap className="mt-0.25 size-4.5 shrink-0 text-primary" />
        <p className="text-[11.5px] leading-relaxed text-muted-foreground">
          Mỗi lần <span className="text-foreground-soft">mua/bán</span> đều chốt
          một snapshot để đường NAV không bị &quot;nhảy&quot; tại các điểm
          nạp/rút vốn — giữ chuỗi lịch sử liền mạch cho biểu đồ.
        </p>
      </div>

      <Link
        href={navHistoryHref}
        className={cn(
          buttonVariants({ variant: "outline" }),
          "w-full gap-1.75 font-semibold text-primary",
        )}
      >
        <History className="size-4.25" />
        Xem lịch sử NAV
      </Link>
    </div>
  );
}

export { TransactionSnapshotBanner };
export type { TransactionSnapshotBannerProps };

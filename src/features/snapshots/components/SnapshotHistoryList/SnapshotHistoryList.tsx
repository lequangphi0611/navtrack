import { Snowflake, Zap } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

type SnapshotBadge = {
  text: string; // "ĐỊNH KỲ" | "GIAO DỊCH" | "CUỐI NĂM"
  variant: "default" | "warning" | "accent";
};

type SnapshotListRow =
  | { kind: "live"; label: string; dateNote: string; value: string }
  | {
      kind: "frozen";
      id: string;
      label: string;
      badge: SnapshotBadge;
      dateNote: string;
      value: string;
      href: string; // ROUTES.snapshotDetail(id)
    };

type SnapshotHistoryListProps = {
  rows: SnapshotListRow[]; // rows[0] luôn kind "live"
  hidden?: boolean;
  className?: string;
};

// Tint icon tròn theo variant của badge — "default" (ĐỊNH KỲ) dùng token primary
// (khớp Badge variant default hiện có), "warning" (GIAO DỊCH) và "accent" (CUỐI
// NĂM) dùng đúng token ngữ nghĩa cùng tên.
const FROZEN_ICON_TINT: Record<SnapshotBadge["variant"], string> = {
  default: "bg-primary/12 text-primary",
  warning: "bg-warning/12 text-warning",
  accent: "bg-accent/12 text-accent",
};

// Danh sách "Các mốc đã chốt" (mockup 3a) — dòng đầu luôn kind "live" (mốc "hôm
// nay" tính động, không lưu, không có href); các dòng "frozen" là Link thật sang
// /snapshots/[id] (3c/3f).
function SnapshotHistoryList({
  rows,
  hidden = false,
  className,
}: SnapshotHistoryListProps) {
  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      <div className="flex items-center justify-between">
        <div className="text-[12.5px] font-semibold text-muted-foreground">
          Các mốc đã chốt
        </div>
        <div className="font-mono text-[11px] text-muted-faint">
          {rows.length} snapshot
        </div>
      </div>

      <div className="flex flex-col gap-2.25">
        {rows.map((row) =>
          row.kind === "live" ? (
            <div
              key="live"
              className="flex items-center gap-3 rounded-2xl border border-dashed border-primary/40 p-3.25"
            >
              <div className="flex size-8.5 shrink-0 items-center justify-center rounded-[30%] bg-primary/14">
                <Zap className="size-4.5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-semibold text-foreground">
                  {row.label}{" "}
                  <span className="text-[10.5px] font-semibold text-primary">
                    · trực tiếp
                  </span>
                </div>
                <div className="mt-0.25 font-mono text-[11px] text-muted-faint">
                  {row.dateNote}
                </div>
              </div>
              <div className="font-mono text-[12.5px] font-semibold text-foreground tabular-nums">
                {formatMoney(row.value, { hidden, compact: true })}
              </div>
            </div>
          ) : (
            <Link
              key={row.id}
              href={row.href}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.25 transition-colors hover:bg-muted"
            >
              <div
                className={cn(
                  "flex size-8.5 shrink-0 items-center justify-center rounded-[30%]",
                  FROZEN_ICON_TINT[row.badge.variant],
                )}
              >
                <Snowflake className="size-4.25" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[13.5px] font-semibold text-foreground">
                    {row.label}
                  </span>
                  <Badge
                    variant={row.badge.variant}
                    className="shrink-0 px-1.5 py-0 text-[9px]"
                  >
                    {row.badge.text}
                  </Badge>
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-muted-faint">
                  {row.dateNote}
                </div>
              </div>
              <div className="font-mono text-[12.5px] font-semibold text-foreground tabular-nums">
                {formatMoney(row.value, { hidden, compact: true })}
              </div>
            </Link>
          ),
        )}
      </div>
    </div>
  );
}

export { SnapshotHistoryList };
export type { SnapshotBadge, SnapshotHistoryListProps, SnapshotListRow };

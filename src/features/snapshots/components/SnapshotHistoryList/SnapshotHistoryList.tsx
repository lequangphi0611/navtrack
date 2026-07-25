"use client";

import { ChevronDown, Snowflake, Zap } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { Alert } from "@/components/Alert";
import { Badge } from "@/components/ui/badge";
import type { SnapshotHistoryPage } from "@/features/snapshots/types";
import type { ActionResult } from "@/lib/action-result";
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
  // Load-more "Các mốc đã chốt" (cursor-based, issue #83) — trang đầu đã fetch
  // sẵn ở page.tsx (Container), component tự quản lý các trang tiếp theo.
  initialNextCursor: string | null;
  loadMoreAction: (
    cursor: string,
  ) => Promise<ActionResult<SnapshotHistoryPage>>;
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
  initialNextCursor,
  loadMoreAction,
}: SnapshotHistoryListProps) {
  const [moreRows, setMoreRows] = useState<SnapshotListRow[]>([]);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // `rows` là prop do Server Component cha (page.tsx) tính lại mỗi lần render
  // — chỉ đổi reference khi có fetch/revalidate mới từ server (vd sau khi chốt
  // snapshot mới qua SnapshotFreezeSheet gọi revalidatePath), KHÔNG BAO GIỜ đổi
  // do hành động nội bộ của chính component này (handleLoadMore() chỉ set
  // state cục bộ moreRows/nextCursor, không đụng props). Nếu không reset,
  // trang 1 (rows) được fetch lại nhưng state moreRows/nextCursor cũ (đang giữ
  // trang 2 đã tải qua "Xem thêm") không tự đồng bộ, gây trùng/thiếu dòng khi
  // ghép allRows — nên reset về trạng thái "chưa xem thêm" mỗi khi server trả
  // dữ liệu mới. Set state trong lúc render (thay vì effect) là pattern chính
  // thức của React cho "reset state khi prop đổi": so sánh reference rows với
  // giá trị rows đã thấy lần render trước (prevRows), không kích hoạt sai lúc
  // user đang bấm "Xem thêm" vì lúc đó rows không đổi reference.
  const [prevRows, setPrevRows] = useState(rows);
  if (rows !== prevRows) {
    setPrevRows(rows);
    setMoreRows([]);
    setNextCursor(initialNextCursor);
  }

  const hasMore = nextCursor !== null;
  const allRows = [...rows, ...moreRows];

  function handleLoadMore() {
    if (!nextCursor) return;
    setError(null);
    startTransition(async () => {
      const result = await loadMoreAction(nextCursor);
      if (result.ok) {
        setMoreRows((prev) => [...prev, ...result.data.rows]);
        setNextCursor(result.data.nextCursor);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      <div className="flex items-center justify-between">
        <div className="text-[12.5px] font-semibold text-muted-foreground">
          Các mốc đã chốt
        </div>
        <div className="font-mono text-[11px] text-muted-faint">
          {allRows.filter((r) => r.kind === "frozen").length} snapshot
        </div>
      </div>

      <div className="flex flex-col gap-2.25">
        {allRows.map((row) =>
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

        {hasMore ? (
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={isPending}
            className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border p-3 text-[12.5px] font-semibold text-accent transition-colors hover:bg-muted disabled:opacity-60"
          >
            <span>{isPending ? "Đang tải…" : "Xem thêm"}</span>
            {!isPending ? <ChevronDown className="size-4" /> : null}
          </button>
        ) : null}
      </div>

      {error ? (
        <Alert
          variant="error"
          title="Không tải thêm được"
          description={error}
        />
      ) : null}
    </div>
  );
}

export { SnapshotHistoryList };
export type { SnapshotBadge, SnapshotHistoryListProps, SnapshotListRow };

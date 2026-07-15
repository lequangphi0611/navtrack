import { Info, ShieldCheck, Snowflake, TrendingUp } from "lucide-react";

import {
  type AssetType,
  ASSET_TYPE_TINT_CLASS,
} from "@/components/AssetTypeBadge";
import { PageHeader } from "@/components/PageHeader";
import { SymbolAvatar } from "@/components/SymbolAvatar";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/format";

type SnapshotDetailHoldingRow = {
  id: string;
  symbol: string;
  name: string;
  assetType: AssetType;
  value: string;
};

type SnapshotDetailMeta = {
  sourceLabel: "AUTO" | "MANUAL"; // Snapshot.source
  periodLabel: "PERIODIC" | "YEAR_END" | "MANUAL"; // Snapshot.period
  cutoffDateLabel: string;
  recordedAtLabel: string;
};

type SnapshotRecomputedComparison = {
  // 3f — vắng mặt = ẩn hẳn khối so sánh (chỉ còn thuần 3c).
  recomputedValue: string;
  deltaAmount: string;
  deltaNote: string; // "nếu dùng giá 11/07"
};

type SnapshotDetailScreenProps = {
  title: string; // "Snapshot 30/06/2026"
  subtitle: string; // "Cuối tháng · toàn danh mục" (3c) | "Giá đã đổi từ khi chốt" (3f)
  backHref: string; // ROUTES.snapshots
  navValue: string;
  meta: SnapshotDetailMeta;
  holdings: SnapshotDetailHoldingRow[];
  recomputedComparison?: SnapshotRecomputedComparison; // 3f
  hidden?: boolean;
};

const META_FIELDS: { key: keyof SnapshotDetailMeta; label: string }[] = [
  { key: "sourceLabel", label: "Nguồn" },
  { key: "periodLabel", label: "Chu kỳ" },
  { key: "cutoffDateLabel", label: "Ngày mốc" },
  { key: "recordedAtLabel", label: "Ghi lúc" },
];

// Organism dùng chung cho /snapshots/[id] (mockup 3c + 3f) — cả 2 màn chỉ khác
// nhau ở việc có `recomputedComparison` hay không (giá hiện tại có đổi so với
// lúc chốt), tránh tách 2 component trùng khung. Banner "giá đổi nhưng giữ
// nguyên" (xanh) CHỈ hiện khi có so sánh; banner info trung tính (giá EOD
// không đổi) CHỈ hiện khi KHÔNG có, tránh lặp ý; card "Vì sao đóng băng?" luôn
// hiện ở cả 2 biến thể.
function SnapshotDetailScreen({
  title,
  subtitle,
  backHref,
  navValue,
  meta,
  holdings,
  recomputedComparison,
  hidden = false,
}: SnapshotDetailScreenProps) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4.5 p-5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
      <div>
        <PageHeader title={title} backHref={backHref} />
        <p className="mt-1.5 pl-11.5 text-[11.5px] text-muted-faint">
          {subtitle}
        </p>
      </div>

      {recomputedComparison ? (
        <div className="flex gap-2.5 rounded-xl border border-gain/24 bg-gain/8 p-3">
          <Snowflake className="mt-0.5 size-4.5 shrink-0 text-gain" />
          <p className="text-[12px] leading-relaxed text-gain">
            Giá thị trường đã cập nhật sau ngày chốt, nhưng số đã đóng băng{" "}
            <span className="font-semibold">giữ nguyên</span>.
          </p>
        </div>
      ) : null}

      <div className="rounded-2xl border border-primary/24 bg-linear-to-br from-primary/12 to-card p-4.25">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <div className="text-xs font-semibold text-muted-foreground">
            NAV đã đóng băng
          </div>
          <Badge className="gap-1 text-[10.5px]">
            <Snowflake />
            Frozen
          </Badge>
        </div>
        <div className="font-mono text-[26px] font-semibold tracking-tight text-foreground">
          {formatMoney(navValue, { hidden })}
        </div>
        <div className="mt-1.25 font-mono text-[11.5px] text-muted-faint">
          holdingId = null · snapshot tổng danh mục
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {META_FIELDS.map((field) => (
          <div
            key={field.key}
            className="rounded-2xl border border-border bg-card p-3.5"
          >
            <div className="text-[10.5px] font-semibold tracking-wide text-muted-faint uppercase">
              {field.label}
            </div>
            <div className="mt-1.25 font-mono text-[13px] font-semibold text-foreground">
              {meta[field.key]}
            </div>
          </div>
        ))}
      </div>

      {recomputedComparison ? (
        <div className="flex flex-col gap-2.75">
          <div className="rounded-2xl border border-primary/30 bg-linear-to-br from-primary/12 to-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.25 text-xs font-semibold text-primary">
                <Snowflake className="size-3.75" />
                Snapshot đã lưu
              </span>
              <Badge className="text-[9.5px]">FROZEN · frozen=true</Badge>
            </div>
            <div className="font-mono text-2xl font-semibold text-foreground">
              {formatMoney(navValue, { hidden, compact: true })}
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[11px] text-muted-faint">
              so với tính lại hôm nay
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="rounded-2xl border border-dashed border-border bg-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">
                Nếu tính lại với giá mới
              </span>
              <Badge variant="neutral" className="text-[9.5px]">
                KHÔNG GHI ĐÈ
              </Badge>
            </div>
            <div className="font-mono text-2xl font-semibold text-muted-foreground">
              {formatMoney(recomputedComparison.recomputedValue, {
                hidden,
                compact: true,
              })}
            </div>
            <div className="mt-1.5 flex items-center gap-1.5 font-mono text-[11px] text-warning">
              <TrendingUp className="size-3.5" />
              {formatMoney(recomputedComparison.deltaAmount, {
                hidden,
                compact: true,
              })}{" "}
              {recomputedComparison.deltaNote}
            </div>
          </div>
        </div>
      ) : null}

      <div>
        <div className="mb-2.25 flex items-center justify-between">
          <div className="text-[12.5px] font-semibold text-muted-foreground">
            Giá trị từng vị thế
          </div>
          <div className="text-[11px] text-muted-faint">
            đóng băng theo holdingId
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {holdings.map((row) => (
            <div
              key={row.id}
              className="flex items-center gap-2.75 border-t border-white/4.5 px-3.5 py-2.75 first:border-t-0"
            >
              <SymbolAvatar
                symbol={row.symbol}
                size="sm"
                colorClassName={ASSET_TYPE_TINT_CLASS[row.assetType]}
              />
              <span className="flex-1 truncate text-[13px] font-semibold text-foreground">
                {row.name}
              </span>
              <span className="font-mono text-[12.5px] font-semibold text-foreground tabular-nums">
                {formatMoney(row.value, { hidden, compact: true })}
              </span>
            </div>
          ))}
        </div>
      </div>

      {!recomputedComparison ? (
        <div className="flex gap-2.5 rounded-xl border border-border bg-card p-3.25">
          <Info className="mt-0.5 size-4.25 shrink-0 text-muted-faint" />
          <p className="text-[11px] leading-relaxed text-muted-faint">
            Giá trị đóng băng dùng giá EOD tại {meta.cutoffDateLabel} — cập nhật
            giá về sau <span className="text-muted-foreground">không</span> làm
            thay đổi snapshot này.
          </p>
        </div>
      ) : null}

      <div className="rounded-2xl border border-border bg-card p-3.75">
        <div className="mb-2 flex items-center gap-1.75">
          <ShieldCheck className="size-4.25 text-primary" />
          <span className="text-[12.5px] font-semibold text-foreground">
            Vì sao đóng băng?
          </span>
        </div>
        <p className="text-[11.5px] leading-relaxed text-muted-faint">
          Báo cáo lịch sử &amp; biểu đồ NAV phải{" "}
          <span className="text-muted-foreground">nhất quán</span>: một mốc quá
          khứ luôn cho cùng con số, không &quot;chạy&quot; theo giá hiện tại.
          Chuỗi snapshot tổng danh mục này là dữ liệu nguồn cho biểu đồ ở Phase
          6.
        </p>
      </div>
    </div>
  );
}

export { SnapshotDetailScreen };
export type {
  SnapshotDetailHoldingRow,
  SnapshotDetailMeta,
  SnapshotDetailScreenProps,
  SnapshotRecomputedComparison,
};

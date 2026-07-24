import Decimal from "decimal.js";

import type {
  NavHistoryChartPoint,
  NavHistoryChartProps,
} from "@/features/snapshots/components/NavHistoryChart";
import type {
  SnapshotBadge,
  SnapshotListRow,
} from "@/features/snapshots/components/SnapshotHistoryList";
import { formatDate } from "@/lib/format";
import { ROUTES } from "@/lib/routes";

// Pure — không đụng DB, để unit test được (tiền lệ lib/manual-snapshot.ts,
// issue #37). Đầu vào ĐÃ sort date desc (`getSnapshotHistory()`, queries.ts,
// đảm nhiệm ORDER BY) và value ĐÃ convert Decimal -> string ở biên server
// (docs/rules/data-prisma.md).
export type FrozenSnapshotRow = {
  id: string;
  date: Date;
  value: string;
  period: "PERIODIC" | "YEAR_END" | "MANUAL" | "TODAY";
};

// Tối đa 7 điểm frozen trong chart + 1 điểm live = 8 điểm (khớp comment
// NavHistoryChartPoint "8 điểm, phần tử cuối isLive=true").
const CHART_FROZEN_POINTS = 7;

type PeriodPresentation = {
  label: string;
  badge: SnapshotBadge;
  // Ghép sau formatDate(date) trong dateNote — "{ngày} · {description}".
  // KHÔNG có trong plan/mockup gốc (mockup ghi "cron 01/07"/"tự động khi
  // mua" — thông tin cụ thể hơn model thật có thể chứng minh), tự chọn cụm
  // từ trung tính khớp đúng những gì `period` thật sự nói lên được, tránh
  // suy diễn quá mức (vd không biết chính xác ngày cron chạy).
  description: string;
};

// Badge/label suy TRỰC TIẾP từ `period` — KHÔNG thêm field schema (Trọng
// tâm quyết định #1, process/DECISION.md issue #46). Model không phân biệt
// được "MANUAL do giao dịch" vs "MANUAL do user tự bấm" nên cả hai gộp
// chung 1 badge "THỦ CÔNG".
function describePeriod(
  period: FrozenSnapshotRow["period"],
  date: Date,
): PeriodPresentation {
  switch (period) {
    case "PERIODIC":
      return {
        label: `Cuối tháng ${date.getUTCMonth() + 1}`,
        badge: { text: "ĐỊNH KỲ", variant: "default" },
        description: "định kỳ hàng tháng",
      };
    case "YEAR_END":
      return {
        label: `Cuối năm ${date.getUTCFullYear()}`,
        badge: { text: "CUỐI NĂM", variant: "accent" },
        description: "chốt cuối năm",
      };
    case "MANUAL":
      return {
        label: "Chốt thủ công",
        badge: { text: "THỦ CÔNG", variant: "warning" },
        description: "chốt thủ công",
      };
    // TODAY không bao giờ frozen=true (docs/domain/06-snapshots.md "Quy tắc
    // & bất biến": "Mốc hôm nay là động, KHÔNG lưu") — getSnapshotHistory()
    // lọc frozen:true trước khi tới đây nên nhánh này thực tế không đạt
    // tới. Giữ lại (thay vì throw) để hàm vẫn pure/an toàn cho input phòng
    // thủ, không làm vỡ switch exhaustiveness.
    case "TODAY":
      return {
        label: "Mốc hôm nay (đã lưu)",
        badge: { text: "THỦ CÔNG", variant: "warning" },
        description: "mốc hôm nay",
      };
  }
}

// Phân trang kiểu "peek LIMIT+1" dùng chung cho getSnapshotHistory()/
// getMoreSnapshotHistory() (features/snapshots/queries.ts, issue #83) — nhận
// `rows` đã query với `take: limit + 1` (caller tự peek), tính hasMore/page/
// nextCursor. Pure, generic theo T có id để cả FrozenSnapshotRow lẫn row thô
// từ Prisma dùng chung được.
export function paginateWithCursor<T extends { id: string }>(
  rows: T[],
  limit: number,
): { page: T[]; hasMore: boolean; nextCursor: string | null } {
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? (page[page.length - 1]?.id ?? null) : null;
  return { page, hasMore, nextCursor };
}

function heightPercentOf(value: Decimal, max: Decimal): number {
  if (max.isZero()) return 0;
  return value.div(max).mul(100).toNumber();
}

// Tách khỏi buildSnapshotHistoryView để getMoreSnapshotHistory() (queries.ts,
// load-more cursor-based, issue #83) map trực tiếp 1 FrozenSnapshotRow -> 1
// SnapshotListRow{kind:"frozen"} không cần chạy lại toàn bộ buildSnapshotHistoryView
// (vốn còn build chart, không cần cho payload load-more).
export function toFrozenSnapshotListRow(
  row: FrozenSnapshotRow,
): Extract<SnapshotListRow, { kind: "frozen" }> {
  const { label, badge, description } = describePeriod(row.period, row.date);
  return {
    kind: "frozen",
    id: row.id,
    label,
    badge,
    dateNote: `${formatDate(row.date)} · ${description}`,
    value: row.value,
    href: ROUTES.snapshotDetail(row.id),
  };
}

// Dựng dữ liệu cho /snapshots (mockup 3a) — chart 8 cột + danh sách "Các mốc
// đã chốt" — từ chuỗi Snapshot{holdingId: null, frozen: true} đã lưu +
// NAV "hôm nay" tính động (không lưu). `now` truyền vào để test được (mặc
// định new Date()).
export function buildSnapshotHistoryView(
  frozenDesc: FrozenSnapshotRow[],
  navToday: string,
  now: Date = new Date(),
): { chart: NavHistoryChartProps; rows: SnapshotListRow[] } {
  const chartFrozenAsc = frozenDesc.slice(0, CHART_FROZEN_POINTS).reverse();
  const navTodayDecimal = new Decimal(navToday);

  const chartValues = [
    ...chartFrozenAsc.map((row) => new Decimal(row.value)),
    navTodayDecimal,
  ];
  const max = Decimal.max(...chartValues);

  const points: NavHistoryChartPoint[] = [
    ...chartFrozenAsc.map((row) => ({
      label: `T${row.date.getUTCMonth() + 1}/${String(row.date.getUTCFullYear()).slice(-2)}`,
      heightPercent: heightPercentOf(new Decimal(row.value), max),
    })),
    {
      label: "nay",
      heightPercent: heightPercentOf(navTodayDecimal, max),
      isLive: true,
    },
  ];

  const latestFrozen = frozenDesc[0];
  const latestFrozenValue = latestFrozen
    ? new Decimal(latestFrozen.value)
    : null;
  const changePercent =
    latestFrozenValue && !latestFrozenValue.isZero()
      ? navTodayDecimal
          .minus(latestFrozenValue)
          .div(latestFrozenValue)
          .mul(100)
          .toNumber()
      : 0;

  const liveRow: SnapshotListRow = {
    kind: "live",
    label: "Hôm nay",
    dateNote: `${formatDate(now)} · tính động, chưa lưu`,
    value: navToday,
  };

  const frozenRows: SnapshotListRow[] = frozenDesc.map(toFrozenSnapshotListRow);

  return {
    chart: { navToday, changePercent, points },
    rows: [liveRow, ...frozenRows],
  };
}

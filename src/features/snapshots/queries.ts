import Decimal from "decimal.js";
import { notFound } from "next/navigation";
import { cache } from "react";

import type { AssetType } from "@/components/AssetTypeBadge";
import type {
  AssetTypeFilter,
  AssetTypeFilterOption,
  NavTrendByAssetTypePeriodData,
} from "@/features/dashboard/components/NavTrendByAssetType";
import { getOpenHoldings } from "@/features/holdings/queries";
import type {
  SnapshotDetailHoldingRow,
  SnapshotDetailScreenProps,
} from "@/features/snapshots/components/SnapshotDetailScreen";
import { getSession } from "@/lib/auth";
import { resolveCutoffDate, todayIctDateOnly } from "@/lib/cutoff";
import { db } from "@/lib/db";
import { formatDate, formatDayMonth, formatTime } from "@/lib/format";
import {
  buildNavTrendSeries,
  computeSpreadPercent,
  groupSnapshotRowsByType,
  type NavTrendPeriod,
  type NavTrendPoint,
} from "@/lib/nav-trend";
import { ROUTES } from "@/lib/routes";
import { MILLIS_PER_DAY } from "@/lib/xirr";
import {
  buildSnapshotHistoryView,
  paginateWithCursor,
  type FrozenSnapshotRow,
} from "@/lib/snapshot-history";
import {
  computeRecomputedComparison,
  type RecomputeHoldingInput,
} from "@/lib/snapshot-recompute";
import type { HoldingValuation } from "@/lib/valuation";
import {
  getLatestNavOverrides,
  getLatestPriceQuotes,
  resolvePrice,
  valuateHoldings,
} from "@/lib/valuation";

// Re-export — lib/nav-trend.ts mới là nguồn sự thật (lib/ không được phụ
// thuộc ngược features/, xem comment ở đó), giữ nguyên surface cũ cho mọi
// consumer đang `import type { NavTrendPeriod, NavTrendPoint } from
// "@/features/snapshots/queries"`.
export type { NavTrendPeriod, NavTrendPoint };

// Thứ tự nhóm cố định — khớp GROUP_ORDER (features/holdings/group-holdings.ts) và
// ASSET_TYPE_ORDER (lib/portfolio-valuation.ts): STOCK, FUND, BOND, GOLD.
const ASSET_TYPE_ORDER: AssetType[] = ["STOCK", "FUND", "BOND", "GOLD"];

// Snapshot{userId, holdingId: null, date: hôm nay, period: MANUAL} của user hiện tại —
// dùng cho Dashboard (alreadySnapshotToday/snapshotTakenAt, SnapshotTodayCard) VÀ cho
// justRecorded.snapshotNavValue ở /holdings/[id] (getJustRecordedBanner). `takenAt` đọc
// từ `updatedAt` (không phải `createdAt`) — re-chốt trong ngày ghi đè, updatedAt phản
// ánh đúng lần chốt GẦN NHẤT (docs/domain/06-snapshots.md mục "Ca biên").
export const getManualSnapshotToday = cache(
  async (): Promise<{
    value: string;
    takenAt: string;
  } | null> => {
    const session = await getSession();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const row = await db.snapshot.findFirst({
      where: {
        userId: session.user.id,
        holdingId: null,
        date: todayIctDateOnly(),
        period: "MANUAL",
      },
      select: { value: true, updatedAt: true },
    });

    if (!row) return null;
    return { value: row.value.toString(), takenAt: formatTime(row.updatedAt) };
  },
);

function isValued(
  valuation: HoldingValuation,
): valuation is Extract<HoldingValuation, { status: "VALUED" }> {
  return valuation.status === "VALUED";
}

// NAV "hôm nay" (cutoff TODAY) cộng dồn theo loại tài sản, chỉ tính holding ĐANG
// MỞ và ĐÃ ĐỊNH GIÁ ĐƯỢC — holding MISSING_PRICE bị BỎ QUA khỏi tổng (không mặc
// định 0), khác việc bucket của một loại hoàn toàn không có holding nào định
// giá được thì tự nhiên ra Decimal(0) qua `?? new Decimal(0)` ở nơi đọc map này.
// Dùng chung cho getSnapshotFreezePreview() (breakdown 4 nhóm cho
// SnapshotFreezeSheet) VÀ getNavTrendByAssetType() (điểm "hôm nay" nối vào
// chuỗi NAV theo loại, issue #141) — tránh 2 cài đặt song song của cùng công
// thức (docs/rules/data-prisma.md mục "Materialized cache" cảnh báo rủi ro
// lệch dữ liệu khi có ≥ 2 bản sao logic).
async function computeTodayNavByType(): Promise<Map<AssetType, Decimal>> {
  const openHoldings = await getOpenHoldings();
  const cutoffDate = resolveCutoffDate({ key: "TODAY" });
  const valuations = await valuateHoldings(
    openHoldings.map((h) => ({
      id: h.id,
      symbol: h.symbol,
      quantity: new Decimal(h.quantity),
    })),
    cutoffDate,
  );

  const navByType = new Map<AssetType, Decimal>();
  for (const holding of openHoldings) {
    const valuation = valuations.get(holding.id);
    if (!valuation || !isValued(valuation)) continue;
    const prev = navByType.get(holding.type) ?? new Decimal(0);
    navByType.set(holding.type, prev.plus(valuation.nav));
  }

  return navByType;
}

// Preview cho SnapshotFreezeSheet (/snapshots, mockup 3b) — NAV "sẽ đóng băng" nếu bấm
// "Đóng băng số liệu" ngay bây giờ, tính lại tại thời điểm submit bởi freezeManualSnapshot()
// (số hiển thị ở đây chỉ là preview, có thể lệch nhẹ nếu giá đổi giữa lúc xem và lúc bấm).
//
// breakdown LUÔN đúng 4 dòng (STOCK/FUND/BOND/GOLD) — khác buildAllocation()
// (lib/portfolio-valuation.ts) vốn bỏ nhóm không có holding nào VALUED (dùng cho % phân
// bổ, nhóm rỗng vô nghĩa ở biểu đồ đó). Ở đây SnapshotFreezeSheetProps.breakdown ghi rõ
// "đúng 4 nhóm" — nhóm không có holding loại đó (hoặc có nhưng toàn MISSING_PRICE) hiện
// value "0" (NAV thật của nhóm, không phải giấu do thiếu giá).
export async function getSnapshotFreezePreview(): Promise<{
  navValue: string;
  cutoffDateLabel: string;
  breakdown: { type: AssetType; value: string }[];
}> {
  const navByType = await computeTodayNavByType();

  const breakdown = ASSET_TYPE_ORDER.map((type) => ({
    type,
    value: (navByType.get(type) ?? new Decimal(0)).toString(),
  }));

  const navValue = breakdown
    .reduce((sum, row) => sum.plus(row.value), new Decimal(0))
    .toString();

  return {
    navValue,
    cutoffDateLabel: formatDate(new Date()),
    breakdown,
  };
}

// Đủ cho chart 7 điểm + danh sách hiển thị hợp lý — không cần thêm index mới,
// @@index([userId, date]) đã có trên Snapshot đủ dùng (leftmost prefix userId,
// sort theo date). App cá nhân quy mô nhỏ (Trọng tâm quyết định #5, issue #46).
const SNAPSHOT_HISTORY_LIMIT = 20;

// Dữ liệu cho /snapshots (mockup 3a) — chart NAV + danh sách "Các mốc đã chốt".
// Nhận `navToday` từ caller (page.tsx) thay vì tự tính lại — tránh gọi trùng
// getOpenHoldings()/valuateHoldings() 2 lần trong cùng request (page.tsx đã
// gọi getSnapshotFreezePreview() cho freezeSheet, dùng luôn NAV đó).
export async function getSnapshotHistory(
  navToday: string,
  now: Date = new Date(),
): Promise<
  ReturnType<typeof buildSnapshotHistoryView> & {
    nextCursor: string | null;
  }
> {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const frozen = await db.snapshot.findMany({
    where: { userId: session.user.id, holdingId: null, frozen: true },
    orderBy: [{ date: "desc" }, { id: "desc" }],
    // +1 "peek" — biết còn dữ liệu phía sau hay không mà không cần COUNT riêng.
    take: SNAPSHOT_HISTORY_LIMIT + 1,
    select: { id: true, date: true, value: true, period: true },
  });

  const { page, nextCursor } = paginateWithCursor(
    frozen,
    SNAPSHOT_HISTORY_LIMIT,
  );

  const frozenRows: FrozenSnapshotRow[] = page.map((s) => ({
    id: s.id,
    date: s.date,
    value: s.value.toString(),
    period: s.period,
  }));

  return {
    ...buildSnapshotHistoryView(frozenRows, navToday, now),
    nextCursor,
  };
}

// Trang tiếp theo của "Các mốc đã chốt" (load-more, issue #83) — cursor là `id`
// của dòng cuối cùng đã hiển thị. Không dùng Prisma `cursor:` API gốc vì nó
// KHÔNG tự áp filter userId khi tra cursor — tra thủ công bằng findFirst có
// where userId trước, tránh rò rỉ tồn tại/date của snapshot user khác qua id.
export async function getMoreSnapshotHistory(
  cursor: string,
): Promise<{ rows: FrozenSnapshotRow[]; nextCursor: string | null }> {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const cursorRow = await db.snapshot.findFirst({
    where: {
      id: cursor,
      userId: session.user.id,
      holdingId: null,
      frozen: true,
    },
    select: { date: true },
  });
  if (!cursorRow) return { rows: [], nextCursor: null };

  const frozen = await db.snapshot.findMany({
    where: {
      userId: session.user.id,
      holdingId: null,
      frozen: true,
      OR: [
        { date: { lt: cursorRow.date } },
        { date: cursorRow.date, id: { lt: cursor } },
      ],
    },
    orderBy: [{ date: "desc" }, { id: "desc" }],
    take: SNAPSHOT_HISTORY_LIMIT + 1,
    select: { id: true, date: true, value: true, period: true },
  });

  const { page, nextCursor } = paginateWithCursor(
    frozen,
    SNAPSHOT_HISTORY_LIMIT,
  );

  const rows: FrozenSnapshotRow[] = page.map((s) => ({
    id: s.id,
    date: s.date,
    value: s.value.toString(),
    period: s.period,
  }));

  return { rows, nextCursor };
}

// Subtitle 3c (không có recomputedComparison) — mở rộng đúng câu mockup gốc
// ("Cuối tháng · toàn danh mục", page.tsx demo cũ) cho cả 3 period còn lại.
// TODAY không nằm trong map này vì snapshot tổng danh mục không bao giờ ở
// period đó khi đã đóng băng (frozen luôn true ở query trên, còn TODAY luôn
// frozen=false — docs/domain/06-snapshots.md).
const SNAPSHOT_SUBTITLE_BY_PERIOD: Record<
  "PERIODIC" | "YEAR_END" | "MANUAL",
  string
> = {
  PERIODIC: "Cuối tháng · toàn danh mục",
  YEAR_END: "Cuối năm · toàn danh mục",
  MANUAL: "Chốt thủ công · toàn danh mục",
};

// Chi tiết một snapshot tổng danh mục đã đóng băng (mockup 3c/3f, /snapshots/[id]).
// So giá tại mốc chốt với giá hiện tại cho từng holding trong breakdown để quyết
// định có hiện `recomputedComparison` hay không (server quyết định, không phải 2
// loại snapshot khác nhau — process/UI_phase_3.md mục 4).
export async function getSnapshotDetail(
  id: string,
): Promise<SnapshotDetailScreenProps> {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const snapshot = await db.snapshot.findUnique({ where: { id } });
  // Không tồn tại / không thuộc user hiện tại / là dòng per-holding (chỉ xem
  // được qua dòng tổng danh mục lồng bên trong) / chưa đóng băng (period =
  // TODAY, tính động không lưu thật — không có trang chi tiết) -> xử lý
  // giống nhau, 404, không lộ thông tin tồn tại (cùng pattern getHoldingDetail,
  // features/holdings/queries.ts).
  if (
    !snapshot ||
    snapshot.userId !== session.user.id ||
    snapshot.holdingId !== null ||
    !snapshot.frozen
  ) {
    notFound();
  }

  // Liên kết breakdown per-holding với dòng tổng: CÙNG (userId, date, period),
  // KHÁC holdingId (không có FK trực tiếp) — Trọng tâm quyết định #2, đúng khóa
  // dedup (userId, holdingId, date, period) đã có từ issue #34.
  const holdingRows = await db.snapshot.findMany({
    where: {
      userId: session.user.id,
      date: snapshot.date,
      period: snapshot.period,
      holdingId: { not: null },
    },
    select: {
      holdingId: true,
      value: true,
      holding: { select: { symbol: true, name: true, type: true } },
    },
  });

  const now = new Date();
  const cutoffToday = resolveCutoffDate({ key: "TODAY" }, now);
  // holdingId lọc { not: null } ở where + Holding có onDelete: Cascade trên
  // Snapshot (schema.prisma) -> holding luôn tồn tại khi holdingId không null;
  // non-null assertion an toàn ở đây (cùng pattern netAmount! ở lib/portfolio-valuation.ts).
  const holdingIds = holdingRows.map((r) => r.holdingId as string);
  const symbols = holdingRows.map((r) => r.holding!.symbol);

  const [histNavOverrides, histPriceQuotes, curNavOverrides, curPriceQuotes] =
    await Promise.all([
      getLatestNavOverrides(holdingIds, snapshot.date),
      getLatestPriceQuotes(symbols, snapshot.date),
      getLatestNavOverrides(holdingIds, cutoffToday),
      getLatestPriceQuotes(symbols, cutoffToday),
    ]);

  const recomputeInputs: RecomputeHoldingInput[] = holdingRows.map((row) => ({
    frozenValue: new Decimal(row.value.toString()),
    historicalPrice:
      resolvePrice(
        histNavOverrides.get(row.holdingId!) ?? null,
        histPriceQuotes.get(row.holding!.symbol) ?? null,
      )?.price ?? null,
    currentPrice:
      resolvePrice(
        curNavOverrides.get(row.holdingId!) ?? null,
        curPriceQuotes.get(row.holding!.symbol) ?? null,
      )?.price ?? null,
  }));

  const recomputedComparison = computeRecomputedComparison(
    recomputeInputs,
    new Decimal(snapshot.value.toString()),
    formatDayMonth(now),
  );

  const holdings: SnapshotDetailHoldingRow[] = ASSET_TYPE_ORDER.flatMap(
    (type) => holdingRows.filter((row) => row.holding!.type === type),
  ).map((row) => ({
    id: row.holdingId as string,
    symbol: row.holding!.symbol,
    name: row.holding!.name ?? row.holding!.symbol,
    assetType: row.holding!.type,
    value: row.value.toString(),
  }));

  return {
    title: `Snapshot ${formatDate(snapshot.date)}`,
    subtitle: recomputedComparison
      ? "Giá đã đổi từ khi chốt"
      : // Guard `!snapshot.frozen` phía trên loại trừ period TODAY khỏi mọi
        // dòng đi tới đây trong thực tế (domain invariant, docs/domain/06) —
        // cast thu hẹp union còn 3 giá trị khớp SNAPSHOT_SUBTITLE_BY_PERIOD.
        SNAPSHOT_SUBTITLE_BY_PERIOD[
          snapshot.period as "PERIODIC" | "YEAR_END" | "MANUAL"
        ],
    backHref: ROUTES.snapshots,
    navValue: snapshot.value.toString(),
    meta: {
      sourceLabel: snapshot.source,
      periodLabel: snapshot.period as "PERIODIC" | "YEAR_END" | "MANUAL",
      cutoffDateLabel: formatDate(snapshot.date),
      // updatedAt (không phải createdAt) — re-chốt cùng mốc ghi đè, cùng lý do
      // đã áp cho getManualSnapshotToday() ở trên.
      recordedAtLabel: `${formatDayMonth(snapshot.updatedAt)} ${formatTime(snapshot.updatedAt)}`,
    },
    holdings,
    recomputedComparison: recomputedComparison ?? undefined,
  };
}

// --- Biểu đồ NAV theo thời gian (mục 9 phase-6.md / 6a-6c UI_phase_6.md) ---

const NAV_TREND_PERIOD_DAYS: Record<Exclude<NavTrendPeriod, "ALL">, number> = {
  MONTH: 30,
  YEAR: 365,
};

// Chuỗi NAV toàn danh mục theo thời gian, đọc THUẦN từ Snapshot{holdingId:
// null, frozen: true} đã đóng băng (Phase 3, docs/domain/06-snapshots.md) —
// KHÔNG tạo snapshot mới, KHÔNG tính lại giá lịch sử ngoài những gì đã chốt.
// Nối thêm 1 điểm "hôm nay" ĐỘNG = `todayNavValue` do CALLER truyền vào (đã
// tính sẵn bằng getPortfolioValuation(), PortfolioOverviewSection) — KHÔNG tự
// gọi lại getPortfolioValuation() ở đây. Trước đây tự gọi riêng dẫn tới 2 vấn
// đề (code review #2/#6): (1) hero card dùng `getPortfolioValuation(selection)`
// còn điểm "hôm nay" hard-code `{key:"TODAY"}` — lệch số nếu selection khác
// TODAY; (2) mỗi lần tải Dashboard chạy nguyên pipeline valuation tới 4 lần
// (1 cho hero + 3 cho MONTH/YEAR/ALL). Truyền `todayNavValue` từ MỘT lần gọi
// duy nhất giải quyết cả hai. Điểm này KHÔNG lưu DB. Nếu đã có snapshot đóng
// băng đúng NGÀY hôm nay (vd vừa bấm "Chốt số liệu hôm nay"), KHÔNG nối thêm
// điểm động trùng ngày (tránh 2 điểm cùng ngày gây nhiễu chart).
//
// `changePercentFromStart` so với điểm ĐẦU danh sách ĐÃ LỌC theo kỳ (KHÁC
// `navDeltaPercent` ở NAV hero — đó là so với tổng vốn đã bỏ vào, không phải
// theo kỳ). `< 2 điểm` -> trả mảng rỗng/1 phần tử NGUYÊN VẸN, không tự xử lý
// nhánh rỗng ở đây (UI tự vẽ biến thể "chưa vẽ được đường NAV", 6b).
//
// Phần tính điểm/% (dedup frozen hôm nay, nối điểm động, changePercentFromStart)
// chuyển sang buildNavTrendSeries() (lib/nav-trend.ts, pure — issue #141) —
// hàm này giờ chỉ còn query DB + map Decimal rồi gọi hàm thuần đó, GIỮ NGUYÊN
// 100% chữ ký/hành vi output cho Dashboard (PortfolioOverviewSection.tsx vẫn
// gọi y hệt trước).
export async function getNavTrend(
  period: NavTrendPeriod,
  todayNavValue: string,
): Promise<{ points: NavTrendPoint[]; changePercent: number }> {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const now = new Date();
  const today = todayIctDateOnly(now);

  const frozen = await db.snapshot.findMany({
    where: {
      userId: session.user.id,
      holdingId: null,
      frozen: true,
      ...(period === "ALL"
        ? {}
        : {
            date: {
              gte: new Date(
                today.getTime() -
                  NAV_TREND_PERIOD_DAYS[period] * MILLIS_PER_DAY,
              ),
            },
          }),
    },
    orderBy: { date: "asc" },
    select: { date: true, value: true },
  });

  const rows = frozen.map((row) => ({
    date: row.date,
    value: new Decimal(row.value.toString()),
  }));

  return buildNavTrendSeries(rows, new Decimal(todayNavValue), today);
}

// --- Biểu đồ NAV theo LOẠI tài sản (route /nav-chart, issue #141, digest
// process/UI_nav-trend-by-asset-type.md) ---

// N mã, để trống ở phần điểm cuối kỳ high/low khi rỗng.
function lastPointValue(points: NavTrendPoint[]): string {
  return points[points.length - 1]?.value ?? "0";
}

// Cao nhất/thấp nhất kỳ (mockup 139c "Cao nhất kỳ"/"Thấp nhất kỳ") — undefined
// khi rỗng (không có gì để so sánh), KHÔNG trả "0"/"0" giả (dễ đọc nhầm thành
// giá trị thật).
function minMaxPointValue(
  points: NavTrendPoint[],
): { high: string; low: string } | undefined {
  if (points.length === 0) return undefined;

  let high = new Decimal(points[0]!.value);
  let low = high;
  for (const point of points) {
    const value = new Decimal(point.value);
    if (value.gt(high)) high = value;
    if (value.lt(low)) low = value;
  }

  return { high: high.toString(), low: low.toString() };
}

// Bọc minMaxPointValue() + computeSpreadPercent() thành 1 khối
// {periodHigh, periodLow, periodSpreadPercent} — dùng chung cho 4 loại tài sản
// cụ thể (buildAssetTypePeriodData()) VÀ nhánh ALL (vốn tái dùng getNavTrend(),
// không tự đi qua buildAssetTypePeriodData()) để tránh lặp lại cùng 3 dòng ở 2
// nơi. `{}` khi rỗng (không có periodHigh/periodLow/periodSpreadPercent nào).
function buildHighLow(
  points: NavTrendPoint[],
): Pick<
  NavTrendByAssetTypePeriodData,
  "periodHigh" | "periodLow" | "periodSpreadPercent"
> {
  const minMax = minMaxPointValue(points);
  if (!minMax) return {};
  return {
    periodHigh: minMax.high,
    periodLow: minMax.low,
    periodSpreadPercent: computeSpreadPercent(minMax.high, minMax.low),
  };
}

// Cắt `rows` (đã sort tăng dần theo date) theo kỳ, THUẦN Ở JS — KHÔNG query
// lại DB cho từng loại × từng kỳ (khác getNavTrend() ở trên, vốn lọc ngay
// trong Prisma `where`). Cùng ngưỡng NAV_TREND_PERIOD_DAYS/MILLIS_PER_DAY đã
// dùng cho getNavTrend() — giữ nhất quán định nghĩa "kỳ Tháng/Năm" giữa 2 màn.
function cutRowsByPeriod(
  rows: { date: Date; value: Decimal }[],
  period: NavTrendPeriod,
  today: Date,
): { date: Date; value: Decimal }[] {
  if (period === "ALL") return rows;
  const cutoffMillis =
    today.getTime() - NAV_TREND_PERIOD_DAYS[period] * MILLIS_PER_DAY;
  return rows.filter((row) => row.date.getTime() >= cutoffMillis);
}

function buildAssetTypePeriodData(
  rows: { date: Date; value: Decimal }[],
  todayValue: Decimal,
  today: Date,
  period: NavTrendPeriod,
): NavTrendByAssetTypePeriodData {
  const { points, changePercent } = buildNavTrendSeries(
    cutRowsByPeriod(rows, period, today),
    todayValue,
    today,
  );
  return {
    points,
    changePercent,
    navAmount: lastPointValue(points),
    ...buildHighLow(points),
  };
}

// Biến động NAV theo loại tài sản (route /nav-chart, issue #141) — preload sẵn
// 5 loại (ALL/STOCK/FUND/BOND/GOLD) × 3 kỳ (MONTH/YEAR/ALL) = 15 bộ trong ĐÚNG
// 2 round-trip DB (đọc snapshot per-holding + đọc distinct Holding.type), theo
// quyết định đã chốt ở process/decisions/pricing-and-valuation.md 2026-08-18
// ("gộp query ở tầng logic thay vì cache xuyên route Dashboard <-> /nav-chart").
//
// "ALL" (toàn danh mục) TÁI DÙNG thẳng getNavTrend() — CÙNG một hàm Dashboard
// đang gọi, không viết lại công thức lần 2 (tránh 2 nguồn tính NAV toàn danh
// mục lệch nhau giữa 2 màn, digest mục "Điểm cần xác nhận" #2).
export async function getNavTrendByAssetType(): Promise<{
  filters: AssetTypeFilterOption[];
  dataByFilter: Record<
    AssetTypeFilter,
    Record<NavTrendPeriod, NavTrendByAssetTypePeriodData>
  >;
}> {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const userId = session.user.id;

  const now = new Date();
  const today = todayIctDateOnly(now);

  const [perHoldingRows, todayNavByType, presentTypes] = await Promise.all([
    db.snapshot.findMany({
      where: { userId, holdingId: { not: null }, frozen: true },
      orderBy: { date: "asc" },
      select: {
        date: true,
        value: true,
        holding: { select: { type: true } },
      },
    }),
    computeTodayNavByType(),
    // KHÔNG dùng getOpenHoldings() — "chưa từng có vị thế" (139e) phải tính
    // trên CẢ holding đã đóng, không chỉ holding đang mở (một loại đã bán
    // sạch vẫn "đã từng có vị thế", chip filter vẫn phải bấm được).
    db.holding.findMany({
      where: { userId },
      select: { type: true },
      distinct: ["type"],
    }),
  ]);

  const rows = perHoldingRows.map((row) => ({
    date: row.date,
    value: new Decimal(row.value.toString()),
    // holding non-null: where đã lọc holdingId: { not: null } + Holding có
    // onDelete: Cascade trên Snapshot (schema.prisma) -> luôn tồn tại — cùng
    // pattern non-null assertion đã dùng ở getSnapshotDetail() trong file này.
    type: row.holding!.type,
  }));

  const groupedByType = groupSnapshotRowsByType(rows);

  const todayNavAll = ASSET_TYPE_ORDER.reduce(
    (sum, type) => sum.plus(todayNavByType.get(type) ?? new Decimal(0)),
    new Decimal(0),
  );

  const [navMonthAll, navYearAll, navAllAll] = await Promise.all([
    getNavTrend("MONTH", todayNavAll.toString()),
    getNavTrend("YEAR", todayNavAll.toString()),
    getNavTrend("ALL", todayNavAll.toString()),
  ]);

  const dataByFilter = {
    ALL: {
      MONTH: {
        points: navMonthAll.points,
        changePercent: navMonthAll.changePercent,
        navAmount: lastPointValue(navMonthAll.points),
        ...buildHighLow(navMonthAll.points),
      },
      YEAR: {
        points: navYearAll.points,
        changePercent: navYearAll.changePercent,
        navAmount: lastPointValue(navYearAll.points),
        ...buildHighLow(navYearAll.points),
      },
      ALL: {
        points: navAllAll.points,
        changePercent: navAllAll.changePercent,
        navAmount: lastPointValue(navAllAll.points),
        ...buildHighLow(navAllAll.points),
      },
    },
  } as Record<
    AssetTypeFilter,
    Record<NavTrendPeriod, NavTrendByAssetTypePeriodData>
  >;

  const presentTypeSet = new Set(presentTypes.map((row) => row.type));

  for (const type of ASSET_TYPE_ORDER) {
    const typeRows = groupedByType[type];
    const todayValue = todayNavByType.get(type) ?? new Decimal(0);

    dataByFilter[type] = {
      MONTH: buildAssetTypePeriodData(typeRows, todayValue, today, "MONTH"),
      YEAR: buildAssetTypePeriodData(typeRows, todayValue, today, "YEAR"),
      ALL: buildAssetTypePeriodData(typeRows, todayValue, today, "ALL"),
    };
  }

  const filters: AssetTypeFilterOption[] = [
    {
      type: "ALL",
      hasData: true,
      latestChangePercent: dataByFilter.ALL.YEAR.changePercent,
    },
    ...ASSET_TYPE_ORDER.map((type): AssetTypeFilterOption => {
      const hasData = presentTypeSet.has(type);
      return {
        type,
        hasData,
        latestChangePercent: hasData
          ? dataByFilter[type].YEAR.changePercent
          : undefined,
      };
    }),
  ];

  return { filters, dataByFilter };
}

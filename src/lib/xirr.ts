import Decimal from "decimal.js";
import xirr from "xirr";

// Một điểm dòng tiền đưa vào XIRR — amount đã mang dấu đúng quy ước
// (BUY/mua âm, SELL/bán + cổ tức + NAV giả định dương). Việc ghép dòng tiền
// giả định = NAV hiện tại cho vị thế còn mở (docs/domain/05 "Chưa bán vẫn
// tính được") là việc của tầng gọi (queries.ts) — hàm ở đây chỉ nhận mảng
// phẳng đã ghép sẵn, không tự suy luận vị thế đóng/mở.
export type CashflowPoint = {
  date: Date;
  amount: Decimal;
};

// Khớp nguyên văn ví dụ trong docs/rules/error-handling.md — "không tính
// được" là kết quả nghiệp vụ, KHÔNG throw. Chỉ có đúng 2 mã lý do trong toàn
// bộ codebase:
// - NO_POSITIVE_FLOW: thiếu 1 trong 2 dấu (thiếu âm HOẶC thiếu dương) — lỗi
//   cấu trúc chuỗi dòng tiền, phát hiện được trước khi tính.
// - NO_CONVERGE: chuỗi hợp lệ về dấu nhưng không giải được nghiệm (Newton-
//   Raphson lẫn bisection dự phòng đều thất bại), ví dụ toàn bộ dòng tiền
//   cùng 1 ngày.
export type XirrResult =
  | { ok: true; annualizedRate: Decimal }
  | { ok: false; reason: "NO_POSITIVE_FLOW" | "NO_CONVERGE" };

// Vài guess thay thế rẻ để thử trước khi rơi xuống bisection — README của
// thư viện "xirr" khuyến nghị đổi guess là cách xử lý chính khi Newton-
// Raphson không hội tụ (rẻ hơn nhiều so với dò bisection). Không cố khớp
// từng ca đặc biệt (vd guess sát -1 cho ca lỗ gần hết trong thời gian ngắn) —
// những ca đó để bisection xử lý vì nó luôn hội tụ nếu tồn tại nghiệm trong
// khoảng dò bên dưới.
const ALTERNATE_GUESSES = [0.1, 0.5, 1, -0.5, 2] as const;

// Bisection dự phòng — chỉ chạy khi thư viện xirr() (Newton-Raphson) đã thử
// hết guess mặc định + các guess thay thế mà vẫn throw.
//
// NPV dùng trong bisection neo tại date0 = dòng tiền SỚM NHẤT, đúng công
// thức trong docs/domain/05-returns-xirr-and-pnl.md "Cách tính":
//   Σ [ CFᵢ / (1+r)^((dateᵢ − date₀)/365) ] = 0
// trong khi xirr.js nội bộ neo tại dòng tiền MUỘN NHẤT. Hai cách neo cho
// cùng một nghiệm r: đổi mốc neo chỉ nhân toàn bộ NPV(r) với một hằng số
// (1+r)^((end−start)/365) khác 0 (khi r > -1) — không đổi điểm NPV(r)=0.
// Nhờ vậy bisection và Newton-Raphson của thư viện luôn tìm cùng 1 nghiệm
// nếu cả hai đều hội tụ (đã xác nhận bằng thực nghiệm trên ca "corona" ở
// xirr.test.ts — 2 cách neo ra cùng nghiệm tới 5 chữ số thập phân).
//
// Danh sách mốc dò cố tình chi tiết gần -1 (-0.9999, -0.999): một vị thế lỗ
// gần hết trong thời gian ngắn có nghiệm r rất sát -100%, danh sách thô hơn
// (dừng ở -0.99) sẽ bỏ lỡ khoảng đổi dấu và trả nhầm NO_CONVERGE.
const BISECTION_CANDIDATE_RATES = [
  -0.9999, -0.999, -0.99, -0.95, -0.9, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 1, 2,
  5, 10, 20, 50, 100, 1000,
] as const;
const BISECTION_MAX_ITERATIONS = 100;
const BISECTION_RATE_TOLERANCE = 1e-9;
const MILLIS_PER_DAY = 1000 * 60 * 60 * 24;
const DAYS_PER_YEAR = 365;

// docs/domain/05: "XIRR cần ít nhất một dòng tiền âm và một dòng tiền dương
// mới tính được". isNegative()/isPositive() loại trừ 0 ở cả 2 phía, nên
// chuỗi chỉ có [âm, 0] hay [dương, 0] cũng rơi vào NO_POSITIVE_FLOW — đúng ý
// nghĩa "0 không tính là dương". Điều này cũng loại bỏ trước ca thư viện
// xirr() trả về -1 không throw khi amount lớn nhất trong chuỗi = 0: vì ta đã
// yêu cầu có ít nhất 1 dòng THỰC SỰ dương trước khi gọi thư viện, amount lớn
// nhất truyền vào nó luôn > 0.
function hasValidSigns(points: CashflowPoint[]): boolean {
  const hasNegative = points.some((p) => p.amount.isNegative());
  const hasPositive = points.some((p) => p.amount.isPositive());
  return hasNegative && hasPositive;
}

// Thử thư viện xirr() (Newton-Raphson) với guess mặc định rồi lần lượt các
// guess thay thế. Trả null nếu tất cả đều throw hoặc ra kết quả không hữu
// hạn — không để throw lọt ra ngoài (docs/rules/error-handling.md).
function tryLibraryXirr(
  transactions: { when: Date; amount: number }[],
): number | null {
  const guesses: (number | undefined)[] = [undefined, ...ALTERNATE_GUESSES];
  for (const guess of guesses) {
    try {
      const rate = xirr(
        transactions,
        guess === undefined ? undefined : { guess },
      );
      if (Number.isFinite(rate)) return rate;
    } catch {
      // Newton-Raphson không hội tụ với guess này — thử guess tiếp theo;
      // hết danh sách vẫn lỗi thì computeXirr() rơi xuống bisection.
    }
  }
  return null;
}

// NPV(r) theo đúng công thức domain doc, neo tại dòng tiền sớm nhất — xem
// giải thích tương đương nghiệm ở comment BISECTION_CANDIDATE_RATES phía trên.
function buildNpvFunction(points: CashflowPoint[]): (rate: number) => number {
  const date0 = Math.min(...points.map((p) => p.date.getTime()));
  const flows = points.map((p) => ({
    amount: p.amount.toNumber(),
    years: (p.date.getTime() - date0) / MILLIS_PER_DAY / DAYS_PER_YEAR,
  }));
  return (rate: number): number =>
    flows.reduce((sum, f) => sum + f.amount / Math.pow(1 + rate, f.years), 0);
}

// Dò một khoảng [lo, hi] mà NPV đổi dấu bằng cách quét qua danh sách mốc lãi
// suất cố định (BISECTION_CANDIDATE_RATES) — hữu hạn nên luôn dừng, không
// phải vòng lặp mở rộng không giới hạn. Không tìm được khoảng đổi dấu -> trả
// null (KHÔNG throw) -> computeXirr() trả NO_CONVERGE.
function findSignChangeBracket(
  npv: (rate: number) => number,
): [number, number] | null {
  let prev: { rate: number; value: number } | null = null;
  for (const rate of BISECTION_CANDIDATE_RATES) {
    const value = npv(rate);
    if (value === 0) return [rate, rate];
    if (prev && Math.sign(value) !== Math.sign(prev.value)) {
      return [prev.rate, rate];
    }
    prev = { rate, value };
  }
  return null;
}

// Bisection chuẩn trên khoảng đã có đổi dấu — dừng khi khoảng đủ hẹp
// (BISECTION_RATE_TOLERANCE, theo thang lãi suất — không phụ thuộc quy mô
// tiền) hoặc chạm BISECTION_MAX_ITERATIONS; luôn trả về một giá trị hữu hạn,
// không throw, không lặp vô hạn.
function bisect(npv: (rate: number) => number, lo: number, hi: number): number {
  let a = lo;
  let b = hi;
  let npvA = npv(a);
  for (let i = 0; i < BISECTION_MAX_ITERATIONS; i++) {
    const mid = (a + b) / 2;
    if (Math.abs(b - a) < BISECTION_RATE_TOLERANCE) return mid;
    const npvMid = npv(mid);
    if (npvMid === 0) return mid;
    if (Math.sign(npvMid) === Math.sign(npvA)) {
      a = mid;
      npvA = npvMid;
    } else {
      b = mid;
    }
  }
  return (a + b) / 2;
}

function tryBisectionXirr(points: CashflowPoint[]): number | null {
  const npv = buildNpvFunction(points);
  const bracket = findSignChangeBracket(npv);
  if (!bracket) return null;

  const rate = bisect(npv, bracket[0], bracket[1]);
  return Number.isFinite(rate) ? rate : null;
}

// XIRR — nghiệm r của Σ [ CFᵢ / (1+r)^((dateᵢ−date₀)/365) ] = 0
// (docs/domain/05-returns-xirr-and-pnl.md "Cách tính"). Lai (hybrid) Newton-
// Raphson (thư viện "xirr", vài guess) + bisection dự phòng, KHÔNG bao giờ
// throw hay âm thầm trả -100%/NaN cho một chuỗi dòng tiền không giải được —
// luôn trả XirrResult (docs/rules/error-handling.md). Luôn là tỷ suất theo
// năm dù kỳ dài hay ngắn — "theo năm" tự thể hiện qua tên field
// annualizedRate, nhãn hiển thị "theo năm" cho UI là việc của tầng UI.
export function computeXirr(points: CashflowPoint[]): XirrResult {
  if (!hasValidSigns(points)) {
    return { ok: false, reason: "NO_POSITIVE_FLOW" };
  }

  const transactions = points.map((p) => ({
    when: p.date,
    amount: p.amount.toNumber(),
  }));

  const rate = tryLibraryXirr(transactions) ?? tryBisectionXirr(points);

  if (rate === null) {
    return { ok: false, reason: "NO_CONVERGE" };
  }

  return { ok: true, annualizedRate: new Decimal(rate) };
}

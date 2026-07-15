import { describe, expect, test } from "vitest";

import { resolveCutoffDate, todayIctDateOnly } from "./cutoff";

// Mọi assertion dùng toISOString() (UTC tuyệt đối) thay vì getFullYear()/
// getHours() v.v. — các getter đó đọc theo timezone LOCAL của máy chạy test,
// không deterministic giữa máy dev (thường giờ VN) và CI (thường UTC). Neo
// theo giờ ICT (UTC+7, không DST): 23:59:59.999 ICT = 16:59:59.999Z cùng
// ngày dương lịch ICT.
describe("resolveCutoffDate — neo theo giờ Việt Nam (Asia/Ho_Chi_Minh), không phụ thuộc timezone server", () => {
  test("TODAY -> cuối ngày ICT khi now nằm giữa ngày ICT (input UTC buổi sáng, chưa lệch ngày)", () => {
    const now = new Date("2026-07-12T08:30:00Z"); // 15:30 ICT cùng ngày 12/07
    const resolved = resolveCutoffDate({ key: "TODAY" }, now);

    expect(resolved.toISOString()).toBe("2026-07-12T16:59:59.999Z");
  });

  test("TODAY -> now rơi vào khung UTC 17:00–23:59 (00:00–06:59 ICT NGÀY HÔM SAU) phải tính là ngày hôm sau theo ICT", () => {
    // 2026-07-12T18:00:00Z = 2026-07-13T01:00 ICT -> "hôm nay" theo ICT là
    // 13/07, không phải 12/07 (đây chính là ca bug UTC/ICT cần fix).
    const now = new Date("2026-07-12T18:00:00Z");
    const resolved = resolveCutoffDate({ key: "TODAY" }, now);

    expect(resolved.toISOString()).toBe("2026-07-13T16:59:59.999Z");
  });

  test("TODAY -> now đúng biên 23:59:59.999Z (06:59:59.999 ICT hôm sau) vẫn thuộc ngày hôm sau theo ICT", () => {
    const now = new Date("2026-07-12T23:59:59.999Z");
    const resolved = resolveCutoffDate({ key: "TODAY" }, now);

    expect(resolved.toISOString()).toBe("2026-07-13T16:59:59.999Z");
  });

  test("TODAY -> now đúng biên 17:00:00.000Z (00:00:00.000 ICT hôm sau) đã sang ngày mới theo ICT", () => {
    const now = new Date("2026-07-12T17:00:00.000Z");
    const resolved = resolveCutoffDate({ key: "TODAY" }, now);

    expect(resolved.toISOString()).toBe("2026-07-13T16:59:59.999Z");
  });

  test("TODAY -> now đúng biên 16:59:59.999Z (23:59:59.999 ICT cùng ngày) vẫn thuộc ngày hiện tại", () => {
    const now = new Date("2026-07-12T16:59:59.999Z");
    const resolved = resolveCutoffDate({ key: "TODAY" }, now);

    expect(resolved.toISOString()).toBe("2026-07-12T16:59:59.999Z");
  });

  test("END_OF_MONTH -> ngày cuối cùng của tháng theo ICT (tháng 2 nhuận)", () => {
    const now = new Date("2028-02-10T20:00:00Z"); // 2028-02-11 03:00 ICT — vẫn tháng 2
    const resolved = resolveCutoffDate({ key: "END_OF_MONTH" }, now);

    expect(resolved.toISOString()).toBe("2028-02-29T16:59:59.999Z");
  });

  test("END_OF_MONTH -> tháng 12 vẫn đúng năm hiện tại, không tràn qua năm sau", () => {
    const now = new Date("2026-12-15T00:00:00Z");
    const resolved = resolveCutoffDate({ key: "END_OF_MONTH" }, now);

    expect(resolved.toISOString()).toBe("2026-12-31T16:59:59.999Z");
  });

  test("END_OF_YEAR -> 31/12 cuối ngày ICT của năm hiện tại", () => {
    const now = new Date("2026-03-01T00:00:00Z");
    const resolved = resolveCutoffDate({ key: "END_OF_YEAR" }, now);

    expect(resolved.toISOString()).toBe("2026-12-31T16:59:59.999Z");
  });

  test("END_OF_YEAR -> now rơi vào khung UTC cuối 31/12 (đã sang 01/01 năm sau theo ICT) phải trả về 31/12 năm SAU", () => {
    // 2026-12-31T18:00:00Z = 2027-01-01 01:00 ICT -> "năm hiện tại" theo ICT
    // là 2027, không phải 2026.
    const now = new Date("2026-12-31T18:00:00Z");
    const resolved = resolveCutoffDate({ key: "END_OF_YEAR" }, now);

    expect(resolved.toISOString()).toBe("2027-12-31T16:59:59.999Z");
  });

  test("CUSTOM -> cuối ngày ICT của date truyền vào, không phụ thuộc now", () => {
    const now = new Date("2026-07-12T00:00:00Z");
    const custom = new Date("2025-01-15T09:00:00Z"); // 16:00 ICT cùng ngày 15/01
    const resolved = resolveCutoffDate({ key: "CUSTOM", date: custom }, now);

    expect(resolved.toISOString()).toBe("2025-01-15T16:59:59.999Z");
  });

  test("CUSTOM -> date truyền vào rơi vào khung UTC cuối ngày (đã sang ngày mới theo ICT) vẫn tính đúng theo ICT", () => {
    const now = new Date("2026-07-12T00:00:00Z");
    const custom = new Date("2025-01-15T19:00:00Z"); // 2025-01-16 02:00 ICT
    const resolved = resolveCutoffDate({ key: "CUSTOM", date: custom }, now);

    expect(resolved.toISOString()).toBe("2025-01-16T16:59:59.999Z");
  });

  test("không truyền now -> mặc định dùng thời điểm hệ thống hiện tại (không throw, trả về Date hợp lệ)", () => {
    const resolved = resolveCutoffDate({ key: "TODAY" });

    expect(resolved).toBeInstanceOf(Date);
    expect(Number.isNaN(resolved.getTime())).toBe(false);
  });
});

// Dùng cho khóa ghi/đọc Snapshot{period: MANUAL} — Snapshot.date là TIMESTAMP(3)
// (KHÔNG @db.Date), dedup theo GIÁ TRỊ CHÍNH XÁC nên hàm phải ổn định tuyệt
// đối trong cùng 1 ngày ICT (cùng input -> cùng output, gọi lại nhiều lần
// không lệch giờ/phút/giây).
describe("todayIctDateOnly — 00:00:00.000 UTC của đúng ngày dương lịch ICT, ổn định để dedup theo (holdingId|userId, date, period)", () => {
  test("now nằm giữa ngày ICT (input UTC buổi sáng, chưa lệch ngày) -> 00:00 UTC cùng ngày", () => {
    const now = new Date("2026-07-12T08:30:00Z"); // 15:30 ICT cùng ngày 12/07
    const resolved = todayIctDateOnly(now);

    expect(resolved.toISOString()).toBe("2026-07-12T00:00:00.000Z");
  });

  test("now rơi vào khung UTC 17:00–23:59 (00:00–06:59 ICT NGÀY HÔM SAU) phải tính là ngày hôm sau theo ICT", () => {
    // 2026-07-12T18:00:00Z = 2026-07-13T01:00 ICT.
    const now = new Date("2026-07-12T18:00:00Z");
    const resolved = todayIctDateOnly(now);

    expect(resolved.toISOString()).toBe("2026-07-13T00:00:00.000Z");
  });

  test("biên 17:00:00.000Z (00:00:00.000 ICT hôm sau) đã sang ngày mới theo ICT", () => {
    const now = new Date("2026-07-12T17:00:00.000Z");
    const resolved = todayIctDateOnly(now);

    expect(resolved.toISOString()).toBe("2026-07-13T00:00:00.000Z");
  });

  test("biên 16:59:59.999Z (23:59:59.999 ICT cùng ngày) vẫn thuộc ngày hiện tại", () => {
    const now = new Date("2026-07-12T16:59:59.999Z");
    const resolved = todayIctDateOnly(now);

    expect(resolved.toISOString()).toBe("2026-07-12T00:00:00.000Z");
  });

  test("gọi 2 lần với cùng input (kể cả 2 instant khác nhau cùng ngày ICT) trả về cùng giá trị — idempotent theo ngày", () => {
    const morning = new Date("2026-07-12T01:00:00Z"); // 08:00 ICT
    const evening = new Date("2026-07-12T16:00:00Z"); // 23:00 ICT, vẫn cùng ngày ICT

    expect(todayIctDateOnly(morning).toISOString()).toBe(
      todayIctDateOnly(evening).toISOString(),
    );
  });

  test("không truyền now -> mặc định dùng thời điểm hệ thống hiện tại (không throw, trả về Date hợp lệ)", () => {
    const resolved = todayIctDateOnly();

    expect(resolved).toBeInstanceOf(Date);
    expect(Number.isNaN(resolved.getTime())).toBe(false);
  });
});

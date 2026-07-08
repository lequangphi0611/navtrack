# Phase 2 — Lõi XIRR + giá tự động

## Mục tiêu
Có định giá thị trường (NAV) và hai chỉ số hiệu quả: **XIRR (theo năm)** + **lãi/lỗ tuyệt đối**. Tích hợp giá tự động từ vnstock.

## Công việc cần làm
- [ ] Model `PriceQuote` (`symbol`, `date`, `price`, `source`, `@@unique([symbol, date])`) + migration
- [ ] Job **Python + vnstock** (`jobs/price-fetcher/`) chạy trên GitHub Actions, upsert `PriceQuote`; secrets ở GitHub Secrets
- [ ] Định giá `Holding` tại ngày D: ưu tiên `NavOverride` → nếu không có, `PriceQuote` gần nhất ≤ D
- [ ] `NavOverride` cho vàng/trái phiếu (nhập tay); nhãn nguồn giá (tự động/nhập tay)
- [ ] `lib/xirr.ts` — **lai**: thư viện + lớp bọc (validate dấu dòng tiền, bắt không hội tụ, gắn nhãn "theo năm")
- [ ] Ghép dòng tiền giả định = NAV tại mốc chốt (runtime, không lưu); mốc: hôm nay / cuối tháng / cuối năm / tùy chỉnh
- [ ] Dashboard hiển thị **song song** XIRR (theo năm) + lãi/lỗ tuyệt đối
- [ ] Unit test XIRR **đối chiếu Google Sheets** + ca biên (không hội tụ, thiếu giá)

## Tiêu chí hoàn thành
- [ ] XIRR khớp kết quả Excel/Google Sheets trên bộ dữ liệu mẫu
- [ ] "Không tính được" trả trạng thái rõ ràng, **không** âm thầm −100%/NaN
- [ ] Job Python chạy theo lịch, ghi giá vào `PriceQuote`; app đọc để định giá
- [ ] Đổi mốc chốt → XIRR tính lại đúng theo NAV mốc đó

## Phụ thuộc / ghi chú
- Cần Phase 1 (Holding/Cashflow) xong. Thuế khi bán chưa áp ở đây (Phase 5) — có thể để `taxAmount = 0` tạm.

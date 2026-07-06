# Quyết định nền tảng (business foundation)

Các quyết định dưới đây được chốt qua trao đổi trực tiếp, làm cơ sở cho thiết kế kỹ thuật.

| # | Chủ đề | Quyết định | Lý do / hệ quả |
|---|---|---|---|
| 1 | Mục đích sản phẩm | Dùng cá nhân, không bán/không SaaS | Dùng được `vnstock` bản miễn phí, không cần xin license thương mại |
| 2 | Phạm vi MVP (loại tài sản) | Cổ phiếu, quỹ mở, trái phiếu, vàng — cả 4 loại ngay từ v1 | Khớp hoàn toàn với Google Sheets hiện tại, tránh phải mở rộng schema giữa chừng |
| 3 | Hạ tầng | Cloud free/giá rẻ (Vercel/Railway/Supabase hoặc VPS rẻ) | Truy cập được từ điện thoại lẫn máy tính, chi phí tối thiểu |
| 4 | Import dữ liệu cũ | Cần import toàn bộ lịch sử giao dịch từ Sheet (CSV/Excel) | Tránh phải nhập tay lại nhiều năm dữ liệu; ưu tiên xây sớm |
| 5 | Cổ tức | Ghi nhận riêng biệt (tiền mặt và cổ phiếu) | Cổ tức tiền mặt là dòng tiền dương ảnh hưởng XIRR; cổ tức cổ phiếu tăng số lượng nắm giữ mà không phát sinh dòng tiền — cần model riêng, không gộp vào giao dịch mua/bán |
| 6 | Thuế | Tự động tính thuế khi bán, hiển thị lãi/lỗ sau thuế | Phản ánh đúng lợi nhuận thực nhận thay vì lãi/lỗ gộp |
| 7 | Tần suất snapshot | Chỉ tháng/năm (giữ nguyên thiết kế gốc) | Đủ cho nhu cầu theo dõi xu hướng cá nhân, không cần cron chạy dày hơn |
| 8 | Tính năng mở rộng ưu tiên v1 | Biểu đồ NAV theo thời gian + biểu đồ phân bổ tài sản | Hai tính năng trực quan hóa quan trọng nhất để thay thế Sheet; các tính năng khác (benchmark, export, cảnh báo giá, what-if) để sau |

## Còn cần làm rõ thêm (khi bắt tay vào chi tiết)

- **Thuế:** thuế suất cụ thể áp dụng cho từng loại tài sản (vd cổ phiếu VN thường 0.1% trên giá trị bán — cần xác nhận đây có phải mức đang áp dụng không; quỹ mở/trái phiếu/vàng có áp thuế tương tự không hay khác cách tính).
- **Vàng:** nguồn giá SJC dự phòng nếu API chính của `vnstock` lỗi (đã ghi nhận từng có lỗi 403 ở một nhánh trong hệ sinh thái).
- **Timeline:** chưa xác định mốc thời gian mong muốn hoàn thành từng phase.

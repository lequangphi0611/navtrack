# Navtrack — Tổng quan

## Bài toán

Tôi đang quản lý toàn bộ tiền đầu tư của mình — cổ phiếu, quỹ mở, trái phiếu, vàng — bằng một file Google Sheets tự dựng. Nó chạy được, nhưng càng ngày càng đuối:

- **Không biết mình thực sự lãi hay lỗ bao nhiêu.** Sheet cho tôi thấy giá trị tài sản hôm nay, nhưng tôi đã bỏ tiền vào nhiều lần, ở nhiều thời điểm khác nhau, có lần rút ra một phần. Cộng trừ tay thì ra được "lãi tuyệt đối", nhưng con số đó không nói lên tôi đầu tư *hiệu quả* tới đâu — bỏ 100 triệu lời 10 triệu trong 3 năm khác hẳn lời 10 triệu trong 3 tháng.
- **So sánh giữa các khoản đầu tư rất khó.** Một mã tôi mua rải trong 2 năm, một mã tôi mua một lần rồi để yên — không có cách nào công bằng để nói cái nào "ngon" hơn.
- **Nhập liệu thủ công, dễ sai.** Mỗi lần mua/bán tôi phải tự gõ, tự kéo công thức, tự cập nhật giá. Vàng và trái phiếu thì càng cực vì không có giá tự động.
- **Nhìn lại lịch sử thì mù mờ.** Cuối năm muốn biết "năm nay danh mục tăng trưởng bao nhiêu" thì phải bới lại từng dòng, và giá trong Sheet đã bị ghi đè theo giá mới nên số cũ không còn chính xác.

Tóm lại: tôi có dữ liệu, nhưng không có **câu trả lời** cho câu hỏi quan trọng nhất — *tiền của tôi đang sinh lời tốt tới mức nào, và tôi có đang làm tốt hơn nếu chỉ gửi tiết kiệm không?*

## Navtrack giải quyết điều đó thế nào

Navtrack là một web app cá nhân thay thế cái Sheet đó. Mục tiêu duy nhất: trả lời rõ ràng, trung thực câu hỏi *"tôi đang lãi/lỗ bao nhiêu, và hiệu quả tới đâu"* — mọi lúc, cho từng khoản và cho cả danh mục.

### 1. Trả lời "lãi/lỗ bao nhiêu" theo hai cách bổ sung cho nhau

- **Lãi/lỗ bằng tiền:** đơn giản, dễ hiểu — hiện tại tài sản đáng bao nhiêu trừ đi tổng tiền tôi đã bỏ vào.
- **Tỷ suất sinh lời theo năm:** con số quan trọng nhất. Nó tính đến việc tôi bỏ tiền vào *khi nào* và *bao nhiêu mỗi lần*, rồi quy về một tỷ lệ % mỗi năm — để tôi so sánh được táo với táo. Con số này luôn có nhãn rõ "theo năm" để tôi không nhầm một khoản lời ngắn hạn thành hiệu quả cả năm.

### 2. Biết cả khi chưa bán

Tôi không phải bán mới biết mình lời — Navtrack lấy giá trị thị trường hiện tại của những gì tôi đang giữ để tính như thể chốt sổ hôm nay. Tôi chọn được mốc chốt: hôm nay, cuối tháng, hay cuối năm.

### 3. Số liệu quá khứ được "đóng băng", không bị bóp méo

Khi một tháng hoặc một năm khép lại, Navtrack chụp lại giá trị danh mục tại đúng thời điểm đó và giữ nguyên. Sau này giá có đổi thế nào, báo cáo tháng cũ vẫn đúng như lúc nó xảy ra — điều mà Sheet không làm được.

### 4. Không phải gõ lại từ đầu

Toàn bộ lịch sử nhiều năm trong Sheet hiện tại sẽ được nạp vào một lần, nên tôi không mất công nhập tay lại.

### 5. Xử lý đúng những thứ Sheet làm ẩu

- **Cổ tức** được ghi nhận riêng: cổ tức tiền mặt được tính như một khoản sinh lời thật, cổ tức bằng cổ phiếu thì tự cộng thêm số lượng tôi đang giữ.
- **Thuế** được tự động trừ khi tôi bán, để con số lãi/lỗ là số tôi *thực nhận*, không phải số trên giấy.
- **Vàng và trái phiếu** — những thứ không có giá tự động đáng tin — tôi được phép nhập tay giá, và app ghi rõ số nào là tự động, số nào tôi tự nhập.

### 6. Nhìn là hiểu

Hai biểu đồ trả lời hai câu hỏi tôi hay hỏi nhất:
- **Danh mục của tôi đang lớn lên hay co lại?** — đường giá trị tài sản theo thời gian.
- **Tiền của tôi đang nằm ở đâu?** — tỷ trọng cổ phiếu / quỹ / trái phiếu / vàng.

## Ai dùng

Chỉ mình tôi (và có thể người nhà). Đây là công cụ cá nhân, không phải sản phẩm để bán — nên không có phần đăng ký, thanh toán, hay hỗ trợ nhiều người dùng.

## Ranh giới — cái này *không* làm

- Không phải app đặt lệnh mua/bán — nó chỉ theo dõi, không giao dịch.
- Không tư vấn nên mua gì bán gì.
- Không cố realtime từng giây — cập nhật giá theo ngày là đủ.

## Điều còn cần chốt

- **Mức thuế cụ thể** cho từng loại tài sản khi bán (cần xác nhận con số đang áp dụng).
- **Nguồn giá vàng dự phòng** cho trường hợp nguồn tự động trục trặc.
- **Thời điểm mong muốn** hoàn thành từng phần.

---

*Chi tiết kỹ thuật (cấu trúc dữ liệu, thứ tự triển khai) nằm ở [`02-data-model.md`](./02-data-model.md) và [`03-roadmap.md`](./03-roadmap.md).*

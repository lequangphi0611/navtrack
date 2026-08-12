---
name: claude-design-prompt
description: Soạn prompt cho Claude Design để dựng mockup UI của một phase/màn mới trong Navtrack — chắt lọc nghiệp vụ từ `process/phase-x.md` + `docs/domain/*`, ràng buộc hệ thiết kế sẵn có (token màu, IBM Plex, icon), liệt kê đủ màn + biến thể trạng thái dễ hiểu sai, kèm số liệu VND thật. Dùng khi user nói "viết prompt cho Claude Design", "cần mockup cho phase N", "thiết kế UI cho màn X", hoặc khi chuẩn bị làm một phase có UI mới mà `process/UI_phase_N.md` chưa có. Cũng dùng khi user muốn cải thiện/viết lại một prompt design đã có.
---

# Claude Design Prompt — soạn brief thiết kế cho Navtrack

Skill này tạo **prompt** để mang sang Claude Design, không tạo mockup và không dựng component. Kết quả cuối là một khối text user copy thẳng sang Claude Design project của họ.

Vị trí trong chuỗi công việc: `phase-x.md` (spec) → **skill này** (brief thiết kế) → Claude Design (mockup) → `design-fetcher` (digest `process/UI_phase_N.md`) → `design-implementer` (component thật). Skill này chỉ lo mắt xích thứ hai.

## Vì sao brief tự do lại cho mockup kém

Claude Design vẽ theo đúng những gì brief mô tả. Ba kiểu brief hay hỏng:

- **Brief chỉ liệt kê field** ("form có mệnh giá, lãi suất, ngày đáo hạn") → ra một form generic không ai nhìn ra đây là app tài chính, và không có trạng thái nào ngoài happy path.
- **Brief mô tả layout pixel** ("card bo góc 16px, padding 24, tiêu đề 18px semibold") → tự trói tay designer vào bố cục mình đã tưởng tượng, mất hết giá trị của việc nhờ thiết kế.
- **Brief không nói nghiệp vụ** → designer không biết con số nào quan trọng, cái gì dễ bị hiểu nhầm, nên nhấn mạnh sai chỗ.

Điểm ngọt nằm ở giữa: **nói rõ nghiệp vụ và ràng buộc hệ thiết kế, để trống bố cục**. Designer cần biết *vì sao* một con số quan trọng thì mới quyết được nó to hay nhỏ, đặt đâu, có cần giải thích kèm không.

## Bước 1 — Thu thập bối cảnh

Đọc theo thứ tự, dừng khi đã đủ trả lời "màn này giải quyết chuyện gì cho người dùng":

1. `process/phase-x.md` của phase liên quan — mục "Công việc cần làm" phần Design & UI, và **"Tiêu chí hoàn thành"** (tiêu chí thường lộ ra thứ UI phải truyền đạt được).
2. `docs/domain/*` mà phase đụng tới — đây là nguồn của các luật dễ hiểu sai. Chú ý riêng mục **"Ca biên"** của mỗi file: ca biên thường chính là biến thể màn hình cần vẽ.
3. `process/DECISION.md` — index quyết định mới chốt, nhất là quyết định *đảo* hướng cũ (cột trạng thái `S` = Superseded chỉ thẳng ra chúng); mở file chi tiết trong `process/decisions/` cho chủ đề của phase. Nếu vừa có quyết định đảo, mockup cũ (nếu có) đã lỗi thời và brief phải nói rõ điều đó.
4. `docs/rules/ui-ux-design.md` — token màu, typography, icon. Chắt lấy phần **liên quan tới phase này** để nhét vào khối "Hệ thiết kế", đừng chép cả file.
5. Component đã có trong `src/features/*/components` và `src/components` — quyết định màn nào là *mở rộng cái đã có* (brief nên nói "mở rộng form X hiện có") và màn nào là *hoàn toàn mới*.
6. `process/UI_phase_*.md` của các phase trước — xem ngôn ngữ thiết kế đã dùng cho tình huống tương tự, để brief nhắc lại tiền lệ thay vì đẻ ra pattern mới.

Nếu phase chưa rõ phạm vi UI, hỏi user trước khi viết — đoán sai phạm vi thì cả mockup lẫn issue Design & UI đi lệch.

## Bước 2 — Xác định danh sách màn

Một màn xứng đáng có mục riêng trong brief khi nó **đổi kết quả người dùng thấy**, không phải khi nó đổi vài dòng chữ.

Ba nhóm cần rà cho đủ:

- **Màn chính**: mỗi hành động người dùng thực hiện là một màn.
- **Biến thể gây hiểu nhầm**: cùng một màn nhưng dữ liệu khác ra kết quả khác hẳn, và người dùng dễ tưởng app tính sai. Ví dụ đã gặp: thuế bằng 0 vì luật miễn (chứ không phải app quên cấu hình); có thuế khi tưởng không có. Những biến thể này **đáng vẽ riêng** — chúng là chỗ UI phải làm việc truyền đạt nhiều nhất.
- **Trạng thái rỗng / cảnh báo / chặn**: thiếu dữ liệu bắt buộc thì màn hình nói gì, dẫn người dùng đi đâu.

Đặt tên màn theo mã ngắn (`7a`, `7b`...) để về sau digest, issue và mockup tham chiếu nhau được.

## Bước 3 — Viết prompt theo cấu trúc này

Cấu trúc dưới đây đã dùng thật và cho mockup bám sát nghiệp vụ. Giữ thứ tự — ràng buộc hệ thiết kế đặt trước để designer không phải quay lại sửa màu/chữ sau khi đã bố cục.

```
Thiết kế màn hình cho <Phase N> của Navtrack — <một câu app là gì>, tiếng Việt,
mobile-first, dark mode.

## Hệ thiết kế đang dùng (giữ nguyên, không đề xuất hệ mới)
<token màu liên quan tới phase này + ngữ nghĩa; font chữ vs font số; icon set;
định dạng tiền và ngày>

## Bối cảnh nghiệp vụ (cần cho việc thiết kế đúng)
<phase này bổ sung việc gì, 2-4 gạch đầu dòng>
<những luật người dùng dễ hiểu sai — nêu thẳng "phải thể hiện rõ trên UI vì
người dùng dễ hiểu sai">

## Màn hình cần thiết kế
**<mã> — <tên màn>**
<một đoạn: màn này để làm gì, field/dữ liệu gì, KHÁC BIỆT QUAN TRỌNG so với màn
đã có, số liệu mẫu thật>
(lặp cho từng màn)

## Trạng thái phải vẽ kèm
<rỗng / cảnh báo / chặn>

## Lưu ý nhất quán với các phase trước
<tiền lệ ngôn ngữ thiết kế đã dùng, nêu kèm màn cũ để designer tra được>
```

## Nguyên tắc viết từng khối

**Số liệu phải thật.** Dùng số VND thật, có nghĩa, tính đúng theo công thức domain — `9.000.000 ₫` chứ không phải `X ₫` hay `1.234`. Designer canh cỡ chữ và độ rộng cột theo độ dài số thật; số giả cho ra bố cục vỡ khi vào dữ liệu thật. Nếu một màn có phép tính, viết cả chuỗi tính (`gộp 9.000.000 → thuế 5% −450.000 → thực nhận 8.550.000`) để designer thấy quan hệ giữa các con số.

**Mỗi màn nêu "khác biệt quan trọng", không mô tả layout.** Câu đắt giá nhất trong brief thường có dạng "form này KHÔNG hỏi X; thay vào đó hiện Y chỉ-đọc" — nó nói cho designer biết điều gì làm màn này khác với cái họ sẽ mặc định vẽ ra.

**Giải thích vì sao một biến thể quan trọng.** Thay vì "vẽ thêm màn thuế bằng 0", viết "màn này quan trọng nhất về mặt truyền đạt — cần làm người dùng hiểu ngay vì sao có/không có thuế". Designer sẽ tự quyết cách nhấn.

**Nhắc tiền lệ, đừng phát minh lại.** Nếu app đã có cách xử lý tình huống tương tự, nêu rõ kèm màn cũ ("đã là tiền lệ ở màn bán vàng: thuế 0% vẫn hiện rõ 0 ₫ kèm badge lý do, không ẩn thẻ đi"). Nhất quán giữa các phase quan trọng hơn tối ưu cục bộ từng màn.

**Chốt những gì không được đổi.** Câu "giữ nguyên, không đề xuất hệ mới" ở đầu khối hệ thiết kế tiết kiệm một vòng qua lại — nếu không nói, designer hay tự đề xuất bảng màu mới.

**Đừng nhét cả domain doc vào.** Brief cần *kết luận* nghiệp vụ ("lãi trái phiếu Chính phủ được miễn thuế"), không cần đường đi tới kết luận (số hiệu nghị định chỉ nêu khi nó xuất hiện trên UI dưới dạng badge).

## Bước 4 — Bàn giao

1. Đưa prompt cho user trong một khối code liền mạch để copy thẳng — không chèn bình luận vào giữa.
2. Nếu phase đã có issue Design & UI, **comment prompt lên issue đó** (`gh issue comment <số> --body-file <file>`), kèm một dòng nói rõ: sau khi có mockup thì chạy `design-fetcher` sinh `process/UI_phase_N.md` rồi mới implement. Như vậy người/agent nhận issue không phải đi tìm brief.
3. Nhắc user: mockup xong thì quay lại để chạy `design-fetcher` — skill này không tự kéo mockup về.

## Không làm

- Không tự gọi `DesignSync` để "thiết kế thay" — skill này dừng ở brief. Việc kéo mockup về là của `design-fetcher` (và của phiên chính khi subagent bị chặn, xem `process/decisions/agent-workflow-and-tooling.md` 2026-07-18).
- Không dựng component, không viết `process/UI_phase_N.md` — đó là digest hậu-mockup, không phải brief tiền-mockup.
- Không chốt thay quyết định nghiệp vụ còn treo. Nếu phase còn điểm mở ảnh hưởng UI, nêu **cả hai phương án** trong brief và ghi rõ là chưa chốt, để mockup làm đầu vào cho quyết định thay vì âm thầm quyết hộ.
- Không mô tả bố cục pixel, không áp cỡ chữ/khoảng cách cụ thể.

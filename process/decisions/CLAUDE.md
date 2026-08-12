# Quy ước ghi quyết định (scoped)

File này áp dụng cho mọi thao tác trong `process/decisions/`. Index nằm ở [`../DECISION.md`](../DECISION.md).

> ⚠️ File CLAUDE.md lồng nhau chỉ **tự nạp khi Claude thật sự mở một file trong thư mục này**. Nó KHÔNG phải cơ chế để phát hiện ra thư mục tồn tại — việc đó do `CLAUDE.md` gốc và `../DECISION.md` trỏ tường minh (cùng cách `e2e/CLAUDE.md` đang hoạt động). Đừng chuyển luật "khi nào đọc quyết định nào" vào đây.

## Khi nào ghi một entry mới

Ghi khi quyết định **thay đổi business / domain / spec / data model / rules**, hoặc root-cause một lỗi non-obvious mà code không tự giải thích được. Không ghi tiến độ thường (việc đó ở `../PROCESS.md`) và không ghi lại thứ mà `docs/rules/*` đã nói đủ.

## Ghi vào file nào

Chọn theo **chủ đề nghiệp vụ**, khớp `docs/domain/*` — bảng đầy đủ ở [`../DECISION.md`](../DECISION.md) mục "Bản đồ chủ đề". Nguyên tắc:

- Một quyết định chạm nhiều chủ đề → đặt **trọn vẹn ở chủ đề chính**, không cắt nhỏ ra nhiều file. Các file còn lại chỉ thêm một dòng ở mục "Quyết định liên quan ở file khác" cuối file.
- Không tạo file chủ đề mới trừ khi đã có ≥2 quyết định thật không thuộc file nào — thêm file rỗng chỉ làm bản đồ khó nhớ hơn.
- Quyết định về `Setting` đi theo chủ đề dùng key đó, không gom thành file riêng.

## Định dạng một entry

```markdown
## <YYYY-MM-DD> [(n)] — <tiêu đề ngắn, một dòng>

**Status:** Accepted
<hoặc> **Status:** Superseded bởi <ngày entry mới> — <lý do một câu>

**<Câu tóm tắt quyết định, in đậm — đây là dòng sẽ copy sang index.>**
- Bối cảnh: <vì sao phát sinh, số liệu thật nếu có>
- Quyết định: <chốt cái gì, và **vì sao** — lý do quan trọng hơn nội dung>
- <ca biên / điểm cố ý không làm / giới hạn đã biết>
- Docs đã sync: <danh sách file đã cập nhật cùng lần>
```

Bắt buộc:

- **Mốc ngày là định danh, không đổi sang số ADR.** Trùng ngày thì thêm `(2)`, `(3)`… Comment trong `src/` trỏ theo ngày (`// process/DECISION.md 2026-07-12`) nên đổi định danh sẽ phá ~40 citation.
- **`Status` tường minh.** Khi một quyết định bị đảo: entry cũ đổi thành `Superseded bởi <ngày>`, entry mới ghi `supersedes <ngày>`. Đừng chỉ viết `"→ ĐÃ SỬA ở ..."` trong thân bài — `Status` là thứ greppable để `curator` biết mục nào rút gọn được.
- **Cập nhật index `../DECISION.md` trong cùng lần sửa** — thêm 1 dòng vào bảng đúng chủ đề, và cập nhật "Việc còn treo" nếu entry để lại việc treo. Index lệch với file chi tiết là hỏng đúng cái cơ chế 2 tầng này phục vụ.

## Giữ file chi tiết không phình

Mỗi entry chỉ giữ phần **không suy ra được từ code hoặc `docs/*`**: lý do, phương án đã loại và vì sao, ca hỏng cụ thể, giới hạn chấp nhận. Phần "cái gì đã làm" thuộc về code và docs.

Khi một quyết định đã thành rule ổn định trong `docs/rules/*` hoặc đã được code + test bảo vệ, entry tương ứng **rút gọn còn 2-3 dòng** (giữ ngày, kết luận, link tới rule). Việc dọn định kỳ là của agent `curator` — xem `.claude/agents/curator.md`.

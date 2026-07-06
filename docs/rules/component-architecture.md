# Component architecture

Quy tắc tổ chức component cho Navtrack (Next.js App Router + shadcn/ui). Áp dụng Atomic Design **thực dụng** + Container/Presentational qua Server Component.

## Ánh xạ Atomic Design (thực dụng)

- **Atoms** = primitives của shadcn/ui, đặt ở `components/ui/`.
- **Molecules** = tổ hợp nhỏ vài atoms (vd một field có label + input + error).
- **Organisms** = khối theo tính năng (vd bảng giao dịch, thẻ tổng quan danh mục).
- **Pages** = route của Next.js. **Bỏ tầng templates.**
- Nhóm theo **feature trước, atomic bên trong**: đặt molecules/organisms của một tính năng trong `features/<feature>/components/` thay vì một cây atomic thuần toàn cục. Chỉ đưa lên `components/` chung khi thực sự dùng lại ở nhiều feature.

## Server Component & Container/Presentational

- **Mặc định là Server Component.** Chỉ thêm `"use client"` khi cần: tương tác, hook state/effect, hoặc browser API.
- **Container = Server Component** lấy data **qua các hàm trong `queries.ts`** (không gọi Prisma trực tiếp trong page/component — xem `data-prisma.md`), rồi truyền props thuần xuống.
- **Presentational component thuần**: chỉ nhận props và hiển thị. **Không** fetch data, **không** truy cập DB trực tiếp. Có thể là server hoặc client tùy nhu cầu tương tác.
- **Đẩy ranh giới client xuống lá:** giữ tương tác trong client component nhỏ; giữ page/organism ở server khi có thể.
- Dùng **Server Actions** cho mutation (submit form) thay vì gọi API route từ client, khi có thể.

## Quy ước component

- Mỗi component một file. Subcomponent chỉ dùng nội bộ thì colocate trong cùng file.
- **Không sửa trực tiếp** file shadcn sinh ra trong `components/ui/`. Cần tùy biến thì **bọc** (wrap) lại thành component mới.
- Mỗi component khai báo **`Props` bằng `type` tường minh** (không `interface`, không inline anonymous).
- Hạn chế prop drilling; ưu tiên composition (`children`). Dùng context tiết chế, chỉ cho state thực sự xuyên nhiều tầng.

## Loading, skeleton & Suspense

- Hai cơ chế, hai vai:
  - **`loading.tsx`** = fallback của **cả route** khi điều hướng tới lần đầu. Dùng cho **khung trang** (page shell) với skeleton khớp layout thật, không dùng spinner chung chung.
  - **`Suspense` riêng cho từng vùng data** = bên trong trang, bọc mỗi component load data độc lập trong một `Suspense` **riêng, tách nhỏ** — không gộp mọi thứ vào một boundary lớn. Mục tiêu: vùng nào xong trước hiển thị trước, không chờ nhau.
  - Nói ngắn: `loading.tsx` lo lần tải đầu của trang; `Suspense` nhỏ lo stream từng widget data bên trong.
- Mỗi vùng có Suspense phải có **`fallback` skeleton riêng** phản ánh đúng hình dạng nội dung sắp hiện.
- Đặt skeleton cạnh component nó phục vụ (colocate), tái dùng khung của chính component để skeleton luôn khớp.
- Trạng thái **empty** là lời mời hành động (vd "Chưa có giao dịch — thêm giao dịch đầu tiên"), không để trống trơn. Trạng thái **error** nói rõ chuyện gì và cách xử lý.

## Đặc thù Navtrack

- Format tiền/số qua **helper dùng chung** (`lib/format.ts`) ở tầng presentational; helper nhận cờ privacy và tôn trọng chế độ **ẩn số tiền** — ẩn **mọi giá trị tiền tuyệt đối bằng VND** (NAV, lãi/lỗ, giá vốn...), **giữ** phần trăm (XIRR, tỷ trọng) và số lượng cổ phần.
- Trạng thái ẩn số tiền lấy từ hai nguồn: mặc định từ `User.hideAmountsByDefault` (đọc phía server), và một client toggle bật/tắt nhanh (lưu tạm client, vd context/cookie). Container truyền cờ này xuống, không để từng leaf component tự đọc.
- Biểu đồ Recharts là **client component (organism)**; data đưa vào qua props từ một container Server Component, biểu đồ không tự fetch.

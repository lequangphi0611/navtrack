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
- **Container = Server Component** chịu trách nhiệm lấy data (qua Prisma hoặc server action) và truyền props thuần xuống.
- **Presentational component thuần**: chỉ nhận props và hiển thị. **Không** fetch data, **không** truy cập DB trực tiếp. Có thể là server hoặc client tùy nhu cầu tương tác.
- **Đẩy ranh giới client xuống lá:** giữ tương tác trong client component nhỏ; giữ page/organism ở server khi có thể.
- Dùng **Server Actions** cho mutation (submit form) thay vì gọi API route từ client, khi có thể.

## Quy ước component

- Mỗi component một file. Subcomponent chỉ dùng nội bộ thì colocate trong cùng file.
- **Không sửa trực tiếp** file shadcn sinh ra trong `components/ui/`. Cần tùy biến thì **bọc** (wrap) lại thành component mới.
- Mỗi component khai báo **`Props` type/interface tường minh**; không dùng inline anonymous type cho props.
- Hạn chế prop drilling; ưu tiên composition (`children`). Dùng context tiết chế, chỉ cho state thực sự xuyên nhiều tầng.

## Loading, skeleton & Suspense

- **Mỗi route có `loading.tsx`** với skeleton **khớp layout thật** của trang (không dùng spinner chung chung).
- **Mỗi component load data bọc `Suspense` riêng**, tách nhỏ — không gộp mọi thứ vào một boundary lớn. Mục tiêu: phần dữ liệu nào xong trước hiển thị trước, không chờ nhau.
- Mỗi vùng có Suspense phải có **`fallback` skeleton riêng** phản ánh đúng hình dạng nội dung sắp hiện.
- Đặt skeleton cạnh component nó phục vụ (colocate), tái dùng khung của chính component để skeleton luôn khớp.
- Trạng thái **empty** là lời mời hành động (vd "Chưa có giao dịch — thêm giao dịch đầu tiên"), không để trống trơn. Trạng thái **error** nói rõ chuyện gì và cách xử lý.

## Đặc thù Navtrack

- Format tiền/số qua **helper dùng chung** ở tầng presentational; helper phải tôn trọng chế độ **ẩn số tiền** (privacy mode) — ẩn giá trị tiền tuyệt đối, giữ phần trăm.
- Biểu đồ Recharts là **client component (organism)**; data đưa vào qua props từ một container Server Component, biểu đồ không tự fetch.

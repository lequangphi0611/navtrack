# TypeScript & code style

Quy tắc nền cho mọi file TypeScript trong Navtrack.

- Bật **TS strict**; tránh `any`. Khi chưa rõ kiểu, dùng `unknown` + narrowing.
- Dùng **named export** (không default export), trừ nơi Next bắt buộc default (`page.tsx`, `layout.tsx`, `error.tsx`...).
- Dùng `type` mặc định cho object/union; chỉ dùng `interface` khi cần extend công khai.
- Khai **explicit return type** cho hàm export; để inference lo biến cục bộ.
- Tất cả định danh, comment, commit message bằng **tiếng Anh**. Giữ nguyên thuật ngữ nghiệp vụ (XIRR, NAV, cashflow, dividend...).
- Đặt tên: component `PascalCase`, biến/hàm `camelCase`, hằng thật `UPPER_SNAKE`, type `PascalCase`.
- **File đặt kebab-case** (vd `holding-table.tsx`, `format.ts`).
- Ưu tiên `const`; dùng `let` chỉ khi reassign; không `var`. Dùng `async/await`, không chuỗi `.then()`.
- **Suy type từ zod** bằng `z.infer` để không khai trùng kiểu ở tầng validate và TS.
- Comment giải thích **"tại sao"**, không mô tả "cái gì"; giữ tối thiểu.
- Không mutate props/state trực tiếp; ưu tiên bất biến (readonly/spread).
- Không để biến/import thừa (lint chặn).

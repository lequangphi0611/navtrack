---
name: Refactor / tech debt
about: Dọn code, tách nhỏ, sửa cấu trúc — không đổi hành vi cho người dùng
title: "[Refactor] "
labels: refactor
assignees: ""
---

## Khu vực cần refactor

<!-- File/thư mục/feature liên quan. -->

## Vấn đề hiện tại

<!-- Code smell cụ thể: trùng lặp, component quá dài, vi phạm rule nào ở docs/rules/*,
     khó test, khó mở rộng... Trích dẫn rule nếu có (vd "vi phạm 'page phải mỏng' ở component-architecture.md"). -->

## Đề xuất thay đổi

<!-- Cấu trúc mới dự kiến — tách thành component/hàm nào, đổi tên gì. -->

## Rủi ro / phạm vi ảnh hưởng

<!-- Feature/route nào có thể bị ảnh hưởng; có cần thêm test trước khi refactor không
     (đổi hành vi ẩn ý ngoài dự kiến là rủi ro lớn nhất của refactor). -->

## Tiêu chí hoàn thành

- [ ] Hành vi người dùng không đổi (verify bằng test hiện có + `/verify` nếu chạm runtime)
- [ ] `pnpm typecheck && pnpm lint && pnpm test` pass
- [ ] Cập nhật `docs/rules/*` nếu refactor này đổi/thêm quy ước mới

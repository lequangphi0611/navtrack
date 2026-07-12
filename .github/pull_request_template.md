## Tóm tắt

<!-- 1-3 gạch đầu dòng: đổi gì và tại sao (why quan trọng hơn what). -->

-

## Loại thay đổi

- [ ] Bug fix
- [ ] Feature mới
- [ ] Refactor (không đổi hành vi)
- [ ] Docs / rules
- [ ] Chore (deps, config, CI...)

## Liên quan

<!-- Closes #... / Relates to #... -->

## Test plan

- [ ] `pnpm typecheck` pass
- [ ] `pnpm lint` pass
- [ ] `pnpm test` (unit) pass
- [ ] `pnpm build` pass
- [ ] `pnpm e2e` pass (luôn chạy — đảm bảo thay đổi không phá vỡ luồng chính, kể cả PR không có vẻ đụng UI)
- [ ] Tự tay chạy thử luồng chính trong app (không chỉ tin vào test) — mô tả ngắn đã thử gì:

## Ảnh chụp màn hình

<!-- Bắt buộc nếu đổi UI — before/after. Xoá mục này nếu PR không đụng UI. -->

## Đồng bộ tài liệu

<!-- Theo quy ước ở CLAUDE.md: quyết định quan trọng đổi business/domain/data model/rules
     phải phản ánh đầy đủ vào docs liên quan trong cùng PR này. -->

- [ ] PR này **không** chạm business/domain/data model/rules — bỏ qua mục dưới
- [ ] Đã cập nhật docs liên quan: `docs/domain/*` / `docs/02-data-model.md` / `docs/rules/*` / `docs/03-roadmap.md`
- [ ] Đã ghi quyết định + lý do vào `process/DECISION.md` (nếu là quyết định quan trọng, không phải chỉ tiến độ)

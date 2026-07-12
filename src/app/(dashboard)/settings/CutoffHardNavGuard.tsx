"use client";

import { useEffect } from "react";

// Next.js <Link> (dùng trong CutoffPicker) intercept click và soft-navigate
// qua fetch RSC. Route Handler /api/cutoff redirect NGƯỢC LẠI đúng URL hiện
// tại (/settings -> /settings) — verify thủ công (Playwright, cả headless lẫn
// headed) cho thấy Next.js App Router coi đây là "cùng segment, không đổi gì"
// nên bỏ qua re-render hoàn toàn: URL/cookie vẫn cập nhật đúng (network trace +
// context.cookies() xác nhận), nhưng option vừa chọn KHÔNG hiện active tới khi
// f5 thủ công — kể cả sau router.refresh() (effect không refire vì cây React
// không remount). Đây là giới hạn của Next.js Client Router Cache với đúng
// pattern "Link -> Route Handler -> redirect về chính URL đang đứng", không
// phải bug ở cookie/query logic (đã verify riêng: điều hướng thẳng
// /api/cutoff?key=... bằng URL bar hoặc reload thủ công đều phản ánh đúng).
//
// Guard nhỏ, phạm vi hẹp: chỉ ép hard navigation (bỏ qua Link soft-nav) cho
// đúng các link trỏ /api/cutoff — không đụng CutoffPicker/SettingsScreen
// (Presentational, ngoài phạm vi sửa). Tôn trọng modifier keys/middle-click
// (mở tab mới) như hành vi mặc định của thẻ <a>.
export function CutoffHardNavGuard() {
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const anchor = (event.target as HTMLElement | null)?.closest(
        "a[href^='/api/cutoff']",
      );
      if (
        !(anchor instanceof HTMLAnchorElement) ||
        anchor.target === "_blank"
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      window.location.href = anchor.href;
    }

    // Capture phase: chạy TRƯỚC handler onClick nội bộ của next/link (bubble
    // phase) để chặn soft-navigation trước khi nó kịp intercept.
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  return null;
}

"use client";

import { useState, useTransition } from "react";

import { setHideAmountsByDefault } from "@/features/settings/actions";

import { DashboardScreen, type DashboardScreenProps } from "./DashboardScreen";

type DashboardScreenClientProps = Omit<
  DashboardScreenProps,
  "hidden" | "onToggleHidden"
> & {
  // Giá trị đọc từ User.hideAmountsByDefault (server) — khởi tạo state local,
  // KHÔNG phải nguồn sự thật liên tục (mục 8/11 phase-6.md, process/DECISION.md
  // 2026-07-21 mục (1)): nút mắt ghi optimistic ngay + gọi Server Action trong
  // startTransition để persist, không cần Context toàn app (mỗi route tự đọc
  // lại DB khi load).
  initialHidden: boolean;
};

// Client wrapper DUY NHẤT cho toàn bộ cây DashboardScreen (mục 11 phase-6.md) —
// KHÔNG tách Suspense riêng cho NavTrendChart bên trong (xem ghi chú kiến trúc ở
// PortfolioOverviewSection): mọi dữ liệu money-value trong DashboardScreen đều
// là PROPS thuần (không phải children Server Component đã render sẵn), nên khi
// `hidden` đổi, toàn bộ cây re-render đúng — nếu tách Suspense con, phần đó sẽ
// "đông cứng" ở giá trị hidden lúc stream, không phản ứng lại nút mắt nữa.
function DashboardScreenClient({
  initialHidden,
  ...rest
}: DashboardScreenClientProps) {
  const [hidden, setHidden] = useState(initialHidden);
  const [, startTransition] = useTransition();

  const handleToggleHidden = () => {
    setHidden((previous) => {
      const next = !previous;
      startTransition(() => {
        void setHideAmountsByDefault(next);
      });
      return next;
    });
  };

  return (
    <DashboardScreen
      {...rest}
      hidden={hidden}
      onToggleHidden={handleToggleHidden}
    />
  );
}

export { DashboardScreenClient };
export type { DashboardScreenClientProps };

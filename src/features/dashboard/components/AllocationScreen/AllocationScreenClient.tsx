"use client";

import { useState, useTransition } from "react";

import { setHideAmountsByDefault } from "@/features/settings/actions";

import {
  AllocationScreen,
  type AllocationScreenProps,
} from "./AllocationScreen";

type AllocationScreenClientProps = Omit<
  AllocationScreenProps,
  "hidden" | "onToggleHidden"
> & {
  // Đọc từ User.hideAmountsByDefault (server) — khởi tạo state local, cùng
  // pattern StockAllocationDetailClient (process/DECISION.md 2026-07-21 mục
  // (1)).
  initialHidden: boolean;
};

// Client wrapper DUY NHẤT của AllocationScreen (organism, KHÔNG được "use
// client" — component-architecture.md "Cấm 'use client' ở *Screen") — giữ
// state `hidden` cục bộ, persist qua Server Action giống
// StockAllocationDetailClient (issue #130,
// process/UI_allocation-group-pnl.md).
function AllocationScreenClient({
  initialHidden,
  ...rest
}: AllocationScreenClientProps) {
  const [hidden, setHidden] = useState(initialHidden);
  const [, startTransition] = useTransition();

  const handleToggleHidden = () => {
    // startTransition ở TOP-LEVEL handler (không lồng trong updater của
    // setHidden) — cùng lý do đã ghi ở StockAllocationDetailClient.tsx (tránh
    // "Cannot call startTransition while rendering").
    const previous = hidden;
    const next = !previous;
    setHidden(next);
    startTransition(() => {
      void setHideAmountsByDefault(next)
        .then((result) => {
          if (!result.ok) setHidden(previous);
        })
        .catch(() => {
          setHidden(previous);
        });
    });
  };

  return (
    <AllocationScreen
      {...rest}
      hidden={hidden}
      onToggleHidden={handleToggleHidden}
    />
  );
}

export { AllocationScreenClient };
export type { AllocationScreenClientProps };

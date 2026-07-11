"use client";

import { useState } from "react";

import { SegmentedControl } from "@/components/SegmentedControl";

type HoldingsTab = "open" | "closed";

type HoldingsTabsProps = {
  // Nội dung hai tab server-render sẵn, client chỉ chọn tab nào hiển thị —
  // tab không active không được mount (tránh lộ nội dung trong accessibility tree).
  openContent: React.ReactNode;
  closedContent: React.ReactNode;
};

function HoldingsTabs({ openContent, closedContent }: HoldingsTabsProps) {
  const [tab, setTab] = useState<HoldingsTab>("open");

  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl
        options={[
          { value: "open", label: "Đang mở" },
          { value: "closed", label: "Đã đóng" },
        ]}
        value={tab}
        onChange={setTab}
        className="self-start bg-card"
      />
      {/* key theo tab để re-mount → chạy lại animation mỗi lần đổi tab */}
      <div
        key={tab}
        className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-200"
      >
        {tab === "open" ? openContent : closedContent}
      </div>
    </div>
  );
}

export { HoldingsTabs };
export type { HoldingsTabsProps };

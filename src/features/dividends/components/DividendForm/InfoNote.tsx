import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type InfoNoteProps = {
  icon: LucideIcon;
  iconClassName: string;
  // Toàn bộ class khung ngoài (border/nền/animation) — CASH và STOCK khác cả
  // tông màu lẫn có/không animation vào (motion-safe:*), để caller tự quyết
  // định thay vì đoán chung một tổ hợp.
  containerClassName: string;
  children: React.ReactNode;
};

// Alert cuối trang (icon + đoạn text) — CASH "net ghi làm dòng tiền dương" /
// STOCK "không phát sinh dòng tiền", cùng shape khác tông + câu chữ.
function InfoNote({
  icon: Icon,
  iconClassName,
  containerClassName,
  children,
}: InfoNoteProps) {
  return (
    <div
      className={cn("flex gap-2.25 rounded-xl border p-3", containerClassName)}
    >
      <Icon className={cn("mt-0.5 size-4.25 shrink-0", iconClassName)} />
      <div className="text-[11.5px] leading-relaxed text-muted-foreground">
        {children}
      </div>
    </div>
  );
}

export { InfoNote };

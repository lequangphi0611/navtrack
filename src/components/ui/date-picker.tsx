"use client";

import { Popover } from "@base-ui/react/popover";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { DayPicker } from "react-day-picker";

import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type DatePickerProps = {
  name: string;
  value: string; // yyyy-MM-dd, rỗng = chưa chọn
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
};

// yyyy-MM-dd -> Date theo giờ local. KHÔNG dùng `new Date(value)` trực tiếp —
// parse chuỗi ISO ngày-only mặc định coi là UTC midnight, lệch sang ngày hôm
// trước ở timezone âm so với UTC (vd UTC-7). Tách tay để luôn khớp đúng ô
// ngày hiển thị trên lịch theo giờ local trình duyệt.
function parseDateValue(value: string): Date | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

function toDateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Thay thế `<input type="date">` native — Safari iOS thật không cho style lại
// control ngày/giờ native đầy đủ (quirk WebKit đã biết, PR #71-73 fix CSS
// không giải quyết được). Dựng UI ngày tự vẽ bằng Popover (@base-ui/react,
// cùng pattern sheet.tsx bọc Dialog) + react-day-picker, không phụ thuộc
// control native của trình duyệt nữa.
//
// API controlled + hidden input giữ nguyên contract FormData
// (`formData.get(name)`) — Server Action không cần đổi gì.
function DatePicker({
  name,
  value,
  onChange,
  placeholder = "Chọn ngày",
  required,
  disabled,
  className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = parseDateValue(value);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <input type="hidden" name={name} value={value} required={required} />
      <Popover.Trigger
        type="button"
        disabled={disabled}
        className={cn(
          "flex h-11 w-full items-center justify-between rounded-xl border border-input bg-card px-3 text-base font-mono font-semibold text-foreground outline-none transition-colors md:text-sm focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/18 disabled:pointer-events-none disabled:opacity-50",
          !value && "font-normal text-muted-faint",
          className,
        )}
      >
        <span>{value ? formatDate(value) : placeholder}</span>
        <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8} align="start">
          <Popover.Popup className="z-50 rounded-2xl border border-border bg-card p-3 shadow-lg outline-none motion-safe:duration-150 motion-safe:data-[open]:animate-in motion-safe:data-[open]:fade-in motion-safe:data-[open]:zoom-in-95 motion-safe:data-[closed]:animate-out motion-safe:data-[closed]:fade-out motion-safe:data-[closed]:zoom-out-95">
            <DayPicker
              mode="single"
              selected={selected}
              defaultMonth={selected}
              showOutsideDays
              onSelect={(date) => {
                if (!date) return;
                onChange(toDateValue(date));
                setOpen(false);
              }}
              components={{
                Chevron: ({ orientation, className: chevronClassName }) =>
                  orientation === "left" ? (
                    <ChevronLeft className={cn("size-4", chevronClassName)} />
                  ) : (
                    <ChevronRight className={cn("size-4", chevronClassName)} />
                  ),
              }}
              classNames={{
                root: "font-mono text-foreground",
                months: "flex flex-col",
                month: "flex flex-col gap-3",
                month_caption: "relative flex items-center justify-center pt-1",
                caption_label: "text-sm font-semibold",
                nav: "absolute inset-x-0 top-1 flex items-center justify-between",
                button_previous:
                  "flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/8 hover:text-foreground disabled:opacity-30",
                button_next:
                  "flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/8 hover:text-foreground disabled:opacity-30",
                month_grid: "mt-2 border-collapse",
                weekday:
                  "w-9 pb-1 text-center text-[11px] font-medium text-muted-faint",
                day: "p-0 text-center align-middle",
                day_button:
                  "mx-auto flex size-9 items-center justify-center rounded-lg text-sm font-normal text-foreground transition-colors hover:bg-white/8",
                selected:
                  "[&>button]:bg-primary [&>button]:font-semibold [&>button]:text-primary-foreground [&>button]:hover:bg-primary/90",
                today: "[&>button]:border [&>button]:border-primary/50",
                outside: "[&>button]:text-muted-faint/50",
                disabled:
                  "[&>button]:pointer-events-none [&>button]:opacity-30",
              }}
            />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

export { DatePicker };
export type { DatePickerProps };

"use client";

import { cn } from "@/lib/utils";

type SegmentedControlOption<T extends string> = {
  value: T;
  label: string;
  // Class cho label khi option đang active (vd "text-primary-foreground" trên thumb màu) — mặc định text-foreground.
  activeClassName?: string;
};

type SegmentedControlProps<T extends string> = {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  // Class cho thanh trượt — mặc định bg-secondary; parent đổi màu theo value (vd Mua/Bán → gain/destructive).
  thumbClassName?: string;
  // true = track full width, các option chia đều (mockup 2e); false = co theo nội dung (mặc định).
  stretch?: boolean;
  className?: string;
};

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  thumbClassName,
  stretch = false,
  className,
}: SegmentedControlProps<T>) {
  // Nguồn duy nhất cho cả thanh trượt lẫn trạng thái highlight của label —
  // tránh hai chỗ tự tính activeIndex rồi lệch nhau khi value không khớp option nào.
  const activeIndex = options.findIndex((option) => option.value === value);
  const segmentWidth = 100 / options.length;

  return (
    <div
      className={cn(
        "relative inline-flex rounded-xl bg-background p-0.75",
        stretch && "flex w-full",
        className,
      )}
    >
      {activeIndex >= 0 ? (
        <div
          className={cn(
            "absolute top-0.75 bottom-0.75 rounded-lg transition-[left,background-color] duration-250 ease-in-out",
            thumbClassName ?? "bg-secondary",
          )}
          style={{
            left: `${activeIndex * segmentWidth}%`,
            width: `calc(${segmentWidth}% - 2px)`,
          }}
        />
      ) : null}
      {options.map((option, index) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "relative px-4.5 py-1.5 text-[13px] font-semibold transition-colors",
            stretch && "flex-1 px-2",
            index === activeIndex
              ? (option.activeClassName ?? "text-foreground")
              : "text-muted-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export { SegmentedControl };
export type { SegmentedControlProps, SegmentedControlOption };

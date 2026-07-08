"use client";

import { cn } from "@/lib/utils";

type SegmentedControlOption<T extends string> = {
  value: T;
  label: string;
};

type SegmentedControlProps<T extends string> = {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  const activeIndex = Math.max(
    options.findIndex((option) => option.value === value),
    0,
  );
  const segmentWidth = 100 / options.length;

  return (
    <div
      className={cn(
        "relative inline-flex rounded-xl bg-background p-0.75",
        className,
      )}
    >
      <div
        className="absolute top-0.75 bottom-0.75 rounded-lg bg-secondary transition-[left] duration-250 ease-in-out"
        style={{
          left: `${activeIndex * segmentWidth}%`,
          width: `calc(${segmentWidth}% - 2px)`,
        }}
      />
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "relative px-4.5 py-1.5 text-[13px] font-semibold transition-colors",
            option.value === value
              ? "text-foreground"
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

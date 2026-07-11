"use client";

import { Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";

type MoneyValueToggleButtonProps = {
  hidden: boolean;
  onToggleHidden: () => void;
  className?: string;
};

function MoneyValueToggleButton({
  hidden,
  onToggleHidden,
  className,
}: MoneyValueToggleButtonProps) {
  const Icon = hidden ? EyeOff : Eye;

  return (
    <button
      type="button"
      onClick={onToggleHidden}
      aria-label={hidden ? "Hiện số tiền" : "Ẩn số tiền"}
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-white/5 text-muted-foreground transition-colors hover:text-foreground",
        className,
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}

export { MoneyValueToggleButton };

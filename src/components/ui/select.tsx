import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

// Native <select> styled — không dùng @base-ui/react/select vì bản listbox tuỳ biến
// quá nặng cho nhu cầu hiện tại; native giữ nguyên form semantics (name/value) và a11y.
function Select({
  className,
  children,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        data-slot="select"
        className={cn(
          "h-9 w-full min-w-0 appearance-none rounded-lg border border-input bg-card px-3 pr-9 text-base md:text-sm text-foreground outline-none transition-colors focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/18 disabled:pointer-events-none disabled:opacity-50",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-faint" />
    </div>
  );
}

export { Select };

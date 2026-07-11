import { cn } from "@/lib/utils";

import { LogoMark } from "./LogoMark";

type LogoProps = {
  variant?: "horizontal" | "vertical";
  size?: "sm" | "md" | "lg";
  className?: string;
};

const MARK_SIZE: Record<NonNullable<LogoProps["size"]>, number> = {
  sm: 36,
  md: 48,
  lg: 54,
};

const TEXT_CLASS: Record<NonNullable<LogoProps["size"]>, string> = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-[26px]",
};

function Logo({ variant = "horizontal", size = "md", className }: LogoProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3.5",
        variant === "vertical" && "flex-col gap-3",
        className,
      )}
    >
      <LogoMark size={MARK_SIZE[size]} />
      <span
        className={cn(
          "font-semibold tracking-tight text-foreground",
          TEXT_CLASS[size],
        )}
      >
        Navtrack
      </span>
    </div>
  );
}

export { Logo };
export type { LogoProps };

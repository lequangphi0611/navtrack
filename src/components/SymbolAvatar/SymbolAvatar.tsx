import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

import { getSymbolColorClassName } from "./symbol-color";

type SymbolAvatarProps = {
  symbol: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZE_CLASS: Record<NonNullable<SymbolAvatarProps["size"]>, string> = {
  sm: "size-9 text-[11px]",
  md: "size-10 text-[13px]",
  lg: "size-11 text-sm",
};

function SymbolAvatar({ symbol, size = "md", className }: SymbolAvatarProps) {
  const initials = symbol.slice(0, 4).toUpperCase();

  return (
    <Avatar
      className={cn(
        SIZE_CLASS[size],
        getSymbolColorClassName(symbol),
        className,
      )}
    >
      <AvatarFallback className="font-mono font-semibold">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}

export { SymbolAvatar };
export type { SymbolAvatarProps };

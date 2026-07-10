import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type UserAvatarProps = {
  // Tên hiển thị hoặc email — initials suy ra từ 2 từ đầu (hoặc 2 ký tự đầu).
  name: string;
  size?: "sm" | "md";
  className?: string;
};

const SIZE_CLASS: Record<
  NonNullable<UserAvatarProps["size"]>,
  { root: string; text: string }
> = {
  sm: { root: "size-9", text: "text-[13px]" },
  md: { root: "size-10", text: "text-[15px]" },
};

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0]?.[0] ?? ""}${words[words.length - 1]?.[0] ?? ""}`.toUpperCase();
  }
  return name.trim().slice(0, 2).toUpperCase();
}

function UserAvatar({ name, size = "md", className }: UserAvatarProps) {
  return (
    <Avatar
      className={cn(
        SIZE_CLASS[size].root,
        "rounded-[30%] border border-border bg-linear-to-br from-secondary to-card text-foreground-soft",
        className,
      )}
    >
      <AvatarFallback className={cn("font-semibold", SIZE_CLASS[size].text)}>
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

export { UserAvatar };
export type { UserAvatarProps };

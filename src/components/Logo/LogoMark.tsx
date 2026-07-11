import { cn } from "@/lib/utils";

type LogoMarkProps = {
  size?: number;
  className?: string;
};

// Gradient hardcode (không qua CSS token): mark thương hiệu cố định, không đổi theo theme.
function LogoMark({ size = 36, className }: LogoMarkProps) {
  const iconSize = Math.round(size * 0.56);

  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-[30%]",
        className,
      )}
      style={{
        width: size,
        height: size,
        background: "linear-gradient(150deg, #8b9bff, #2fc6ad)",
      }}
    >
      <svg width={iconSize} height={iconSize} viewBox="0 0 100 100">
        <path d="M50 16 L27 82 L50 67 Z" fill="#07080b" fillOpacity={0.92} />
        <path d="M50 16 L73 82 L50 67 Z" fill="#07080b" fillOpacity={0.6} />
      </svg>
    </div>
  );
}

export { LogoMark };
export type { LogoMarkProps };

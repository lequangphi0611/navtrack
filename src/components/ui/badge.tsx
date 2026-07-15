import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap [&_svg]:pointer-events-none [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary/14 text-primary",
        gain: "bg-gain/14 text-gain",
        destructive: "bg-destructive/14 text-destructive",
        warning: "bg-warning/14 text-warning",
        neutral: "bg-muted text-muted-foreground",
        // Teal thật (token accent) — dùng cho badge "CUỐI NĂM" (mockup Phase 3 Screens
        // 3a/3e), khác với "default" (primary/indigo, dùng cho "ĐỊNH KỲ").
        accent: "bg-accent/14 text-accent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

type Props = React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>;

function Badge({ className, variant = "default", ...props }: Props) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant, className }))}
      {...props}
    />
  );
}

export { Badge, badgeVariants };

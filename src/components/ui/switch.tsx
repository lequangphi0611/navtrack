import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "@/lib/utils";

// Atom mới (mục 11 phase-6.md) — bọc @base-ui/react/switch (có sẵn subpath
// tương ứng, xem docs/rules/ui-ux-design.md "Primitives"), cùng convention
// button.tsx: primitive Base UI + cn() cho style, KHÔNG cva vì chỉ 1 biến thể
// hiện tại (không cần variants).
function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "relative inline-flex h-6.5 w-11.5 shrink-0 items-center rounded-full bg-secondary transition-colors outline-none data-[checked]:bg-primary focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-5 translate-x-1 rounded-full bg-white shadow transition-transform data-[checked]:translate-x-5.5"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };

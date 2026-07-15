import { Dialog } from "@base-ui/react/dialog";

import { cn } from "@/lib/utils";

// Bottom sheet — bọc @base-ui/react/dialog (Root/Trigger/Portal/Backdrop/Popup/
// Close), style cố định đáy màn hình (mockup Phase 3 Screens, 3b). Animation
// dựa vào data-open/data-closed mà Base UI tự gắn lên Popup/Backdrop khi mở/đóng
// (xem @base-ui/react/utils/popupStateMapping — cặp key đúng cho animation dạng
// keyframe như tw-animate-css `animate-in`/`animate-out`, khác data-starting-style/
// data-ending-style vốn dành cho CSS transition thuần).
function Sheet(props: Dialog.Root.Props) {
  return <Dialog.Root {...props} />;
}

function SheetTrigger({ className, ...props }: Dialog.Trigger.Props) {
  return (
    <Dialog.Trigger
      data-slot="sheet-trigger"
      className={className}
      {...props}
    />
  );
}

function SheetPopup({ className, children, ...props }: Dialog.Popup.Props) {
  return (
    <Dialog.Portal>
      <Dialog.Backdrop
        data-slot="sheet-backdrop"
        className="fixed inset-0 z-50 bg-black/60 motion-safe:duration-300 motion-safe:data-[open]:animate-in motion-safe:data-[open]:fade-in motion-safe:data-[closed]:animate-out motion-safe:data-[closed]:fade-out"
      />
      <Dialog.Popup
        data-slot="sheet-popup"
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl border-t border-border bg-card p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] outline-none motion-safe:duration-300 motion-safe:data-[open]:animate-in motion-safe:data-[open]:slide-in-from-bottom motion-safe:data-[closed]:animate-out motion-safe:data-[closed]:slide-out-to-bottom",
          className,
        )}
        {...props}
      >
        <div className="mx-auto mb-4 h-1 w-9 shrink-0 rounded-full bg-white/12" />
        {children}
      </Dialog.Popup>
    </Dialog.Portal>
  );
}

function SheetClose({ className, ...props }: Dialog.Close.Props) {
  return (
    <Dialog.Close data-slot="sheet-close" className={className} {...props} />
  );
}

export { Sheet, SheetTrigger, SheetPopup, SheetClose };

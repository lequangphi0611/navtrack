import { PrivacyToggle } from "@/features/settings/components/PrivacyToggle";

export default function PrivacyTogglePreview() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 p-5">
      <div>
        <div className="mb-2 text-xs font-semibold text-muted-foreground">
          Mặc định hiện số tiền
        </div>
        <PrivacyToggle initialHidden={false} />
      </div>
      <div>
        <div className="mb-2 text-xs font-semibold text-muted-foreground">
          Mặc định ẩn số tiền
        </div>
        <PrivacyToggle initialHidden={true} />
      </div>
    </div>
  );
}

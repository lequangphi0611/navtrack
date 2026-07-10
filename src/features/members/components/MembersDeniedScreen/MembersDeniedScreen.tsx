import { Alert } from "@/components/Alert";
import { PageHeader } from "@/components/PageHeader";
import { ROUTES } from "@/lib/routes";

// Không có quyền mời: chỉ hiện lời từ chối — không lộ tổng số thành viên,
// section mời, hay danh sách allowlist.
function MembersDeniedScreen() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4.5 p-5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
      <PageHeader title="Thành viên" backHref={ROUTES.settings} />
      <Alert
        variant="info"
        title="Bạn không có quyền quản lý thành viên"
        description="Liên hệ người quản trị nếu bạn cần mời thêm người."
      />
    </div>
  );
}

export { MembersDeniedScreen };

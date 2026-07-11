import { Alert } from "@/components/Alert";

// Không có quyền mời: chỉ hiện lời từ chối — không lộ tổng số thành viên,
// section mời, hay danh sách allowlist. Shell (PageHeader + wrapper) do page.tsx sở hữu.
function MembersDeniedScreen() {
  return (
    <Alert
      variant="info"
      title="Bạn không có quyền quản lý thành viên"
      description="Liên hệ người quản trị nếu bạn cần mời thêm người."
    />
  );
}

export { MembersDeniedScreen };

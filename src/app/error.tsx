"use client";

import { Alert } from "@/components/Alert";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-16 text-center">
      <Alert
        variant="error"
        title="Đã có lỗi xảy ra"
        description="Thử lại sau ít phút. Nếu vẫn lỗi, liên hệ người quản trị."
        className="max-w-sm text-left"
      />
      <Button variant="outline" onClick={() => reset()}>
        Thử lại
      </Button>
    </div>
  );
}

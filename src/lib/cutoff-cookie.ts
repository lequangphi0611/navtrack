import { cookies } from "next/headers";

import type { CutoffKey, CutoffSelection } from "@/lib/cutoff";

// Tách khỏi lib/cutoff.ts (file đó tự khai "pure, không đụng DB") vì đọc
// cookie là I/O — giữ cutoff.ts thuần cho unit test không cần mock next/headers.
export const CUTOFF_COOKIE_NAME = "cutoff";

const VALID_KEYS: readonly CutoffKey[] = [
  "TODAY",
  "END_OF_MONTH",
  "END_OF_YEAR",
];

export function isValidCutoffKey(value: string): value is CutoffKey {
  return (VALID_KEYS as readonly string[]).includes(value);
}

// Đọc lựa chọn mốc chốt đã lưu (nếu có) — cookie thiếu/hỏng/giá trị lạ KHÔNG
// phải lỗi nghiệp vụ, mặc định về "Hôm nay" (hành vi cũ trước khi có wiring
// này) thay vì throw.
export async function getCutoffSelection(): Promise<CutoffSelection> {
  const store = await cookies();
  const raw = store.get(CUTOFF_COOKIE_NAME)?.value;
  if (raw && isValidCutoffKey(raw)) return { key: raw };
  return { key: "TODAY" };
}

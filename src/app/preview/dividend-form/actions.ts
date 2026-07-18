"use server";

import type { DividendFormState } from "@/features/dividends/types";

// Server Action giả cho preview — không ghi gì, chỉ để useActionState có action hợp lệ.
export async function fakeDividendAction(): Promise<DividendFormState> {
  return null;
}

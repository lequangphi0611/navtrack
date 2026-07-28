"use server";

import type { SnapshotTodayState } from "@/features/snapshots/types";

// Server Action giả cho preview — không ghi DB, chỉ để useActionState (bên
// trong SnapshotTodayCard) có action hợp lệ (cùng pattern
// preview/dividend-form/actions.ts::fakeDividendAction).
export async function fakeSnapshotAction(): Promise<SnapshotTodayState> {
  return { ok: true, snapshotAt: "15:42" };
}

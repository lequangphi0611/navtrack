// Nguồn sự thật cho state của SnapshotTodayCard
// (@/features/dashboard/components/SnapshotTodayCard) — component chỉ import +
// re-export lại, không tự định nghĩa (cùng pattern NavOverrideFormState ở
// @/features/holdings/types).
export type SnapshotTodayState =
  | { ok: true; snapshotAt: string } // "15:42" — HH:mm giờ VN
  | { ok: false; error: string }
  | null;

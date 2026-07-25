import { SettingsScreen } from "@/features/settings/components/SettingsScreen";
import {
  getCutoffOptions,
  getHideAmountsByDefault,
} from "@/features/settings/queries";
import { signOut } from "@/lib/auth";
import { getCutoffSelection } from "@/lib/cutoff-cookie";
import { ROUTES } from "@/lib/routes";

import { CutoffHardNavGuard } from "./CutoffHardNavGuard";

export default async function SettingsPage() {
  const [selection, cutoffOptions, hideAmountsByDefault] = await Promise.all([
    getCutoffSelection(),
    getCutoffOptions(),
    getHideAmountsByDefault(),
  ]);

  return (
    <>
      <CutoffHardNavGuard />
      <SettingsScreen
        cutoff={{
          selected: selection.key,
          options: cutoffOptions,
          // "Tuỳ chỉnh" (CUSTOM) chưa wiring (chưa có route nhập ngày tuỳ ý) —
          // trỏ tạm về /settings, xem process/DECISION.md.
          customHref: ROUTES.settings,
        }}
        hideAmountsByDefault={hideAmountsByDefault}
        onSignOut={async () => {
          "use server";
          await signOut({ redirectTo: ROUTES.signIn });
        }}
      />
    </>
  );
}

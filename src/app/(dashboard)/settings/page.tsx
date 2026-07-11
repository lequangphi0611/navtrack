import { SettingsScreen } from "@/features/settings/components/SettingsScreen";
import { signOut } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";

export default function SettingsPage() {
  return (
    <SettingsScreen
      onSignOut={async () => {
        "use server";
        await signOut({ redirectTo: ROUTES.signIn });
      }}
    />
  );
}

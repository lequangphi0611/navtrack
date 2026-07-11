import { LogOut, Users } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { SettingsMenuItem } from "@/components/SettingsMenuItem";
import { signOut } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";

export default function SettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4.5 p-5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
      <PageHeader title="Cài đặt" backHref={ROUTES.holdings} />

      <div className="flex flex-col gap-2">
        <SettingsMenuItem
          href={ROUTES.members}
          icon={Users}
          label="Thành viên"
        />

        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: ROUTES.signIn });
          }}
        >
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:bg-destructive/10"
          >
            <LogOut className="size-5 text-destructive" />
            <span className="flex-1 text-sm font-semibold text-destructive">
              Đăng xuất
            </span>
          </button>
        </form>
      </div>
    </div>
  );
}

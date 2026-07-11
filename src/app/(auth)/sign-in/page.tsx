import { Lock } from "lucide-react";
import { redirect } from "next/navigation";

import { Alert } from "@/components/Alert";
import { LogoMark } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { getSession, signIn } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";

type SignInPageProps = {
  searchParams: Promise<{ error?: string }>;
};

// Logo Google giữ nguyên brand color (hardcode như LogoMark, không qua token).
function GoogleLogo() {
  return (
    <svg className="size-5" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  // Đã đăng nhập rồi thì không hiện lại màn sign-in (vd bấm back, hoặc gõ thẳng URL).
  const session = await getSession();
  if (session?.user) redirect(ROUTES.holdings);

  const { error } = await searchParams;

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-8 pb-12 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500">
      <div className="flex flex-1 flex-col items-start justify-center">
        <LogoMark size={54} className="mb-6.5" />
        <h1 className="text-[34px] leading-none font-bold tracking-tight text-foreground">
          Navtrack
        </h1>
        <p className="mt-3 text-[17px] leading-snug font-medium text-foreground-soft">
          Sổ theo dõi đầu tư cá nhân —{" "}
          <span className="text-muted-foreground">
            trung thực, không màu mè, chỉ dành cho người được mời.
          </span>
        </p>
      </div>

      <div className="flex flex-col gap-3.5">
        <form
          action={async () => {
            "use server";
            // redirectTo tường minh — mặc định signIn() lấy callbackUrl từ header
            // Referer (chính là /sign-in), nên login xong lại quay về trang login.
            await signIn("google", { redirectTo: ROUTES.holdings });
          }}
        >
          <Button
            type="submit"
            size="lg"
            className="h-13 w-full gap-3 rounded-[15px] bg-foreground text-base font-semibold text-background hover:bg-foreground/90"
          >
            <GoogleLogo />
            Đăng nhập với Google
          </Button>
        </form>

        {error ? (
          <Alert
            variant="error"
            title="Email này chưa được mời"
            description="Nhờ người có quyền mời (admin) thêm email của bạn vào danh sách trước."
          />
        ) : (
          <div className="flex items-center justify-center gap-2">
            <Lock className="size-3.5 text-muted-faint" />
            <span className="text-[13px] font-medium text-muted-foreground">
              Chỉ dành cho tài khoản được mời.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

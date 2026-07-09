import { Alert } from "@/components/Alert";
import { LogoMark } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { signIn } from "@/lib/auth";

type SignInPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { error } = await searchParams;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-16 text-center">
      <LogoMark size={54} />
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Navtrack
        </h1>
        <p className="mt-1 text-muted-foreground">
          Quản lý danh mục đầu tư cá nhân
        </p>
      </div>

      {error ? (
        <Alert
          variant="error"
          title="Không thể đăng nhập"
          description="Email của bạn chưa được mời sử dụng Navtrack. Liên hệ người quản trị để được mời."
          className="max-w-sm text-left"
        />
      ) : null}

      <form
        action={async () => {
          "use server";
          await signIn("google");
        }}
      >
        <Button type="submit" variant="outline" size="lg">
          Đăng nhập bằng Google
        </Button>
      </form>
    </div>
  );
}

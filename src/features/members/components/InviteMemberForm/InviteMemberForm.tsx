"use client";

import { useActionState } from "react";

import { Alert } from "@/components/Alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { inviteMember } from "../../actions";

type FormState = {
  ok: boolean;
  error?: string;
  invitedEmail?: string;
} | null;

async function submitInvite(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const result = await inviteMember({ email: formData.get("email") });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, invitedEmail: result.data.email };
}

type InviteMemberFormProps = {
  disabled?: boolean;
};

function InviteMemberForm({ disabled = false }: InviteMemberFormProps) {
  const [state, formAction, isPending] = useActionState(submitInvite, null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex gap-2.5">
        <Input
          name="email"
          type="email"
          placeholder="email@vidu.com"
          className="h-11 rounded-xl"
          required
          disabled={disabled || isPending}
        />
        <Button
          type="submit"
          disabled={disabled || isPending}
          className="h-11 rounded-xl px-4.5 text-[13.5px] font-semibold"
        >
          Mời
        </Button>
      </div>
      {state && !state.ok ? (
        <Alert variant="error" title={state.error ?? "Không mời được"} />
      ) : null}
      {state?.ok ? (
        <Alert
          variant="info"
          title={`Đã mời ${state.invitedEmail}`}
          description="Họ có thể đăng nhập bằng Google với email này."
        />
      ) : null}
    </form>
  );
}

export { InviteMemberForm };
export type { InviteMemberFormProps };

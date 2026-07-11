import { PageHeader } from "@/components/PageHeader";
import { NewHoldingForm } from "@/features/holdings/components/NewHoldingForm";
import { ROUTES } from "@/lib/routes";

export default function NewHoldingPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4.5 p-5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
      <PageHeader title="Vị thế mới" backHref={ROUTES.holdings} />
      <NewHoldingForm />
    </div>
  );
}

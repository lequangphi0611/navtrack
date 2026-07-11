import { TransactionForm } from "@/features/holdings/components/TransactionForm";
import { getHoldingDetail } from "@/features/holdings/queries";

type NewTransactionFormSectionProps = {
  holdingId: string;
};

async function NewTransactionFormSection({
  holdingId,
}: NewTransactionFormSectionProps) {
  const holding = await getHoldingDetail(holdingId);

  return (
    <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
      <TransactionForm mode="create" holdingId={holdingId} holding={holding} />
    </div>
  );
}

export { NewTransactionFormSection };
export type { NewTransactionFormSectionProps };

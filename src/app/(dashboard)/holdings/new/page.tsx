import { NewHoldingForm } from "@/features/holdings/components/NewHoldingForm";

export default function NewHoldingPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">
        Nhập vị thế mới
      </h1>
      <NewHoldingForm />
    </div>
  );
}

import { AllocationScreen } from "@/features/dashboard/components/AllocationScreen";

export default function AllocationScreenPreview() {
  return (
    <div className="flex flex-col gap-8">
      <AllocationScreen
        backHref="#"
        slices={[
          { type: "STOCK", percent: 58.4 },
          { type: "FUND", percent: 21.2, note: "· gồm CCQ" },
          { type: "BOND", percent: 12.9 },
          { type: "GOLD", percent: 7.5 },
        ]}
        concentrationWarningCount={2}
      />

      <div className="border-t border-border" />

      <AllocationScreen
        backHref="#"
        slices={[{ type: "STOCK", percent: 100 }]}
        concentrationWarningCount={0}
      />
    </div>
  );
}

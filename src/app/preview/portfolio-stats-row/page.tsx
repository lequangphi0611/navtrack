import { PortfolioStatsRow } from "@/features/dashboard/components/PortfolioStatsRow";

// Soi cả hai trạng thái XIRR: OK (số bình thường) và "Chưa tính được" (không
// bao giờ hiện NaN/-100%, docs/domain/05-returns-xirr-and-pnl.md).
export default function PortfolioStatsRowPreview() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-5">
      <PortfolioStatsRow
        xirr={{ status: "OK", percentPerYear: 18.4 }}
        grossInvested="2850000000"
      />
      <PortfolioStatsRow
        xirr={{ status: "NO_CONVERGE" }}
        grossInvested="2850000000"
      />
      <PortfolioStatsRow
        xirr={{ status: "OK", percentPerYear: 18.4 }}
        grossInvested="2850000000"
        hidden
      />
    </div>
  );
}

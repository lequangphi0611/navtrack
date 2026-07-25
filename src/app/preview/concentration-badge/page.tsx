import { ConcentrationBadge } from "@/components/ConcentrationBadge";
import type { ConcentrationBadgeState } from "@/lib/concentration";

const STATES: { label: string; state: ConcentrationBadgeState }[] = [
  { label: "1. Bình thường", state: { kind: "NORMAL", percent: 34.2 } },
  {
    label: "2. Tập trung tự nhiên do ít mã",
    state: { kind: "NATURAL_CONCENTRATION", percent: 41.6, holdingCount: 2 },
  },
  {
    label: "3. NAV thiếu một phần",
    state: {
      kind: "PARTIAL_NAV",
      percent: 36.1,
      missingPriceSharePercent: 3.2,
    },
  },
  {
    label: "4. Treo toàn bộ (missingPriceShare > 5%)",
    state: { kind: "SUPPRESSED", missingPriceSharePercent: 8.7 },
  },
];

export default function ConcentrationBadgePreview() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 p-5">
      {STATES.map(({ label, state }) => (
        <div key={label} className="flex flex-col gap-2">
          <div className="text-xs font-semibold text-muted-foreground">
            {label}
          </div>
          <div className="flex items-start gap-6">
            <div>
              <div className="mb-1 text-[10px] text-muted-faint">showNote</div>
              <ConcentrationBadge state={state} />
            </div>
            <div>
              <div className="mb-1 text-[10px] text-muted-faint">compact</div>
              <ConcentrationBadge state={state} showNote={false} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

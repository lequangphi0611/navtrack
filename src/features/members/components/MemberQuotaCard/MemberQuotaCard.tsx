type MemberQuotaCardProps = {
  activeCount: number;
  maxMembers: number;
};

// Presentational thuần — nhận count/max đã fetch sẵn từ page, không tự gọi query.
function MemberQuotaCard({ activeCount, maxMembers }: MemberQuotaCardProps) {
  const usagePercent =
    maxMembers > 0 ? Math.min(100, (activeCount / maxMembers) * 100) : 100;

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-2.5 flex items-center justify-between">
        <div className="text-[12.5px] font-semibold text-muted-foreground">
          Số lượng thành viên
        </div>
        <div className="font-mono text-[12.5px] font-semibold text-foreground-soft tabular-nums">
          {activeCount} / {maxMembers}
        </div>
      </div>
      <div className="h-1.75 overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full bg-linear-to-r from-primary to-accent transition-[width] duration-500"
          style={{ width: `${usagePercent}%` }}
        />
      </div>
      <div className="mt-2.5 text-[11.5px] text-muted-faint">
        Giới hạn{" "}
        <span className="font-mono text-muted-foreground">MAX_MEMBERS</span> —
        hết chỗ thì không mời thêm được.
      </div>
    </div>
  );
}

export { MemberQuotaCard };
export type { MemberQuotaCardProps };

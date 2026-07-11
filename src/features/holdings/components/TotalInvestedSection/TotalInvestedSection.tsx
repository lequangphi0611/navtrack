import { StatCard } from "@/components/StatCard";
import { getTotalInvested } from "@/features/holdings/queries";

// Container async — vùng data riêng cho StatCard, stream độc lập với danh sách vị thế.
async function TotalInvestedSection() {
  const totalInvested = await getTotalInvested();

  return (
    <StatCard
      label="Tổng vốn đã bỏ vào"
      value={totalInvested}
      note="Chưa có giá thị trường — lãi/lỗ & XIRR sẽ có ở bản sau."
    />
  );
}

export { TotalInvestedSection };

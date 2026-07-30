import { CalendarX2 } from "lucide-react";

type OverdueMaturityCalloutProps = {
  // Số trái phiếu đã qua ngày đáo hạn mà chưa ghi tất toán.
  count: number;
};

// Callout đầu màn Danh mục khi có trái phiếu quá đáo hạn (mockup Phase 7
// Screens 7h). Nói rõ HỆ QUẢ SỐ LIỆU (vị thế vẫn đang tính vào NAV theo mệnh
// giá) chứ không doạ suông — app chỉ nêu sự thật dữ liệu, không tự ghi tất
// toán thay người dùng vì ngày tiền thực về có thể lệch.
function OverdueMaturityCallout({ count }: OverdueMaturityCalloutProps) {
  if (count <= 0) return null;

  return (
    <div className="flex gap-2.5 rounded-2xl border border-warning/30 bg-warning/8 p-3.5">
      <CalendarX2 className="mt-px size-5 shrink-0 text-warning" />
      <div className="flex-1">
        <div className="text-[12.5px] font-bold text-warning">
          {count} trái phiếu đã qua ngày đáo hạn
        </div>
        <div className="mt-0.75 text-[11px] leading-relaxed text-muted-foreground">
          Vị thế vẫn đang tính vào NAV theo mệnh giá. Ghi tất toán để số liệu
          phản ánh đúng tiền đã về.
        </div>
      </div>
    </div>
  );
}

export { OverdueMaturityCallout };
export type { OverdueMaturityCalloutProps };

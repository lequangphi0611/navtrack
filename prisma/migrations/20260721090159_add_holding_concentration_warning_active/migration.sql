-- AlterTable
-- Phase 6: trạng thái badge cảnh báo tập trung ở lần tính gần nhất — cần cho
-- hysteresis buffer 3 điểm % (docs/domain/04-pricing-and-valuation.md mục
-- "Hysteresis"). KHÔNG phải nguồn sự thật, chỉ để so sánh rồi ghi đè mỗi lần
-- tính lại (update-on-read lúc render Dashboard/Holdings).
ALTER TABLE "Holding" ADD COLUMN     "concentrationWarningActive" BOOLEAN NOT NULL DEFAULT false;

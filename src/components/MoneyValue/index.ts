export { MoneyValue } from "./MoneyValue";
export type { MoneyValueProps } from "./MoneyValue";
// Xuất thêm cho tái dùng ngoài MoneyValue (mục 11 phase-6.md: nút mắt header
// Dashboard, PrivacyToggle Cài đặt) — trước đây "không export ra ngoài" vì
// chưa có nơi khác cần, giờ Phase 6 chính thức cần dùng lại.
export { MoneyValueToggleButton } from "./MoneyValueToggleButton";

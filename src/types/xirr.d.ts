// Thư viện "xirr" (node_modules/xirr, xem xirr.js) không có type đi kèm và
// không nằm trong @types/* — khai báo ambient tối thiểu, chỉ đúng phần
// lib/xirr.ts thực sự dùng (mảng transaction + option.guess).
//
// Hành vi throw (không gõ được ra type nhưng lib/xirr.ts PHẢI bọc try/catch,
// không để lộ ra ngoài — xem docs/rules/error-handling.md):
// - < 2 giao dịch
// - toàn bộ amount cùng dấu (>=0 hết hoặc <0 hết)
// - toàn bộ giao dịch cùng một ngày (theo lịch, bỏ giờ/phút/giây)
// - Newton-Raphson không hội tụ
declare module "xirr" {
  export type XirrTransaction = {
    when: Date;
    amount: number;
  };

  export type XirrOptions = {
    guess?: number;
  };

  export default function xirr(
    transactions: XirrTransaction[],
    options?: XirrOptions,
  ): number;
}

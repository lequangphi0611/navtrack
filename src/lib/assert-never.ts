// Bắt exhaustiveness tại compile-time cho mọi switch theo enum Prisma — xem
// docs/rules/typescript-style.md mục "Enum". Thêm một giá trị enum mới mà một
// switch nào đó chưa xử lý -> lỗi compile ngay tại điểm gọi assertNever, không
// phải chờ runtime hay đi grep bằng trí nhớ.
export function assertNever(value: never): never {
  throw new Error(`Unhandled enum value: ${String(value)}`);
}

import { db } from "@/lib/db";

async function main() {
  // Seed dữ liệu mặc định (Setting, admin AllowedUser...) sẽ thêm ở Phase 1
  // khi các giá trị (MAX_MEMBERS, % thuế...) được chốt.
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });

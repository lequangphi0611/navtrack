import { db } from "@/lib/db";

const BASELINE_DATE = new Date("2020-01-01");

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  if (!adminEmail) {
    throw new Error(
      "SEED_ADMIN_EMAIL is not set — refusing to seed without an explicit admin email. Set it in .env.",
    );
  }

  await db.allowedUser.upsert({
    where: { email: adminEmail },
    update: {},
    create: { email: adminEmail, canInvite: true, invitedBy: null },
  });

  await db.setting.upsert({
    where: {
      key_effectiveFrom: { key: "MAX_MEMBERS", effectiveFrom: BASELINE_DATE },
    },
    update: {},
    create: {
      key: "MAX_MEMBERS",
      value: "10",
      valueType: "INT",
      label: "Số thành viên tối đa",
      group: "ACCESS",
      effectiveFrom: BASELINE_DATE,
    },
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });

import { db } from "@/lib/db";
import { SETTING_KEYS } from "@/lib/settings";

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
      key_effectiveFrom: {
        key: SETTING_KEYS.MAX_MEMBERS,
        effectiveFrom: BASELINE_DATE,
      },
    },
    update: {},
    create: {
      key: SETTING_KEYS.MAX_MEMBERS,
      value: "10",
      valueType: "INT",
      label: "Số thành viên tối đa",
      group: "ACCESS",
      effectiveFrom: BASELINE_DATE,
    },
  });

  await db.setting.upsert({
    where: {
      key_effectiveFrom: {
        key: SETTING_KEYS.CONCENTRATION_WARNING_THRESHOLD,
        effectiveFrom: BASELINE_DATE,
      },
    },
    update: {},
    create: {
      key: SETTING_KEYS.CONCENTRATION_WARNING_THRESHOLD,
      value: "30",
      valueType: "DECIMAL",
      label: "Ngưỡng cảnh báo tập trung (%)",
      group: "DISPLAY",
      effectiveFrom: BASELINE_DATE,
    },
  });

  await db.setting.upsert({
    where: {
      key_effectiveFrom: {
        key: SETTING_KEYS.DIVIDEND_TAX_RATE,
        effectiveFrom: BASELINE_DATE,
      },
    },
    update: {},
    create: {
      key: SETTING_KEYS.DIVIDEND_TAX_RATE,
      value: "5",
      valueType: "DECIMAL",
      label: "Thuế cổ tức tiền mặt (%)",
      group: "TAX",
      unit: "%",
      effectiveFrom: BASELINE_DATE,
    },
  });

  await db.setting.upsert({
    where: {
      key_effectiveFrom: {
        key: SETTING_KEYS.DIVIDEND_PAR_VALUE,
        effectiveFrom: BASELINE_DATE,
      },
    },
    update: {},
    create: {
      key: SETTING_KEYS.DIVIDEND_PAR_VALUE,
      value: "10000",
      valueType: "DECIMAL",
      label: "Mệnh giá cổ tức (đ/CP)",
      group: "TAX",
      unit: "đ/CP",
      effectiveFrom: BASELINE_DATE,
    },
  });

  // Phase 5 — thuế bán (docs/domain/07-tax.md mục "Ca biên"). STOCK/FUND/BOND
  // cùng mức 0.1% (Nghị định 253/2026/NĐ-CP + TT 87/2026/TT-BTC, xem
  // process/DECISION.md 2026-07-18 (5)); GOLD = 0% (cá nhân bán vàng miếng/
  // trang sức tại VN không chịu thuế TNCN chuyển nhượng) — vẫn seed tường
  // minh, không được để thiếu dòng (docs/domain/09-settings.md).
  const saleTaxSettings: {
    key: (typeof SETTING_KEYS)[
      "SALE_TAX_STOCK" | "SALE_TAX_FUND" | "SALE_TAX_BOND" | "SALE_TAX_GOLD"];
    label: string;
    value: string;
  }[] = [
    {
      key: SETTING_KEYS.SALE_TAX_STOCK,
      label: "Thuế bán cổ phiếu (%)",
      value: "0.1",
    },
    {
      key: SETTING_KEYS.SALE_TAX_FUND,
      label: "Thuế bán chứng chỉ quỹ (%)",
      value: "0.1",
    },
    {
      key: SETTING_KEYS.SALE_TAX_BOND,
      label: "Thuế bán trái phiếu (%)",
      value: "0.1",
    },
    {
      key: SETTING_KEYS.SALE_TAX_GOLD,
      label: "Thuế bán vàng (%)",
      value: "0",
    },
  ];

  for (const setting of saleTaxSettings) {
    await db.setting.upsert({
      where: {
        key_effectiveFrom: {
          key: setting.key,
          effectiveFrom: BASELINE_DATE,
        },
      },
      update: {},
      create: {
        key: setting.key,
        value: setting.value,
        valueType: "DECIMAL",
        label: setting.label,
        group: "TAX",
        unit: "%",
        effectiveFrom: BASELINE_DATE,
      },
    });
  }

  // Phase 5 — phí giao dịch mua/bán theo CTCK (docs/domain/07-tax.md mục "Phí
  // giao dịch (mua & bán)"). STOCK = 0.3% cả 2 chiều (theo TPS, đã xác nhận);
  // FUND/BOND/GOLD = 0% (chưa dùng kênh tính phí % cho các loại này) — vẫn
  // seed tường minh, cùng nguyên tắc "thiếu cấu hình -> báo lỗi" áp dụng cho
  // SALE_TAX_GOLD ở trên.
  const transactionFeeSettings: {
    key: (typeof SETTING_KEYS)[
      | "TRANSACTION_FEE_BUY_STOCK"
      | "TRANSACTION_FEE_BUY_FUND"
      | "TRANSACTION_FEE_BUY_BOND"
      | "TRANSACTION_FEE_BUY_GOLD"
      | "TRANSACTION_FEE_SELL_STOCK"
      | "TRANSACTION_FEE_SELL_FUND"
      | "TRANSACTION_FEE_SELL_BOND"
      | "TRANSACTION_FEE_SELL_GOLD"];
    label: string;
    value: string;
  }[] = [
    {
      key: SETTING_KEYS.TRANSACTION_FEE_BUY_STOCK,
      label: "Phí mua cổ phiếu (%)",
      value: "0.3",
    },
    {
      key: SETTING_KEYS.TRANSACTION_FEE_SELL_STOCK,
      label: "Phí bán cổ phiếu (%)",
      value: "0.3",
    },
    {
      key: SETTING_KEYS.TRANSACTION_FEE_BUY_FUND,
      label: "Phí mua chứng chỉ quỹ (%)",
      value: "0",
    },
    {
      key: SETTING_KEYS.TRANSACTION_FEE_SELL_FUND,
      label: "Phí bán chứng chỉ quỹ (%)",
      value: "0",
    },
    {
      key: SETTING_KEYS.TRANSACTION_FEE_BUY_BOND,
      label: "Phí mua trái phiếu (%)",
      value: "0",
    },
    {
      key: SETTING_KEYS.TRANSACTION_FEE_SELL_BOND,
      label: "Phí bán trái phiếu (%)",
      value: "0",
    },
    {
      key: SETTING_KEYS.TRANSACTION_FEE_BUY_GOLD,
      label: "Phí mua vàng (%)",
      value: "0",
    },
    {
      key: SETTING_KEYS.TRANSACTION_FEE_SELL_GOLD,
      label: "Phí bán vàng (%)",
      value: "0",
    },
  ];

  for (const setting of transactionFeeSettings) {
    await db.setting.upsert({
      where: {
        key_effectiveFrom: {
          key: setting.key,
          effectiveFrom: BASELINE_DATE,
        },
      },
      update: {},
      create: {
        key: setting.key,
        value: setting.value,
        valueType: "DECIMAL",
        label: setting.label,
        group: "FEE",
        unit: "%",
        effectiveFrom: BASELINE_DATE,
      },
    });
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });

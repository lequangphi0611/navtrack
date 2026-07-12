// Một nguồn sự thật cho mọi đường dẫn nội bộ — Link/redirect/revalidatePath/backHref
// đều phải qua đây, không hardcode string route rải rác (xem docs/rules/typescript-style.md).
export const ROUTES = {
  signIn: "/sign-in",
  // Prefix route handler Auth.js — không phải app route, nhưng vẫn qua đây để
  // proxy.ts (middleware) không hardcode string riêng.
  apiAuth: "/api/auth",
  // Trang chủ (Tổng quan/Dashboard) — src/app/(dashboard)/page.tsx.
  dashboard: "/",
  holdings: "/holdings",
  holdingsClosed: "/holdings/closed",
  newHolding: "/holdings/new",
  holdingDetail: (holdingId: string) => `/holdings/${holdingId}`,
  newTransaction: (holdingId: string) =>
    `/holdings/${holdingId}/transactions/new`,
  editTransaction: (holdingId: string, cashflowId: string) =>
    `/holdings/${holdingId}/transactions/${cashflowId}/edit`,
  navOverrideNew: (holdingId: string) => `/holdings/${holdingId}/price`,
  settings: "/settings",
  members: "/settings/members",
  inviteMember: "/settings/members/invite",
} as const;

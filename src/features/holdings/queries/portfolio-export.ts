import {
  buildPortfolioExportPayload,
  type PortfolioExportPayload,
} from "../portfolio-export";
import { findHoldingRows } from "../repository";

// Shell cho route handler (issue #151) — KHÔNG tự gọi session, nhận `userId`
// làm tham số để caller (route handler) quyết định response 401.
export async function getPortfolioExport(
  userId: string,
  asOf: Date = new Date(),
): Promise<PortfolioExportPayload> {
  const holdings = await findHoldingRows(userId);
  return buildPortfolioExportPayload(holdings, asOf);
}

import type { z } from "zod";

import type { inviteSchema } from "./schemas";

export type InviteMemberInput = z.infer<typeof inviteSchema>;

export type InvitableStatus = {
  canInvite: boolean;
  activeCount: number;
  maxMembers: number;
};

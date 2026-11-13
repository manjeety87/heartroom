import { schema, type Db } from "@heartroom/db";
import { and, eq, isNull } from "drizzle-orm";

/**
 * A guest signs in with Google (design doc › Accounts › Linking a guest): their games move to the
 * account (new, or an existing one from another device) in one transaction, before Better Auth deletes
 * the guest row. `match_players.user_id` is RESTRICT, so a row left behind would stop that delete
 * rather than lose history. The 18+ answer moves too if the account doesn't have one yet.
 */
export async function moveGuestToAccount(
  db: Db,
  guestId: string,
  accountId: string,
): Promise<void> {
  if (guestId === accountId) return;
  await db.transaction(async (tx) => {
    await tx
      .update(schema.matchPlayers)
      .set({ userId: accountId })
      .where(eq(schema.matchPlayers.userId, guestId));
    await tx
      .update(schema.voiceUsage)
      .set({ userId: accountId })
      .where(eq(schema.voiceUsage.userId, guestId));
    const [guest] = await tx
      .select({ ageConfirmedAt: schema.user.ageConfirmedAt })
      .from(schema.user)
      .where(eq(schema.user.id, guestId));
    if (guest?.ageConfirmedAt != null) {
      await tx
        .update(schema.user)
        .set({ ageConfirmedAt: guest.ageConfirmedAt })
        .where(and(eq(schema.user.id, accountId), isNull(schema.user.ageConfirmedAt)));
    }
  });
}

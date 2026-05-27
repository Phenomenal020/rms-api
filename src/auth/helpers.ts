import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import * as schema from './schema';
import { member, organization, session } from './schema';
// Returns the organisation a user belongs to, or null if they have none.
// Queries the member table (BA's organisation plugin) and joins to organization.
export async function getOrganisationByUserId(
  db: NodePgDatabase<typeof schema>,
  userId: string,
) {
  const [row] = await db
    .select({ organization })
    .from(member)
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .where(eq(member.userId, userId))
    .limit(1);

  return row?.organization ?? null;
}
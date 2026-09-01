import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { DATABASE_CONNECTION } from '../database/database-connection.token';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq, sql } from 'drizzle-orm';
import * as schema from '../auth/schema';
import { classRecordExportRequest, student, subject, user } from '../auth/schema';
import { requireOrganizationId } from '../auth/org-context.helper';
import { AddMemberDto } from './organisation.dto';
import { runWithDbContext } from 'src/common/filters/run-with-db-context';
import { ok } from 'src/common/utils/api-response';

@Injectable()
export class OrganisationService {
    // Inject the database connection and the auth service
    constructor(
        @Inject(DATABASE_CONNECTION)
        private readonly db: NodePgDatabase<typeof schema>,
        private readonly authService: AuthService,
    ) { }

    // Utility function to return row counts (for the dashboard cards)
    private async countRows(table: any, where: any) {
        const [row] = await this.db
            .select({ count: sql<number>`count(*)::int` })
            .from(table)
            .where(where);
        return row?.count ?? 0;  // Return 0 if no rows are found
    }

    // Get the dashboard cards
    async getDashboard(userId: string) {
        return runWithDbContext('organisation', 'Failed to get dashboard', async () => {
            // Get the organisation id of the authenticated user
            const organisationId = await requireOrganizationId(this.db, userId);
            // Use a promise to resolve the row counts for the dashboard cards
            const [
                enrolledStudents,
                subjectsOffered,
                pendingRequests,
                approvedRequests,
            ] = await Promise.all([
                this.countRows(student, eq(student.organizationId, organisationId)),
                this.countRows(subject, eq(subject.organizationId, organisationId)),
                this.countRows(
                    classRecordExportRequest,
                    and(
                        eq(classRecordExportRequest.organizationId, organisationId),
                        eq(classRecordExportRequest.status, 'PENDING'),
                    ),
                ),
                this.countRows(
                    classRecordExportRequest,
                    and(
                        eq(classRecordExportRequest.organizationId, organisationId),
                        eq(classRecordExportRequest.status, 'ACCEPTED'),
                    ),
                ),
            ]);
            // Return the row counts for the dashboard cards
            return ok({
                enrolledStudents,
                subjectsOffered,
                pendingRequests,
                approvedRequests,
            });
        }
        )
    }

    // Add a member to an organisation
    // The DTO carries an email; resolve it to a userId before calling BA's addMember (it requires a userId)
    async addMember(userId: string, payload: AddMemberDto) {
        return runWithDbContext('organisation', 'Failed to add member to organisation', async () => {
            // First, check the org admin belongs to an organisation
            const organisationId = await requireOrganizationId(this.db, userId);
            // Look up the target user by email
            const [targetUser] = await this.db
                .select({ id: user.id })
                .from(user)
                .where(eq(user.email, payload.email))
                .limit(1);
            // If the target user is not found, throw an error. Error is detailed as this is intended for the admin, not a random user on the internet.
            if (!targetUser) {
                throw new NotFoundException(`No account found for ${payload.email}. Consider inviting them to register.`);
            }
            // If the target user exists, call BA's server-side addMember with the resolved userId
            const data = await (this.authService.instance as any).api.addMember({
                body: {
                    userId: targetUser.id,
                    organizationId: organisationId,   // add the member to this organisation id
                    role: 'user',   // default role === a teacher in the organisation
                },
            });
            // If the result is not found, throw an error.
            if (!data) {
                throw new BadRequestException('Failed to add member to organisation. Please check the email and try again.');
            }
            // Return success if the member is added to the organisation
            return ok(null);
        })
    }
}
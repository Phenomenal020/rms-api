import { Injectable, Inject, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { DATABASE_CONNECTION } from '../database/database-connection.token';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, eq, sql } from 'drizzle-orm';
import * as schema from '../auth/schema';
import { classRecordExportRequest, member, student, subject, user } from '../auth/schema';
import { AddMemberDto } from './organisation.dto';

@Injectable()
export class OrganisationService {
    // Inject the database connection and the auth service
    constructor(
        @Inject(DATABASE_CONNECTION)
        private readonly db: NodePgDatabase<typeof schema>,
        private readonly authService: AuthService,
    ) { }

    // Get the organisation ID for the authenticated user.
    private async getMemberOrg(userId: string) {
        const [row] = await this.db
            .select({
                organizationId: member.organizationId,
            })
            .from(member)
            .where(eq(member.userId, userId))
            .limit(1);

        return row ?? null;
    }

    // Count the number of rows in a table that match the given where clause
    private async countRows(table: any, where: any) {
        const [row] = await this.db
            .select({ count: sql<number>`count(*)::int` })
            .from(table)
            .where(where);

        return row?.count ?? 0;
    }

    async getDashboard(userId: string) {
        // Get the organisation ID for the authenticated user
        const memberRow = await this.getMemberOrg(userId);
        if (!memberRow?.organizationId) {
            throw new ForbiddenException('No school information found. Please join a school first.');
        }

        const organisationId = memberRow.organizationId;
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

        return {
            success: true,
            data: {
                enrolledStudents,
                subjectsOffered,
                pendingRequests,
                approvedRequests,
            },
        };
    }

    // Add a member to an organisation
    // The DTO carries an email; resolve it to a userId before calling BA's addMember (it requires a userId)
    async addMember(payload: AddMemberDto) {

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

        try {
            // If the target user exists, call BA's server-side addMember with the resolved userId
            const data = await (this.authService.instance as any).api.addMember({
                body: {
                    userId: targetUser.id,
                    // organizationId: payload.organizationId,   // optional param. Instruct BA to derive this from the orgadmin's organisationId
                    role: 'user',   // default role === a teacher in the organisation
                },
            });

            // If the result is not found, throw an error.
            if (!data) {
                throw new BadRequestException('Failed to add member to organisation. Please check the email and try again.');
            }

            return {
                success: 'Member added to organisation',
                data: null
            };
        } catch (error: any) {
            throw new BadRequestException(`Failed to add member to organisation. ${error.message}`);
        }
    }
}
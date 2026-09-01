import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { DATABASE_CONNECTION } from "src/database/database-connection.token";
import * as schema from '../auth/schema';
import { CreateOnBoardingRequestDto, CreateTeacherJoinRequestDto, RejectRequestDto } from "./onboarding.dto";
import { runWithDbContext } from "src/common/filters/run-with-db-context";
import { and, eq } from "drizzle-orm";
import { user, onboardingRequest, teacherJoinRequest, organization, member, session } from "../auth/schema";
import { requireOrganizationId } from "../auth/org-context.helper";
import { ROLE_ORG_ADMIN, ROLE_USER } from "../auth/roles";
import { AuthService } from "@thallesp/nestjs-better-auth";
import { ok } from 'src/common/utils/api-response';

// Prefill organisation.metadata from the onboarding request fields (school form reads address/telephone/email)
function buildOrganisationMetadata(request: {
    organisationAddressLine1: string;
    organisationCity: string;
    organisationState: string;
    organisationPostalCode: string;
    organisationCountry: string;
    contactEmail: string;
    contactPhone: string;
}) {
    const address = [
        request.organisationAddressLine1,
        request.organisationCity,
        request.organisationState,
        request.organisationPostalCode,
        request.organisationCountry,
    ].join(", ");  // derive address by concatenating the address fields
    return {
        address,
        motto: null,
        telephone: null,
        email: null,
    };  // The orgadmin can update these later
}

@Injectable()
export class OnboardingService {
    constructor(
        @Inject(DATABASE_CONNECTION)
        private readonly db: NodePgDatabase<typeof schema>,
        private readonly authService: AuthService, // Nest-injected Better Auth instance (not the CLI auth.ts export)
    ) { }

    // Gets all onboarding requests (When platform admins want to view all onboarding requests for audit, approval or rejection)
    async getOnboardingRequests(userId: string) {
    // At this point, we are sure that the user is a platform admin. There is no scoping to organisation.
    // Also, userId is accepted for signature consistency with other service methods; auth is already enforced by PlatformAdminGuard
    return runWithDbContext('onboarding', 'Failed to get onboarding requests. Please try again later.', async () => {
        // Empty list is a valid response (no pending requests) — do not throw NotFound
        const onboardingRequests = await this.db
            .select()
            .from(onboardingRequest)
        // .where(eq(onboardingRequest.status, 'PENDING'));  // Get all, not just pending
        return ok(onboardingRequests);
    });
}

    // Creates a new onboarding request (when an admin requests to onboard their school)
    async createOnboardingRequest(userId: string, onboardingRequestPayload: CreateOnBoardingRequestDto) {
    return runWithDbContext('onboarding', 'Failed to create onboarding request. Please try again later.', async () => {
        // Use a transaction so the insert + user status update succeed or fail together
        return await this.db.transaction(async (tx) => {
            // Verify that the user exists in your database and is not already onboarded (implicitly implies that the user does not have an organisation id)
            const [userRow] = await tx.select().from(user).where(eq(user.id, userId));
            if (!userRow) {
                throw new NotFoundException('User not found. Please sign in first.');
            }
            // Block users who already have a pending request or have already been approved
            if (userRow.onboardingStatus === 'APPROVED' || userRow.onboardingStatus === 'PENDING') {
                throw new BadRequestException('User already has an onboarding request or is already onboarded');
            }
            // Gate on signup role so only users who have signed up as organisation admins can create onboarding requests
            // REJECTED / CANCELLED / NONE users may re-apply; the partial unique index also enforces one PENDING request per user
            if (userRow.signUpRole !== 'SCHOOL_ADMIN') {
                throw new BadRequestException('Only school admins can create onboarding requests');
            }
            // Destructure the relevant payload fields
            const { organisationName, organisationAddressLine1, organisationCity, organisationState, organisationPostalCode, organisationCountry, contactEmail, contactPhone } = onboardingRequestPayload;
            // Must use tx (not this.db) so the insert participates in the same transaction as the user update
            await tx.insert(onboardingRequest).values({
                userId,
                organisationName,
                organisationAddressLine1,
                organisationCity,
                organisationState,
                organisationPostalCode,
                organisationCountry,
                contactEmail,
                contactPhone,
                // organisation id for the onboarding request will be set after approval
                // status is pending by default
                // rejection reason is null by default
                // reviewed by is null by default
            });

            // Update the user's onboarding status to pending
            await tx.update(user).set({
                onboardingStatus: 'PENDING',
            }).where(eq(user.id, userId));

            // Finally, return the success response
            return ok(null);
        });
    });
}

    // Approve an onboarding request: create the organisation prefilled from the request, make the requester the org admin
    // (Only the org admin can change school details afterwards via the school form)
    // BA: createOrganization with session headers runs as the platform admin, so we create as admin → add applicant as owner → remove admin from the school
    // (Better Auth forbids removing the sole owner — applicant must become an owner first.)
    async approveOnboardingRequest(reviewedByUserId: string, requestId: string, headers: Headers) {
    return runWithDbContext('onboarding', 'Failed to approve onboarding request. Please try again later.', async () => {
        // Get the pending request by requestId
        const [request] = await this.db
            .select()
            .from(onboardingRequest)
            .where(eq(onboardingRequest.id, requestId))
            .limit(1);
        if (!request) {
            throw new NotFoundException('Onboarding request not found');
        }
        if (request.status !== 'PENDING') {
            throw new BadRequestException('This onboarding request has already been reviewed');
        }
        // Reject if the requester is already a member of any organisation
        const [existingMembership] = await this.db
            .select({ id: member.id })
            .from(member)
            .where(eq(member.userId, request.userId))
            .limit(1);
        if (existingMembership) {
            throw new BadRequestException('This user is already a member of a school');
        }

        // Prefill school from the user-supplied onboarding info
        const metadata = buildOrganisationMetadata(request);
        const api = (this.authService.instance as any).api;

        try {
            // 1) Create the organisation as the platform admin (creator becomes the sole owner)
            const organisation = await api.createOrganization({
                body: {
                    name: request.organisationName,  // the school name
                    slug: "autogenerate",  // "autogenerate" informs the organisation creation hook to autogenerate a slug
                    metadata,  // prefilled metadata from the onboarding request
                    keepCurrentActiveOrganization: true,  // don't switch the platform admin's active organisation
                },
                headers,
            });
            if (!organisation?.id) {
                throw new BadRequestException('Failed to create organisation');
            }

            // 2) Add the applicant as an owner (required before we can remove the platform admin)
            await api.addMember({
                body: {
                    userId: request.userId,
                    organizationId: organisation.id,
                    role: "owner",
                },
            });

            // 3) Remove the platform admin from this org (one-school-per-user; admin must not own every school)
            const [adminMembership] = await this.db
                .select({ id: member.id })
                .from(member)
                .where(and(
                    eq(member.organizationId, organisation.id),
                    eq(member.userId, reviewedByUserId),
                ))
                .limit(1);
            if (adminMembership) {
                await api.removeMember({
                    body: {
                        memberIdOrEmail: adminMembership.id,
                        organizationId: organisation.id,
                    },
                    headers,
                });
            }

            // 4) Update the applicant's user role / onboarding status and mark the request as approved
            await this.db.transaction(async (tx) => {
                // Platform role for guards (OrgAdminGuard checks user.role); membership stays BA "owner"
                await tx.update(user).set({
                    role: ROLE_ORG_ADMIN,
                    onboardingStatus: 'APPROVED',
                }).where(eq(user.id, request.userId));

                // Mark the onboarding request approved and link the new organisation
                await tx.update(onboardingRequest).set({
                    status: 'APPROVED',
                    organisationId: organisation.id,
                    reviewedBy: reviewedByUserId,
                    rejectionReason: null,
                }).where(eq(onboardingRequest.id, requestId));

                // 5) Make this school the applicant's active organisation on all of their sessions.
                // Do not call auth.api.setActiveOrganization here — that API uses the caller's
                // session cookies (platform admin), not the applicant's.
                await tx.update(session).set({
                    activeOrganizationId: organisation.id,
                }).where(eq(session.userId, request.userId));
            });

            // Return the new organisation so the platform admin can see the generated registration ID
            return ok({ organisationId: organisation.id, slug: organisation.slug });
        } catch (err) {
            // Surface Better Auth API errors instead of a generic 500 from runWithDbContext
            if (err instanceof BadRequestException || err instanceof NotFoundException) {
                throw err;
            }
            const message =
                err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string"
                    ? (err as { message: string }).message
                    : "Failed to approve onboarding request. Please try again later.";
            throw new BadRequestException(message);
        }
    });
}

    // Reject an onboarding request and tell the user why
    async rejectOnboardingRequest(reviewedByUserId: string, requestId: string, payload: RejectRequestDto) {
    return runWithDbContext('onboarding', 'Failed to reject onboarding request. Please try again later.', async () => {
        return await this.db.transaction(async (tx) => {
            // Get the pending request by requestId
            const [request] = await tx
                .select()
                .from(onboardingRequest)
                .where(eq(onboardingRequest.id, requestId))
                .limit(1);
            if (!request) {
                throw new NotFoundException('Onboarding request not found');
            }
            if (request.status !== 'PENDING') {
                throw new BadRequestException('This onboarding request has already been reviewed');
            }

            // Mark the request rejected with the platform admin's reason
            await tx.update(onboardingRequest).set({
                status: 'REJECTED',
                rejectionReason: payload.rejectionReason,
                reviewedBy: reviewedByUserId,
            }).where(eq(onboardingRequest.id, requestId));

            // Tell the user they were rejected (they may re-apply from NONE/REJECTED later)
            await tx.update(user).set({
                onboardingStatus: 'REJECTED',
            }).where(eq(user.id, request.userId));

            return ok(null);
        });
    });
}

    // Gets all pending teacher join requests for the org admin's organisation so they can accept or reject teachers who asked to join their school
    async getTeacherJoinRequests(userId: string) {
    return runWithDbContext('onboarding', 'Failed to get teacher join requests. Please try again later.', async () => {
        // Scope to the authenticated org admin's organisation
        const organisationId = await requireOrganizationId(this.db, userId);
        // Get all pending join requests so the org admin can review who is asking to join
        const joinRequests = await this.db
            .select({
                id: teacherJoinRequest.id,
                status: teacherJoinRequest.status,
                createdAt: teacherJoinRequest.createdAt,
                userId: teacherJoinRequest.userId,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                name: user.name,
            })
            .from(teacherJoinRequest)
            .innerJoin(user, eq(teacherJoinRequest.userId, user.id))
            .where(
                and(
                    eq(teacherJoinRequest.organisationId, organisationId),
                    eq(teacherJoinRequest.status, 'PENDING'),
                ),
            );
        // Empty list is a valid response — do not throw NotFound
        return ok(joinRequests);
    });
}

    // Creates a teacher join request: validate registration ID (organisation.slug), then create a pending join request
    async createTeacherJoinRequest(userId: string, payload: CreateTeacherJoinRequestDto) {
    return runWithDbContext('onboarding', 'Failed to create teacher join request. Please try again later.', async () => {
        return await this.db.transaction(async (tx) => {
            // Verify that the user exists and is eligible to join a school
            const [userRow] = await tx.select().from(user).where(eq(user.id, userId));
            if (!userRow) {
                throw new NotFoundException('User not found. Please sign in first.');
            }
            // Block users who already have a pending request or have already been approved
            if (userRow.onboardingStatus === 'APPROVED' || userRow.onboardingStatus === 'PENDING') {
                throw new BadRequestException('User already has a join request or is already onboarded');
            }
            // Gate on signup role so only teachers can create join requests
            if (userRow.signUpRole !== 'TEACHER') {
                throw new BadRequestException('Only teachers can create join requests');
            }
            // Reject if the teacher is already a member of any organisation
            const [existingMembership] = await tx
                .select({ id: member.id })
                .from(member)
                .where(eq(member.userId, userId))
                .limit(1);
            if (existingMembership) {
                throw new BadRequestException('You are already a member of a school');
            }
            // use the school registration ID (organisation slug) to get the organisation ID
            const [orgRow] = await tx
                .select({ id: organization.id })
                .from(organization)
                .where(eq(organization.slug, payload.schoolRegistrationId))
                .limit(1);
            if (!orgRow) {
                throw new NotFoundException(
                    'Invalid school registration ID. Please check with your school admin and try again.',
                );
            }
            // Insert the PENDING join request — this is the "message" the org admin reviews to accept or reject
            // status is pending by default; rejection reason is null by default
            await tx.insert(teacherJoinRequest).values({
                userId,
                organisationId: orgRow.id,
            });
            // Update the user's onboarding status to pending while they wait for the org admin
            await tx.update(user).set({
                onboardingStatus: 'PENDING',
            }).where(eq(user.id, userId));
            // Finally, return the success response
            return ok(null);
        });
    });
}

    // Approve a teacher join request: Add the teacher as a member of the organisation, mark the request as approved, and mark the teacher as onboarded
    async approveTeacherJoinRequest(orgAdminUserId: string, requestId: string) {
    return runWithDbContext('onboarding', 'Failed to approve teacher join request. Please try again later.', async () => {
        // Scope to the org admin's organisation
        const organisationId = await requireOrganizationId(this.db, orgAdminUserId);

        // Get the pending request by requestId
        const [request] = await this.db
            .select()
            .from(teacherJoinRequest)
            .where(eq(teacherJoinRequest.id, requestId))
            .limit(1);
        if (!request) {
            throw new NotFoundException('Teacher join request not found');
        }
        // Scope: request must belong to this org admin's organisation
        if (request.organisationId !== organisationId) {
            throw new NotFoundException('Teacher join request not found');
        }
        if (request.status !== 'PENDING') {
            throw new BadRequestException('This join request has already been reviewed');
        }

        // Add the teacher as a member of the organisation. Skip if membership already exists
        const api = (this.authService.instance as any).api;
        const [existingMembership] = await this.db
            .select({ id: member.id })
            .from(member)
            .where(
                and(
                    eq(member.userId, request.userId),
                    eq(member.organizationId, organisationId),
                ),
            )
            .limit(1);
        if (!existingMembership) {
            await api.addMember({
                body: {
                    userId: request.userId,
                    organizationId: organisationId,
                    role: ROLE_USER,  // default role === a teacher in the organisation
                },
            });
        }

        // Local status updates only (update request + user onboarding status)
        await this.db.transaction(async (tx) => {
            // Mark the join request approved
            await tx.update(teacherJoinRequest).set({
                status: 'APPROVED',
                rejectionReason: null,
            }).where(eq(teacherJoinRequest.id, requestId));

            // Mark the teacher as onboarded
            await tx.update(user).set({
                onboardingStatus: 'APPROVED',
            }).where(eq(user.id, request.userId));
        });

        return ok(null);
    });
}

    // Reject a teacher join request and tell the user why
    async rejectTeacherJoinRequest(orgAdminUserId: string, requestId: string, payload: RejectRequestDto) {
    return runWithDbContext('onboarding', 'Failed to reject teacher join request. Please try again later.', async () => {
        // Scope to the org admin's organisation
        const organisationId = await requireOrganizationId(this.db, orgAdminUserId);
        return await this.db.transaction(async (tx) => {
            // Get the pending request by requestId
            const [request] = await tx
                .select()
                .from(teacherJoinRequest)
                .where(eq(teacherJoinRequest.id, requestId))
                .limit(1);
            if (!request) {
                throw new NotFoundException('Teacher join request not found');
            }
            if (request.organisationId !== organisationId) {
                throw new NotFoundException('Teacher join request not found');
            }
            if (request.status !== 'PENDING') {
                throw new BadRequestException('This join request has already been reviewed');
            }

            // Mark the request rejected with the org admin's reason
            await tx.update(teacherJoinRequest).set({
                status: 'REJECTED',
                rejectionReason: payload.rejectionReason,
            }).where(eq(teacherJoinRequest.id, requestId));

            // Tell the user they were rejected
            await tx.update(user).set({
                onboardingStatus: 'REJECTED',
            }).where(eq(user.id, request.userId));

            return ok(null);
        });
    });
}
}
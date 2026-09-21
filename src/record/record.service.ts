// import { Injectable, Inject, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
// import { runWithDbContext } from '../common/filters/run-with-db-context';
// import { NodePgDatabase } from 'drizzle-orm/node-postgres';
// import { DATABASE_CONNECTION } from '../database/database-connection.token';
// import * as schema from '../auth/schema';
// import { classRecordExportRequest, organisationClass, user } from '../auth/schema';
// import { requireOrganizationId, requireTermInOrganization } from '../auth/org-context.helper';
// import { and, desc, eq } from 'drizzle-orm';
// import { ROLE_ORG_ADMIN, ROLE_USER } from 'src/auth/roles';
// import { ok } from 'src/common/utils/api-response';

// @Injectable()
// export class RecordService {
//   // Inject the database connection
//   constructor(
//     @Inject(DATABASE_CONNECTION)
//     private readonly db: NodePgDatabase<typeof schema>,
//   ) { }

//   // Get record export requests for the authenticated user's role.
//   // TODO: What to do if form teacher was reassigned?
//   async getPendingRecordExportRequests(userId: string, termId: string, role: string | null) {
//     return runWithDbContext('generic', 'Failed to fetch record export requests', async () => {
//       // If the role is not orgadmin or user, throw an unauthorised exception
//       if (role !== ROLE_ORG_ADMIN && role !== ROLE_USER) {
//         throw new ForbiddenException('Unauthorised operation');
//       }
//       // Get the organisation id (ensure the term is active)
//       const organisationId = await requireTermInOrganization(this.db, userId, termId, { requireActive: true });
//       // Org admins review pending requests; regular users see all requests they created.
//       const requestFilters = [
//         eq(classRecordExportRequest.organizationId, organisationId),
//         eq(classRecordExportRequest.academicTermId, termId),
//         eq(classRecordExportRequest.createdBy, organisationClass.formTeacherId),
//       ];
//       // If the user is an orgadmin, only show pending requests (add PENDING status filter)
//       if (role === 'orgadmin') {
//         // requestFilters.push(eq(classRecordExportRequest.status, 'PENDING'));
//       } else {
//         // If the user is a regular user, only show requests they created
//         requestFilters.push(eq(classRecordExportRequest.createdBy, userId));
//       }
//       // Get the rows from the database
//       const rows = await this.db
//         .select({
//           id: classRecordExportRequest.id,
//           status: classRecordExportRequest.status,
//           createdAt: classRecordExportRequest.createdAt,
//           classId: organisationClass.id,
//           className: organisationClass.name,
//           formTeacherId: organisationClass.formTeacherId,
//           formTeacherName: user.name,
//           // createdBy: classRecordExportRequest.createdBy,
//         })
//         .from(classRecordExportRequest)
//         .innerJoin(user, eq(classRecordExportRequest.createdBy, user.id)) // to get form teacher name
//         .innerJoin(
//           organisationClass,
//           eq(classRecordExportRequest.classId, organisationClass.id),
//         )  // to join on form teacher id and class id
//         .where(
//           and(...requestFilters),
//         )
//         .orderBy(desc(classRecordExportRequest.createdAt)); // newest requests first
//       return ok(rows);
//     });
//   }

//   // Get a single export row: `class_record_export_record` JSON by request id (org admin).
//   async getRecord(userId: string, requestId: string) {
//     return runWithDbContext('generic', 'Failed to fetch record export', async () => {
//       // Get the organisation id of the authenticated user
//       const organisationId = await requireOrganizationId(this.db, userId);
//       // Fetch the request in the user's organisation and include its 1:1 exported record.
//       const row = await this.db.query.classRecordExportRequest.findFirst({
//         columns: {
//           id: true,
//           status: true,
//         },
//         where: and(
//           eq(classRecordExportRequest.id, requestId),
//           eq(classRecordExportRequest.organizationId, organisationId),
//           eq(classRecordExportRequest.status, 'PENDING'),
//         ),
//         with: {
//           record: {
//             columns: {
//               id: true,
//               requestId: true,
//               content: true,
//             },
//           },
//         },
//       });
//       // If the record is not found, throw a not found exception
//       if (!row?.record) {
//         throw new NotFoundException('Record request not found.');
//       }
//       // Return the record
//       return ok({
//         id: row.record.id,
//         requestId: row.record.requestId,
//         status: row.status,
//         content: row.record.content,
//       });
//     });
//   }

//   // Accept a record export request
//   async acceptRequest(userId: string, requestId: string) {
//     return runWithDbContext('generic', 'Failed to accept record export request', async () => {
//       // Get the organisation id of the authenticated user
//       const organisationId = await requireOrganizationId(this.db, userId);
//       // Get the request from the database
//       const [request] = await this.db
//         .select({
//           id: classRecordExportRequest.id,
//           status: classRecordExportRequest.status,
//         })
//         .from(classRecordExportRequest)
//         .where(
//           and(
//             eq(classRecordExportRequest.id, requestId),
//             eq(classRecordExportRequest.organizationId, organisationId),
//           ),
//         )
//         .limit(1);
//       if (!request) {
//         throw new NotFoundException('Record request not found.');
//       }
//       if (request.status !== 'PENDING') {
//         throw new BadRequestException('Record request has already been reviewed.');
//       }
//       // If requestId exists, update the request status to accepted
//       await this.db
//         .update(classRecordExportRequest)
//         .set({
//           status: 'ACCEPTED',
//           reviewedBy: userId,   // reviewed by the user (the orgadmin)
//           reviewedAt: new Date(),
//           rejectionReason: null,  // none
//         })
//         .where(eq(classRecordExportRequest.id, request.id))
//       // Return the success response
//       return ok(null);
//     });
//   }

//   // Reject a record export request
//   async rejectRequest(
//     userId: string,
//     requestId: string,
//     rejectionReason: string,
//   ) {
//     return runWithDbContext('generic', 'Failed to reject record export request', async () => {
//       // Get the organisation id of the authenticated user
//       const organisationId = await requireOrganizationId(this.db, userId);
//       // Get the request from the database
//       const [request] = await this.db
//         .select({
//           id: classRecordExportRequest.id,
//           status: classRecordExportRequest.status,
//         })
//         .from(classRecordExportRequest)
//         .where(
//           and(
//             eq(classRecordExportRequest.id, requestId),
//             eq(classRecordExportRequest.organizationId, organisationId),
//           ),
//         )
//         .limit(1);
//       if (!request) {
//         throw new NotFoundException('Record request not found.');
//       }
//       if (request.status !== 'PENDING') {
//         throw new BadRequestException('Record request has already been reviewed.');
//       }
//       // If requestId exists, update the request status to rejected. Also, set the rejection reason and the reviewer to the user (the orgadmin)
//       await this.db
//         .update(classRecordExportRequest)
//         .set({
//           status: 'REJECTED',
//           reviewedBy: userId,
//           reviewedAt: new Date(),
//           rejectionReason,
//         })
//         .where(eq(classRecordExportRequest.id, request.id))
//       // Return the success response
//       return ok(null);
//     });
//   }
// }
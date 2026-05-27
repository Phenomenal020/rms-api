import {
  Injectable,
  Inject,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '../database/database-connection.token';
import * as schema from '../auth/schema';
import {
  member,
  academicTerm,
  classRecordExportRequest,
  organisationClass,
  user,
} from '../auth/schema';
import { and, desc, eq } from 'drizzle-orm';

@Injectable()
export class RecordService {
  // Inject the database connection
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) { }

  // Get the organisation ID for the user
  private async getMemberOrg(userId: string) {
    // Get the organisation ID for the user
    const [row] = await this.db
      .select({
        organizationId: member.organizationId,
      })
      .from(member)
      .where(eq(member.userId, userId))
      .limit(1);
    // Return the organisation ID for the user
    return row ?? null;
  }

  // Get record export requests for the authenticated user's role.
  async getPendingRecordExportRequests(
    userId: string,
    termId: string,
    role: string | null,
  ) {

    // If the role is not orgadmin or user, throw an unauthorised exception
    if (role !== 'orgadmin' && role !== 'user') {
      throw new ForbiddenException('Unauthorised operation');
    }

    // Get the organisation ID for the user
    const memberRow = await this.getMemberOrg(userId);
    if (!memberRow?.organizationId) {
      throw new ForbiddenException(
        'No school information found. Please join a school first.',
      );
    }

    // Validate the term id is actually active and belongs to the authenticated user's organisation
    const organisationId = memberRow.organizationId;
    const [termRow] = await this.db
      .select({ id: academicTerm.id })
      .from(academicTerm)
      .where(
        and(
          eq(academicTerm.id, termId),
          eq(academicTerm.organizationId, organisationId),
          eq(academicTerm.status, 'ACTIVE'),
        ),
      )
      .limit(1);
    if (!termRow) {
      throw new NotFoundException('Academic term not found or not active.');
    }

    // Org admins review pending requests; regular users see all requests they created.
    const requestFilters = [
      eq(classRecordExportRequest.organizationId, organisationId),
      eq(classRecordExportRequest.academicTermId, termId),
      eq(classRecordExportRequest.createdBy, organisationClass.formTeacherId),
    ];

    // If the user is an orgadmin, only show pending requests (add PENDING status filter)
    if (role === 'orgadmin') {
      // requestFilters.push(eq(classRecordExportRequest.status, 'PENDING'));
    } else {
      // If the user is a regular user, only show requests they created
      requestFilters.push(eq(classRecordExportRequest.createdBy, userId));
    }

    const rows = await this.db
      .select({
        id: classRecordExportRequest.id,
        status: classRecordExportRequest.status,
        createdAt: classRecordExportRequest.createdAt,
        classId: organisationClass.id,
        className: organisationClass.name,
        formTeacherId: organisationClass.formTeacherId,
        formTeacherName: user.name,
        // createdBy: classRecordExportRequest.createdBy,
      })
      .from(classRecordExportRequest)
      .innerJoin(user, eq(classRecordExportRequest.createdBy, user.id)) // to get form teacher name
      .innerJoin(
        organisationClass,
        eq(classRecordExportRequest.classId, organisationClass.id),
      )  // to join on form teacher id and class id
      .where(
        and(...requestFilters),
      )
      .orderBy(desc(classRecordExportRequest.createdAt)); // newest requests first

    return {
      success: true,
      data: rows,
    };
  }

  /** Single export row: `class_record_export_record` JSON by request id (org admin). */
  async getRecord(userId: string, requestId: string) {
    // Retrieve the user's organisation ID
    const memberRow = await this.getMemberOrg(userId);
    if (!memberRow?.organizationId) {
      throw new ForbiddenException(
        'No school information found. Please join a school first.',
      );
    }
    const organisationId = memberRow.organizationId;

    // Fetch the request in the user's organisation and include its 1:1 exported record.
    const row = await this.db.query.classRecordExportRequest.findFirst({
      columns: {
        id: true,
        status: true,
      },
      where: and(
        eq(classRecordExportRequest.id, requestId),
        eq(classRecordExportRequest.organizationId, organisationId),
        eq(classRecordExportRequest.status, 'PENDING'),
      ),
      with: {
        record: {
          columns: {
            id: true,
            requestId: true,
            content: true,
          },
        },
      },
    });

    if (!row?.record) {
      throw new NotFoundException('Record request not found.');
    }

    return {
      success: true,
      data: {
        id: row.record.id,
        requestId: row.record.requestId,
        status: row.status,
        content: row.record.content,
      },
    };
  }

  // Accept a record export request
  async acceptRequest(userId: string, requestId: string) {
    // Retrieve the user's organisation ID
    const memberRow = await this.getMemberOrg(userId);
    if (!memberRow?.organizationId) {
      throw new ForbiddenException(
        'No school information found. Please join a school first.',
      );
    }

    // Verify and retrieve the request from the database using the request id and organisation id
    const [request] = await this.db
      .select({ id: classRecordExportRequest.id })
      .from(classRecordExportRequest)
      .where(
        and(
          eq(classRecordExportRequest.id, requestId),
          eq(classRecordExportRequest.organizationId, memberRow.organizationId),
        ),
      )
      .limit(1);
    if (!request) {
      throw new NotFoundException('Record request not found.');
    }

    // If requestId exists, update the request status to accepted
    await this.db
      .update(classRecordExportRequest)
      .set({
        status: 'ACCEPTED',
        reviewedBy: userId,   // reviewed by the user (the orgadmin)
        reviewedAt: new Date(),
        rejectionReason: null,  // none
      })
      .where(eq(classRecordExportRequest.id, request.id))

    return {
      success: true,
      data: null,
    };
  }

  // Reject a record export request
  async rejectRequest(
    userId: string,
    requestId: string,
    rejectionReason: string,
  ) {
    // Retrieve the user's organisation ID
    const memberRow = await this.getMemberOrg(userId);
    if (!memberRow?.organizationId) {
      throw new ForbiddenException(
        'No school information found. Please join a school first.',
      );
    }

    // Verify and retrieve the request from the database using the request id and organisation id
    const [request] = await this.db
      .select({ id: classRecordExportRequest.id })
      .from(classRecordExportRequest)
      .where(
        and(
          eq(classRecordExportRequest.id, requestId),
          eq(classRecordExportRequest.organizationId, memberRow.organizationId),
        ),
      )
      .limit(1);
    if (!request) {
      throw new NotFoundException('Record request not found.');
    }

    // If requestId exists, update the request status to rejected. Also, set the rejection reason and the reviewer to the user (the orgadmin)
    await this.db
      .update(classRecordExportRequest)
      .set({
        status: 'REJECTED',
        reviewedBy: userId,
        reviewedAt: new Date(),
        rejectionReason,
      })
      .where(eq(classRecordExportRequest.id, request.id))

    return {
      success: true,
      data: null,
    };
  }
}
// import { Body, Controller, Get, HttpCode, Patch, Query, UseGuards, UseInterceptors } from '@nestjs/common';
// import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
// import { RecordService } from './record.service';
// import { PendingRecordRequestsQueryDto, RecordQueryDto, RejectRecordDto } from './dto/record.dto';
// import { OrgAdminGuard } from '../auth/guards/org-admin.guard';
// import { OrgMemberGuard } from '../auth/guards/org-member.guard';
// import { LoggingInterceptor } from 'src/common/interceptors/logging.interceptor';

// @Controller('record')
// @UseInterceptors(LoggingInterceptor)
// export class RecordController {
//   constructor(private readonly recordService: RecordService) { }

//   // GET /api/v1/record/requests?termId=… — org admins see pending requests; users see their own requests.
//   @Get('requests')
//   @UseGuards(OrgMemberGuard)
//   @HttpCode(200)
//   async getPendingRequests(
//     @Session() session: UserSession,
//     @Query() query: PendingRecordRequestsQueryDto,
//   ) {
//     const role = session.user.role ? session.user.role as string : null;

//     return this.recordService.getPendingRecordExportRequests(
//       session.user.id,
//       query.termId,
//       role,
//     );
//   }

//   // GET /api/v1/record/record?requestId=… — JSON snapshot for one export request (org admin).
//   @Get('record')
//   @HttpCode(200)
//   @UseGuards(OrgMemberGuard)
//   async getRecord(
//     @Session() session: UserSession,
//     @Query() query: RecordQueryDto,
//   ) {
//     return this.recordService.getRecord(
//       session.user.id,
//       query.requestId,
//     );
//   }

//   // PATCH /api/v1/record/accept?requestId=… — accept a pending export request (org admin).
//   @Patch('accept')
//   @HttpCode(200)
//   @UseGuards(OrgAdminGuard)
//   async acceptRecord(
//     @Session() session: UserSession,
//     @Query() query: RecordQueryDto,
//   ) {
//     return this.recordService.acceptRequest(
//       session.user.id,
//       query.requestId,
//     );
//   }

//   // PATCH /api/v1/record/reject?requestId=… — reject a pending export request (org admin).
//   @Patch('reject')
//   @HttpCode(200)
//   @UseGuards(OrgAdminGuard)
//   async rejectRecord(
//     @Session() session: UserSession,
//     @Query() query: RecordQueryDto,
//     @Body() payload: RejectRecordDto,
//   ) {
//     return this.recordService.rejectRequest(
//       session.user.id,
//       query.requestId,
//       payload.rejectionReason,
//     );
//   }
// }

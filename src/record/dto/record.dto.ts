import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

// Query params for GET /record/requests?termId=… — scoped to one academic term.
export class PendingRecordRequestsQueryDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  termId!: string;
}

// Query params for GET /record/record?requestId=… — scoped to one export request.
export class RecordQueryDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  requestId!: string;
}

// Body for PATCH /record/reject?requestId=…
export class RejectRecordDto {
  @IsString()
  @IsNotEmpty()
  rejectionReason!: string;
}
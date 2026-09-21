// import { IsNotEmpty, IsString, IsUUID, MinLength, MaxLength } from 'class-validator';
// import { Transform } from 'class-transformer';

// function trim({ value }: { value: unknown }) {
//   return typeof value === 'string' ? value.trim() : value;
// }

// // Query params for GET /record/requests?termId=… — scoped to one academic term.
// export class PendingRecordRequestsQueryDto {
//   @IsString()
//   @IsNotEmpty()
//   @IsUUID()
//   termId!: string;
// }

// // Query params for GET /record/record?requestId=… — scoped to one export request.
// export class RecordQueryDto {
//   @IsString()
//   @IsNotEmpty()
//   @IsUUID()
//   requestId!: string;
// }

// // Body for PATCH /record/reject?requestId=…
// export class RejectRecordDto {
//   @IsString()
//   @IsNotEmpty()
//   @Transform(trim)
//   @MinLength(1, { message: 'Rejection reason must not be blank' })
//   @MaxLength(200, { message: 'Rejection reason must be at most 200 characters' })
//   rejectionReason!: string;
// }
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class LockSubjectAssignmentDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  assignmentId!: string;

  @IsString()
  @IsNotEmpty()
  @IsUUID()
  termId!: string;
}

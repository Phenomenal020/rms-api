import { IsInt, IsNotEmpty, IsString, IsUUID, Max, Min } from 'class-validator';

export class UnlockSubjectAssignmentDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  assignmentId!: string;

  @IsString()
  @IsNotEmpty()
  @IsUUID()
  termId!: string;

  @IsInt()
  @Min(1)
  @Max(24)
  unlockHours!: number;
}

import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class GetSubjectRecordQueryDto {
  @IsString()
  @IsNotEmpty({ message: "No assignment information provided. Please try again or contact your school's admin." })
  @IsUUID()
  assignmentId!: string;

  @IsString()
  @IsNotEmpty({ message: "No term information provided. Please try again or contact your school's admin." })
  @IsUUID()
  termId!: string;
}

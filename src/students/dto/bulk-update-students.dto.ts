import { UpdateStudentDto } from './update-student.dto';

export class BulkUpdateStudentsDto {
  students: Array<UpdateStudentDto & { id: string }>;
}

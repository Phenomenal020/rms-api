export class UpdateStudentDto {
  firstName?: string;
  lastName?: string;
  middleName?: string;
  dateOfBirth?: string | Date;
  gender?: 'NONE' | 'MALE' | 'FEMALE';
  department?: 'NONE' | 'SCIENCE' | 'ARTS' | 'COMMERCE' | 'GENERAL';
  daysPresent?: number;
  subjects?: string[] | Array<{ name: string }>;
  studentSubjects?: string[] | Array<{ name: string }>; // backward compatibility
}

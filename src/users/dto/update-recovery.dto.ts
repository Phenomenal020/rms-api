import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateRecoveryDto {
  @IsString()
  @IsNotEmpty({ message: 'Recovery question is required' })
  @MaxLength(256)
  @Transform(({ value }) => value?.trim())
  question!: string;

  @IsString()
  @IsNotEmpty({ message: 'Recovery answer is required' })
  @MinLength(2, { message: 'Answer must be at least 2 characters' })
  @Transform(({ value }) => value?.trim().toLowerCase()) // normalise before hashing
  answer!: string;
}

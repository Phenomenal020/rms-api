import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateProfileDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  @MaxLength(64, { message: 'First name must be at most 64 characters' })
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim())
  @MaxLength(64, { message: 'Last name must be at most 64 characters' })
  lastName!: string;

  // @IsOptional()
  // @IsString()
  // subscription?: string;

  // @IsOptional()
  // @IsString()
  // role?: string;

  // @IsOptional()
  // @IsString()
  // @MaxLength(2048, { message: 'Image must be at most 2048 characters' })
  // image?: string | null;
}
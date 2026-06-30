import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AddMemberDto {
    @Transform(({ value }) => value.trim())
    @IsNotEmpty()
    @IsEmail({}, { message: 'Invalid email address' })
    @MaxLength(255, { message: 'Email address too long. Please use a shorter email address.' })
    email!: string;
}
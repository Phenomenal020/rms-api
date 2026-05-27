import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class AddMemberDto {
    @IsEmail()
    @IsNotEmpty()
    email!: string;

//     @IsString()
//     @IsNotEmpty()
//     organizationId!: string;
}
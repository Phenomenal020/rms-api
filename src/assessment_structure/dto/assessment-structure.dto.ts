import { IsString, IsNotEmpty, IsOptional, IsUUID, IsNumber, IsInt, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

function trim({ value }: { value: string }) {
  return value.trim();
}

export class UpsertAssessmentStructureDto {
    @IsOptional()
    @IsUUID()
    id?: string;

    @IsString()
    @IsNotEmpty()
    @Transform(trim)
    type!: string;

    @IsNumber()
    @Min(0)
    @Max(100)
    percentage!: number;

    @IsInt()
    @Min(1)
    order!: number;
}

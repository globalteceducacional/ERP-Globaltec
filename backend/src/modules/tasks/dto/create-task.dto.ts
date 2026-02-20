import {
  IsDateString,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class ChecklistSubItemDto {
  @IsString()
  @MaxLength(500)
  texto: string;

  @IsOptional()
  concluido?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descricao?: string;
}

export class ChecklistItemDto {
  @IsString()
  @MaxLength(500)
  texto: string;

  @IsOptional()
  concluido?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descricao?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChecklistSubItemDto)
  subitens?: ChecklistSubItemDto[];
}

export class CreateTaskDto {
  @IsInt()
  projetoId: number;

  @IsInt()
  executorId: number;

  @IsString()
  @MaxLength(120)
  nome: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsDateString()
  dataInicio?: string;

  @IsOptional()
  @IsDateString()
  dataFim?: string;

  @IsOptional()
  @IsPositive()
  valorInsumos?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChecklistItemDto)
  checklist?: ChecklistItemDto[];

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value.map((v) => Number(v)).filter((n) => !Number.isNaN(n)) : value))
  integrantesIds?: number[];
}

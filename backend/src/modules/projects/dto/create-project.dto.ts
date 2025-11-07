import {
  ArrayNotEmpty,
  IsArray,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @MaxLength(120)
  nome: string;

  @IsOptional()
  @IsString()
  resumo?: string;

  @IsOptional()
  @IsString()
  objetivo?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  valorTotal?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  valorInsumos?: number;

  @IsNumber()
  @IsPositive()
  supervisorId: number;

  @IsOptional()
  @IsArray()
  responsavelIds?: number[];

  @IsOptional()
  planilhaJson?: Record<string, unknown>;
}

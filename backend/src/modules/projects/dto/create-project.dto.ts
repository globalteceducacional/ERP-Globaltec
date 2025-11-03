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

  @IsOptional()
  supervisorId?: number;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  responsavelIds?: number[];

  @IsOptional()
  planilhaJson?: Record<string, unknown>;
}

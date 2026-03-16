import {
  ArrayNotEmpty,
  IsArray,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
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
  @IsString()
  descricaoLonga?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
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

  @IsOptional()
  descricaoArquivos?: {
    originalName: string;
    url: string;
    mimeType?: string;
    size?: number;
  }[];
}

import {
  IsDateString,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

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
}

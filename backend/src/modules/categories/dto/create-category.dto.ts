import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @MaxLength(100)
  nome: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  descricao?: string;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}

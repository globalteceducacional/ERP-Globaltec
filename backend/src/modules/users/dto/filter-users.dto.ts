import { IsOptional, IsBooleanString, IsString } from 'class-validator';

export class FilterUsersDto {
  @IsOptional()
  @IsString()
  nome?: string; // Busca por nome (busca parcial, case-insensitive)

  @IsOptional()
  @IsString()
  cargo?: string; // Nome do cargo para filtrar

  @IsOptional()
  @IsBooleanString()
  ativo?: string;
}

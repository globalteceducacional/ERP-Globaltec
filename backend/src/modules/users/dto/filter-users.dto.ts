import { IsOptional, IsBooleanString, IsString } from 'class-validator';

export class FilterUsersDto {
  @IsOptional()
  @IsString()
  cargo?: string; // Nome do cargo para filtrar

  @IsOptional()
  @IsBooleanString()
  ativo?: string;
}

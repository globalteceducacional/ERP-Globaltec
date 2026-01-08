import { IsInt, IsPositive, IsOptional } from 'class-validator';

export class CreateAlocacaoDto {
  @IsInt()
  @IsPositive()
  estoqueId: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  projetoId?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  etapaId?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  usuarioId?: number;

  @IsInt()
  @IsPositive()
  quantidade: number;
}


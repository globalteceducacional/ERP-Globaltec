import { IsOptional, IsString, IsBoolean, IsArray, IsEnum } from 'class-validator';
import { CargoNivel } from '@prisma/client';

export class CreateCargoDto {
  @IsString()
  nome: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  paginasPermitidas?: string[];

  @IsEnum(CargoNivel)
  nivelAcesso: CargoNivel;

  @IsOptional()
  @IsBoolean()
  herdaPermissoes?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
}

